const asyncHandler = require('../middleware/asyncHandler')
const ApiError = require('../utils/ApiError')
const Order = require('../models/Order')
const Invoice = require('../models/Invoice')
const Product = require('../models/Product')
const PromoCode = require('../models/PromoCode')
const { nextSequence } = require('../models/Counter')
const mongoose = require('mongoose')
const shiprocketService = require('../services/shiprocketService')
const { sendMailSafe } = require('../services/mailService')
const { buildInvoicePdf, pipeInvoicePdf } = require('../utils/invoicePdf')
const emails = require('../utils/emailTemplates')
const { runInBackground } = require('../utils/background')
const { COD_FEE, PAYMENT_OPTIONS, isRazorpayEnabled, isMockPaymentsEnabled } = require('../config/payments')

const FREE_SHIPPING_THRESHOLD = 2999
const STANDARD_SHIPPING = 149
const TAX_RATE = 0.05

// Recomputes totals server-side from the DB — never trusts client-sent prices.
async function priceCart(items, promoCode, paymentMethod) {
  if (!items?.length) throw new ApiError(400, 'Cart is empty')

  // The storefront identifies products by slug; the admin app by ObjectId.
  const ids = items.map((i) => String(i.productId))
  const objectIds = ids.filter((id) => mongoose.isValidObjectId(id))
  const products = await Product.find({ $or: [{ _id: { $in: objectIds } }, { slug: { $in: ids } }] })
  const productMap = Object.fromEntries(products.flatMap((p) => [[String(p._id), p], [p.slug, p]]))

  const pricedItems = items.map((item) => {
    const product = productMap[String(item.productId)]
    if (!product || !product.isActive) throw new ApiError(400, `Product ${item.productId} is no longer available`)
    if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new ApiError(400, 'Invalid quantity')
    if (product.stockCount < item.quantity) throw new ApiError(400, `${product.name} is out of stock`)

    return {
      product: product._id,
      name: product.name,
      image: product.images[0]?.url,
      price: product.price,
      size: item.size,
      color: item.color,
      quantity: item.quantity,
    }
  })

  const subtotal = pricedItems.reduce((sum, i) => sum + i.price * i.quantity, 0)

  let discount = 0
  let freeShipping = false
  let appliedCode
  if (promoCode) {
    const promo = await PromoCode.findOne({ code: promoCode.toUpperCase() })
    if (!promo || promo.status !== 'Active') throw new ApiError(400, 'Invalid or expired promo code')
    if (subtotal < promo.minOrderValue) throw new ApiError(400, `Minimum order value is ₹${promo.minOrderValue}`)
    if (promo.type === 'Percent') discount = Math.round(subtotal * (promo.value / 100))
    if (promo.type === 'Flat') discount = Math.min(promo.value, subtotal)
    if (promo.type === 'Shipping') freeShipping = true
    appliedCode = promo
  }

  const discountedSubtotal = subtotal - discount
  let shipping = discountedSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING
  if (freeShipping) shipping = 0
  const tax = Math.round(discountedSubtotal * TAX_RATE)
  const codFee = paymentMethod === 'COD' ? COD_FEE : 0
  const total = discountedSubtotal + shipping + tax + codFee

  return { pricedItems, subtotal, discount, shipping, tax, codFee, total, appliedCode }
}

async function decrementStockAndCount(items) {
  await Promise.all(
    items.map((item) =>
      Product.findByIdAndUpdate(item.product, { $inc: { stockCount: -item.quantity, sold: item.quantity } })
    )
  )
}

async function restockItems(items) {
  await Promise.all(
    items.map((item) => Product.findByIdAndUpdate(item.product, { $inc: { stockCount: item.quantity, sold: -item.quantity } }))
  )
}

async function sendOrderConfirmation(order, invoice) {
  try {
    const pdf = await buildInvoicePdf(invoice, order)
    await sendMailSafe({
      to: order.email,
      ...emails.orderConfirmation(order, invoice),
      attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, content: pdf, contentType: 'application/pdf' }],
    })
  } catch (err) {
    console.error(`Order confirmation email failed for ${order.orderNumber}:`, err.message)
  }
}

// Creating the invoice is the point an order is confirmed (COD placed, or
// online payment captured), so the confirmation email goes out from here.
async function createInvoice(order, status = 'Paid') {
  const seq = await nextSequence('invoice')
  const invoice = await Invoice.create({
    invoiceNumber: `INV-${seq}`,
    order: order._id,
    customer: order.shippingAddress.fullName,
    email: order.email,
    amount: order.total,
    status,
  })
  runInBackground(sendOrderConfirmation(order, invoice))
  return invoice
}

// Best-effort Shiprocket push — logged, never blocks the order response.
async function fulfillShipment(order) {
  if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) {
    console.log(`Shiprocket not configured — skipping shipment for ${order.orderNumber}`)
    return
  }
  try {
    const shipment = await shiprocketService.createShipment(order)
    order.shiprocket = {
      shipmentId: String(shipment.shipment_id || ''),
      orderId: String(shipment.order_id || ''),
      awbCode: shipment.awb_code || '',
      courierName: shipment.courier_name || '',
      trackingStatus: 'Assigned',
    }
    await order.save()
  } catch (err) {
    console.error(`Shiprocket fulfillment failed for order ${order.orderNumber}:`, err.response?.data || err.message)
  }
}

// Called once the online payment — the full amount, or the COD fee — is captured.
async function confirmOrder(order, paymentId) {
  if (order.confirmedAt) return // idempotent — webhook and client verify can race
  const isCod = order.paymentMethod === 'COD'

  order.awaitingPayment = false
  order.confirmedAt = new Date()
  order.amountPaid = isCod ? order.codFee : order.total
  order.paymentStatus = isCod ? 'Pending' : 'Paid' // COD balance is collected at the door
  if (paymentId) order.razorpay = { ...order.razorpay, paymentId }
  await order.save()

  await decrementStockAndCount(order.items)
  await createInvoice(order, isCod ? 'Unpaid' : 'Paid')
  runInBackground(fulfillShipment(order))
}

// POST /api/orders/checkout
const checkout = asyncHandler(async (req, res) => {
  const { items, shippingAddress, promoCode, paymentOption = 'upi', email } = req.body
  if (!shippingAddress) throw new ApiError(400, 'Shipping address is required')
  const missing = ['fullName', 'phone', 'addressLine', 'city', 'state', 'pincode'].filter((f) => !shippingAddress[f]?.trim?.())
  if (missing.length) throw new ApiError(400, `Shipping address is missing: ${missing.join(', ')}`)
  if (!PAYMENT_OPTIONS.includes(paymentOption)) throw new ApiError(400, 'Invalid payment option')
  if (!isRazorpayEnabled() && !isMockPaymentsEnabled()) {
    throw new ApiError(503, 'Online payments are not available right now. Please try again shortly.')
  }

  const paymentMethod = paymentOption === 'cod' ? 'COD' : 'Razorpay'
  const priced = await priceCart(items, promoCode, paymentMethod)

  const seq = await nextSequence('order')
  const order = await Order.create({
    orderNumber: `ORD-${seq}`,
    user: req.user?._id,
    email: email || req.user?.email,
    items: priced.pricedItems,
    shippingAddress,
    promoCode: priced.appliedCode?.code,
    subtotal: priced.subtotal,
    discount: priced.discount,
    shipping: priced.shipping,
    tax: priced.tax,
    codFee: priced.codFee,
    total: priced.total,
    paymentMethod,
    paymentOption,
    paymentStatus: 'Pending',
    awaitingPayment: true,
  })

  if (priced.appliedCode) await PromoCode.findByIdAndUpdate(priced.appliedCode._id, { $inc: { usedCount: 1 } })

  // COD customers pay only the fee now; everyone else pays the full total.
  const payNow = paymentMethod === 'COD' ? priced.codFee : priced.total

  if (!isRazorpayEnabled()) {
    return res.status(201).json({ success: true, order, payNow, mockPayment: true })
  }

  // Required lazily: the SDK throws synchronously if RAZORPAY_KEY_ID is unset.
  const razorpay = require('../config/razorpay')
  const rzpOrder = await razorpay.orders.create({
    amount: Math.round(payNow * 100),
    currency: 'INR',
    receipt: order.orderNumber,
    notes: { purpose: paymentMethod === 'COD' ? 'COD fee' : 'Order payment' },
  })
  order.razorpay = { orderId: rzpOrder.id }
  await order.save()

  res.status(201).json({
    success: true,
    order,
    payNow,
    razorpayOrder: { id: rzpOrder.id, amount: rzpOrder.amount, currency: rzpOrder.currency },
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  })
})

// GET /api/orders/mine
const getMyOrders = asyncHandler(async (req, res) => {
  // Abandoned payments never became real orders, so customers don't see them.
  const orders = await Order.find({ user: req.user._id, awaitingPayment: { $ne: true } }).sort({ createdAt: -1 })
  res.json({ success: true, orders })
})

// GET /api/orders (admin)
const getOrders = asyncHandler(async (req, res) => {
  const filter = {}
  if (req.query.status) filter.status = req.query.status
  if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus
  const orders = await Order.find(filter).sort({ createdAt: -1 })
  res.json({ success: true, orders })
})

// GET /api/orders/:id
const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('items.product', 'name slug images')
  if (!order) throw new ApiError(404, 'Order not found')

  const isOwner = order.user && String(order.user) === String(req.user?._id)
  const isStaff = ['admin', 'staff'].includes(req.user?.role)
  if (!isOwner && !isStaff) throw new ApiError(403, 'Not authorized to view this order')

  res.json({ success: true, order })
})

// PATCH /api/orders/:id/status (admin)
const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
  if (!order) throw new ApiError(404, 'Order not found')

  const { status, cancelReason } = req.body
  if (!['Processing', 'Shipped', 'Delivered', 'Cancelled'].includes(status)) {
    throw new ApiError(400, 'Invalid status')
  }

  if (status === 'Cancelled' && order.status !== 'Cancelled') {
    await restockItems(order.items)
    if (order.paymentStatus === 'Paid' || order.amountPaid > 0) {
      order.paymentStatus = 'Refunded'
      await Invoice.findOneAndUpdate({ order: order._id }, { status: 'Refunded' })
    }
    order.cancelReason = cancelReason
    if (order.shiprocket?.orderId) {
      shiprocketService.cancelShipment(order.shiprocket.orderId).catch((err) => console.error('Shiprocket cancel failed:', err.message))
    }
  }

  // COD cash is collected at the door — mark it paid once delivery is confirmed.
  if (status === 'Delivered' && order.paymentMethod === 'COD' && order.paymentStatus === 'Pending') {
    order.paymentStatus = 'Paid'
    order.amountPaid = order.total
    await Invoice.findOneAndUpdate({ order: order._id }, { status: 'Paid' })
  }

  const changed = order.status !== status
  order.status = status
  await order.save()

  if (changed) {
    const message = emails.orderStatus(order)
    if (message) sendMailSafe({ to: order.email, ...message })
  }
  res.json({ success: true, order })
})

// GET /api/orders/:id/invoice — the customer's own invoice PDF
const downloadMyInvoice = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
  if (!order) throw new ApiError(404, 'Order not found')

  const isOwner = order.user && String(order.user) === String(req.user._id)
  const isStaff = ['admin', 'staff'].includes(req.user.role)
  if (!isOwner && !isStaff) throw new ApiError(403, 'Not authorized to view this invoice')

  const invoice = await Invoice.findOne({ order: order._id })
  if (!invoice) throw new ApiError(404, 'The invoice is issued once payment is confirmed')
  pipeInvoicePdf(res, invoice, order)
})

module.exports = {
  checkout,
  getMyOrders,
  getOrders,
  getOrder,
  updateOrderStatus,
  downloadMyInvoice,
  // exported for paymentController
  confirmOrder,
}

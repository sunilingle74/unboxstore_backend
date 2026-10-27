const crypto = require('crypto')
const asyncHandler = require('../middleware/asyncHandler')
const ApiError = require('../utils/ApiError')
const Order = require('../models/Order')
const { confirmOrder } = require('./orderController')
const { COD_FEE, isRazorpayEnabled, isMockPaymentsEnabled } = require('../config/payments')

// POST /api/payments/verify — called by the client right after Razorpay checkout succeeds
const verifyPayment = asyncHandler(async (req, res) => {
  const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body
  if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new ApiError(400, 'Missing payment verification fields')
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex')

  if (expectedSignature !== razorpay_signature) {
    throw new ApiError(400, 'Payment signature verification failed')
  }

  const order = await Order.findById(orderId)
  if (!order) throw new ApiError(404, 'Order not found')
  if (order.razorpay.orderId !== razorpay_order_id) throw new ApiError(400, 'Order mismatch')

  order.razorpay.signature = razorpay_signature
  await confirmOrder(order, razorpay_payment_id)

  res.json({ success: true, order })
})

// POST /api/payments/webhook — server-to-server safety net, configured in the Razorpay dashboard
const razorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature']
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
    .update(req.body) // raw Buffer — see server.js route mounting
    .digest('hex')

  if (signature !== expected) return res.status(400).json({ success: false, message: 'Invalid webhook signature' })

  const payload = JSON.parse(req.body.toString('utf8'))

  if (payload.event === 'payment.captured') {
    const razorpayOrderId = payload.payload.payment.entity.order_id
    const order = await Order.findOne({ 'razorpay.orderId': razorpayOrderId })
    if (order) await confirmOrder(order, payload.payload.payment.entity.id)
  }

  res.json({ received: true })
})

// POST /api/payments/mock — dev/test stand-in for a captured Razorpay payment.
// Only exists while Razorpay keys are absent outside production.
const confirmMockPayment = asyncHandler(async (req, res) => {
  if (!isMockPaymentsEnabled()) throw new ApiError(404, 'Not found')

  const order = await Order.findById(req.body.orderId)
  if (!order) throw new ApiError(404, 'Order not found')
  if (!order.user || String(order.user) !== String(req.user._id)) throw new ApiError(403, 'Not your order')

  await confirmOrder(order, `mock_${Date.now()}`)
  res.json({ success: true, order })
})

// GET /api/payments/config — what the storefront checkout can offer
const getPaymentConfig = asyncHandler(async (req, res) => {
  const razorpayEnabled = isRazorpayEnabled()
  res.json({
    success: true,
    razorpayEnabled,
    razorpayKeyId: razorpayEnabled ? process.env.RAZORPAY_KEY_ID : null,
    mockPayments: isMockPaymentsEnabled(),
    codFee: COD_FEE,
  })
})

module.exports = { verifyPayment, razorpayWebhook, getPaymentConfig, confirmMockPayment }

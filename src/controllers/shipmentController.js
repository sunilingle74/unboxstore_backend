const asyncHandler = require('../middleware/asyncHandler')
const ApiError = require('../utils/ApiError')
const Order = require('../models/Order')
const shiprocketService = require('../services/shiprocketService')

// POST /api/orders/:id/ship (admin) — manually (re)push an order to Shiprocket
const shipOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
  if (!order) throw new ApiError(404, 'Order not found')
  if (order.paymentMethod !== 'COD' && order.paymentStatus !== 'Paid') {
    throw new ApiError(400, 'Order is not paid yet')
  }

  const shipment = await shiprocketService.createShipment(order)
  order.shiprocket = {
    shipmentId: String(shipment.shipment_id || ''),
    orderId: String(shipment.order_id || ''),
    awbCode: shipment.awb_code || '',
    courierName: shipment.courier_name || '',
    trackingStatus: 'Assigned',
  }
  order.status = 'Shipped'
  await order.save()

  res.json({ success: true, order })
})

// GET /api/orders/:id/track
const trackOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
  if (!order) throw new ApiError(404, 'Order not found')
  if (!order.shiprocket?.awbCode) throw new ApiError(400, 'This order has not been shipped yet')

  const tracking = await shiprocketService.trackShipment(order.shiprocket.awbCode)
  res.json({ success: true, tracking })
})

// GET /api/shipping/serviceability?pincode=XXXXXX (public — checkout page)
const checkServiceability = asyncHandler(async (req, res) => {
  const { pincode, weight } = req.query
  if (!pincode) throw new ApiError(400, 'Pincode is required')

  const data = await shiprocketService.checkServiceability({
    pickupPincode: process.env.SHIPROCKET_PICKUP_PINCODE || pincode,
    deliveryPincode: pincode,
    weight: weight ? Number(weight) : 0.5,
  })
  res.json({ success: true, serviceability: data })
})

module.exports = { shipOrder, trackOrder, checkServiceability }

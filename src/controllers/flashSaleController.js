const asyncHandler = require('../middleware/asyncHandler')
const ApiError = require('../utils/ApiError')
const FlashSale = require('../models/FlashSale')

// GET /api/flash-sales
const getFlashSales = asyncHandler(async (req, res) => {
  const sales = await FlashSale.find().populate('products', 'name price images').sort({ startsAt: -1 })
  res.json({ success: true, flashSales: sales })
})

// GET /api/flash-sales/active (public — storefront banner/section)
const getActiveFlashSale = asyncHandler(async (req, res) => {
  const now = new Date()
  const sale = await FlashSale.findOne({ startsAt: { $lte: now }, endsAt: { $gte: now } }).populate('products')
  res.json({ success: true, flashSale: sale || null })
})

// POST /api/flash-sales (admin)
const createFlashSale = asyncHandler(async (req, res) => {
  const { name, discountPercent, products, startsAt, endsAt } = req.body
  if (!name || !discountPercent || !startsAt || !endsAt) {
    throw new ApiError(400, 'Name, discount, start and end dates are required')
  }
  const sale = await FlashSale.create({ name, discountPercent, products: products || [], startsAt, endsAt })
  res.status(201).json({ success: true, flashSale: sale })
})

// PATCH /api/flash-sales/:id (admin)
const updateFlashSale = asyncHandler(async (req, res) => {
  const sale = await FlashSale.findById(req.params.id)
  if (!sale) throw new ApiError(404, 'Flash sale not found')

  const fields = ['name', 'discountPercent', 'products', 'startsAt', 'endsAt']
  fields.forEach((f) => {
    if (req.body[f] !== undefined) sale[f] = req.body[f]
  })
  await sale.save()
  res.json({ success: true, flashSale: sale })
})

// DELETE /api/flash-sales/:id (admin)
const deleteFlashSale = asyncHandler(async (req, res) => {
  const sale = await FlashSale.findByIdAndDelete(req.params.id)
  if (!sale) throw new ApiError(404, 'Flash sale not found')
  res.json({ success: true, message: 'Flash sale deleted' })
})

module.exports = { getFlashSales, getActiveFlashSale, createFlashSale, updateFlashSale, deleteFlashSale }

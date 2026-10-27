const asyncHandler = require('../middleware/asyncHandler')
const ApiError = require('../utils/ApiError')
const PromoCode = require('../models/PromoCode')

// GET /api/promo-codes (admin)
const getPromoCodes = asyncHandler(async (req, res) => {
  const codes = await PromoCode.find().sort({ createdAt: -1 })
  res.json({ success: true, promoCodes: codes })
})

// POST /api/promo-codes (admin)
const createPromoCode = asyncHandler(async (req, res) => {
  const { code, type, value, minOrderValue, usageLimit, expiresAt } = req.body
  if (!code || !type) throw new ApiError(400, 'Code and type are required')

  const exists = await PromoCode.findOne({ code: code.toUpperCase() })
  if (exists) throw new ApiError(409, 'Promo code already exists')

  const promo = await PromoCode.create({ code, type, value, minOrderValue, usageLimit, expiresAt })
  res.status(201).json({ success: true, promoCode: promo })
})

// PATCH /api/promo-codes/:id (admin)
const updatePromoCode = asyncHandler(async (req, res) => {
  const promo = await PromoCode.findById(req.params.id)
  if (!promo) throw new ApiError(404, 'Promo code not found')

  const fields = ['type', 'value', 'minOrderValue', 'usageLimit', 'expiresAt', 'active']
  fields.forEach((f) => {
    if (req.body[f] !== undefined) promo[f] = req.body[f]
  })
  if (req.body.code) promo.code = req.body.code.toUpperCase()

  await promo.save()
  res.json({ success: true, promoCode: promo })
})

// DELETE /api/promo-codes/:id (admin)
const deletePromoCode = asyncHandler(async (req, res) => {
  const promo = await PromoCode.findByIdAndDelete(req.params.id)
  if (!promo) throw new ApiError(404, 'Promo code not found')
  res.json({ success: true, message: 'Promo code deleted' })
})

// POST /api/promo-codes/validate (public) — { code, subtotal }
const validatePromoCode = asyncHandler(async (req, res) => {
  const { code, subtotal = 0 } = req.body
  if (!code) throw new ApiError(400, 'Code is required')

  const promo = await PromoCode.findOne({ code: code.toUpperCase() })
  if (!promo) throw new ApiError(404, 'Invalid promo code')
  if (promo.status !== 'Active') throw new ApiError(400, `This code is ${promo.status.toLowerCase()}`)
  if (subtotal < promo.minOrderValue) {
    throw new ApiError(400, `Minimum order value is ₹${promo.minOrderValue}`)
  }

  let discount = 0
  let freeShipping = false
  if (promo.type === 'Percent') discount = Math.round(subtotal * (promo.value / 100))
  if (promo.type === 'Flat') discount = Math.min(promo.value, subtotal)
  if (promo.type === 'Shipping') freeShipping = true

  res.json({ success: true, code: promo.code, type: promo.type, discount, freeShipping })
})

module.exports = { getPromoCodes, createPromoCode, updatePromoCode, deletePromoCode, validatePromoCode }

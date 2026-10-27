const asyncHandler = require('../middleware/asyncHandler')
const ApiError = require('../utils/ApiError')
const User = require('../models/User')

// GET /api/users (admin)
const getUsers = asyncHandler(async (req, res) => {
  const { search = '', role, status, page = 1, limit = 20 } = req.query
  const filter = {}
  if (search) filter.$or = [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }, { phone: new RegExp(search, 'i') }]
  if (role) filter.role = role
  if (status) filter.status = status

  const skip = (Number(page) - 1) * Number(limit)
  const [users, total] = await Promise.all([
    User.find(filter).populate('orderCount').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    User.countDocuments(filter),
  ])

  res.json({ success: true, count: users.length, total, page: Number(page), users })
})

// GET /api/users/:id (admin)
const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).populate('orderCount')
  if (!user) throw new ApiError(404, 'User not found')
  res.json({ success: true, user })
})

// PATCH /api/users/:id (admin) — role/status
const updateUser = asyncHandler(async (req, res) => {
  const { role, status, name, phone } = req.body
  const user = await User.findById(req.params.id)
  if (!user) throw new ApiError(404, 'User not found')

  if (role) user.role = role
  if (status) user.status = status
  if (name) user.name = name
  if (phone) user.phone = phone
  await user.save()

  res.json({ success: true, user })
})

// DELETE /api/users/:id (admin)
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id)
  if (!user) throw new ApiError(404, 'User not found')
  res.json({ success: true, message: 'User deleted' })
})

// PATCH /api/users/me — self profile update
// A customer's mobile number is their sign-in identity (changed only through
// OTP), so only staff/admin accounts — who sign in by email — may edit it here.
const updateMe = asyncHandler(async (req, res) => {
  const { name, email, phone } = req.body
  const user = await User.findById(req.user._id)
  if (name?.trim()) user.name = name.trim()
  if (phone !== undefined && user.role !== 'customer') {
    const normalized = String(phone).replace(/\D/g, '')
    if (normalized && normalized !== user.phone && (await User.exists({ phone: normalized }))) {
      throw new ApiError(409, 'This mobile number is linked to another account')
    }
    user.phone = normalized || undefined
  }
  if (email) {
    const normalized = email.trim().toLowerCase()
    if (normalized !== user.email && (await User.exists({ email: normalized }))) {
      throw new ApiError(409, 'This email is already linked to another account')
    }
    user.email = normalized
  }
  await user.save()
  res.json({ success: true, user })
})

// PATCH /api/users/me/password — set a password (enables email sign-in) or change it
const updateMyPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!newPassword || newPassword.length < 6) throw new ApiError(400, 'Password must be at least 6 characters')

  const user = await User.findById(req.user._id).select('+password')
  if (user.password && !(await user.comparePassword(currentPassword || ''))) {
    throw new ApiError(400, 'Current password is incorrect')
  }
  user.password = newPassword
  await user.save()
  res.json({ success: true, message: 'Password updated' })
})

// POST /api/users/me/addresses
const addAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
  if (req.body.isDefault) user.addresses.forEach((a) => (a.isDefault = false))
  user.addresses.push(req.body)
  await user.save()
  res.status(201).json({ success: true, addresses: user.addresses })
})

// PATCH /api/users/me/addresses/:addressId
const updateAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
  const address = user.addresses.id(req.params.addressId)
  if (!address) throw new ApiError(404, 'Address not found')

  if (req.body.isDefault) user.addresses.forEach((a) => (a.isDefault = false))
  Object.assign(address, req.body)
  await user.save()
  res.json({ success: true, addresses: user.addresses })
})

// DELETE /api/users/me/addresses/:addressId
const deleteAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
  user.addresses.id(req.params.addressId)?.deleteOne()
  await user.save()
  res.json({ success: true, addresses: user.addresses })
})

module.exports = { getUsers, getUser, updateUser, deleteUser, updateMe, updateMyPassword, addAddress, updateAddress, deleteAddress }

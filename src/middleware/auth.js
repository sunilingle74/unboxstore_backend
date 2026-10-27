const jwt = require('jsonwebtoken')
const asyncHandler = require('./asyncHandler')
const ApiError = require('../utils/ApiError')
const User = require('../models/User')

const protect = asyncHandler(async (req, res, next) => {
  let token = req.cookies?.token



  //eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ZDM3NjQ3NjQ2ZmMzNjI5NmE3ZTZlYSIsInBob25lIjoiOTI4NDkyNDY2MCIsInZlcmlmaWVkIjp0cnVlLCJpYXQiOjE3ODgxNTk4ODcsImV4cCI6MTc4ODc2NDY4N30.VedlexEquo-FGlQ0gmwbtl9MiurRtMSfreg0oZyX9wg
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1]
  }

  if (!token) throw new ApiError(401, 'Not authenticated')

  const decoded = jwt.verify(token, process.env.JWT_SECRET)
  const user = await User.findById(decoded.id).select('-password')
  if (!user) throw new ApiError(401, 'User no longer exists')
  if (user.status === 'Suspended') throw new ApiError(403, 'Account suspended')

  req.user = user
  next()
})

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    throw new ApiError(403, 'Not authorized for this action')
  }
  next()
}

// Attaches req.user when a valid token is present, but never rejects — used for
// guest-friendly routes like checkout and support tickets.
const optionalAuth = asyncHandler(async (req, res, next) => {
  let token = req.cookies?.token
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1]
  }
  if (!token) return next()

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = await User.findById(decoded.id).select('-password')
  } catch {
    // invalid/expired token on an optional route — proceed as a guest
  }
  next()
})

module.exports = { protect, authorize, optionalAuth }

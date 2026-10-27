const jwt = require('jsonwebtoken')
const { isLocalDev } = require('../config/env')

// Same-site by default. Set COOKIE_SAMESITE=none when the storefront calls the
// API on a different domain (requires HTTPS, so `secure` is forced on).
function authCookieOptions() {
  const sameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase()
  return {
    httpOnly: true,
    secure: sameSite === 'none' || !isLocalDev(),
    sameSite,
    path: '/',
  }
}

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

function sendTokenResponse(user, statusCode, res) {
  const token = signToken(user._id)

  res.cookie('token', token, { ...authCookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 })

  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
    },
  })
}

module.exports = { signToken, sendTokenResponse, authCookieOptions }

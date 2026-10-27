const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const asyncHandler = require('../middleware/asyncHandler')
const ApiError = require('../utils/ApiError')
const User = require('../models/User')
const Otp = require('../models/Otp')
const { sendTokenResponse, authCookieOptions } = require('../utils/generateToken')
const { sendSms, isSmsConfigured } = require('../services/smsService')
const { sendMailSafe } = require('../services/mailService')
const emails = require('../utils/emailTemplates')
const { isLocalDev } = require('../config/env')

const OTP_TTL_MS = 5 * 60 * 1000
const OTP_RESEND_COOLDOWN_MS = 30 * 1000
const OTP_MAX_ATTEMPTS = 5
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000
const PHONE_RE = /^[6-9]\d{9}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  const phone = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits
  if (!PHONE_RE.test(phone)) throw new ApiError(400, 'Enter a valid 10-digit Indian mobile number')
  return phone
}

function hashSecret(value) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(value).digest('hex')
}

// Short-lived proof that a phone number was verified, used to finish sign-up
// for a new number without asking for a second OTP.
function signSignupToken(phone) {
  return jwt.sign({ phone, purpose: 'signup' }, process.env.JWT_SECRET, { expiresIn: '15m' })
}

function readSignupToken(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    if (payload.purpose !== 'signup') throw new Error('wrong purpose')
    return payload.phone
  } catch {
    throw new ApiError(401, 'Your verification has expired — please request a new code')
  }
}

async function createCustomer({ phone, name, email }) {
  if (!name?.trim()) throw new ApiError(400, 'Name is required')
  if (!EMAIL_RE.test(email || '')) throw new ApiError(400, 'Enter a valid email address')

  const normalizedEmail = email.trim().toLowerCase()
  if (await User.exists({ email: normalizedEmail })) {
    throw new ApiError(409, 'This email is already linked to another account')
  }

  const user = await User.create({ name: name.trim(), email: normalizedEmail, phone, phoneVerified: true })
  sendMailSafe({ to: user.email, ...emails.welcome(user) })
  return user
}

// POST /api/auth/otp/send — { phone }
const sendOtp = asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone)

  const recent = await Otp.findOne({ phone }).sort({ createdAt: -1 })
  if (recent && Date.now() - recent.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    throw new ApiError(429, 'Please wait a few seconds before requesting another code')
  }

  const code = String(crypto.randomInt(100000, 1000000))
  await Otp.deleteMany({ phone })
  await Otp.create({ phone, codeHash: hashSecret(code), expiresAt: new Date(Date.now() + OTP_TTL_MS) })
  await sendSms(phone, `${code} is your unboxstore verification code. It expires in 5 minutes.`)

  const isNewUser = !(await User.exists({ phone }))
  const exposeCode = !isSmsConfigured() && isLocalDev()

  res.json({ success: true, isNewUser, ...(exposeCode && { devCode: code }) })
})

// POST /api/auth/otp/verify — { phone, code, name?, email? }
// Existing number → signed in. New number → account created when name + email
// are sent, otherwise a signupToken is returned to finish via /otp/complete.
const verifyOtp = asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone)
  const code = String(req.body.code || '').trim()

  const otp = await Otp.findOne({ phone }).sort({ createdAt: -1 })
  if (!otp || otp.expiresAt < new Date()) throw new ApiError(400, 'Code expired — please request a new one')
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new ApiError(429, 'Too many attempts — please request a new code')

  if (otp.codeHash !== hashSecret(code)) {
    otp.attempts += 1
    await otp.save()
    throw new ApiError(400, 'Incorrect code')
  }
  await Otp.deleteMany({ phone })

  let user = await User.findOne({ phone })
  if (user) {
    if (user.status === 'Suspended') throw new ApiError(403, 'Account suspended')
    if (!user.phoneVerified) {
      user.phoneVerified = true
      await user.save()
    }
    return sendTokenResponse(user, 200, res)
  }

  if (req.body.name || req.body.email) {
    user = await createCustomer({ phone, name: req.body.name, email: req.body.email })
    return sendTokenResponse(user, 201, res)
  }

  res.json({ success: true, needsProfile: true, signupToken: signSignupToken(phone) })
})

// POST /api/auth/otp/complete — { signupToken, name, email }
const completeSignup = asyncHandler(async (req, res) => {
  const phone = readSignupToken(req.body.signupToken)
  if (await User.exists({ phone })) throw new ApiError(409, 'An account with this number already exists')

  const user = await createCustomer({ phone, name: req.body.name, email: req.body.email })
  sendTokenResponse(user, 201, res)
})

// POST /api/auth/login — email + password (secondary sign-in method)
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) throw new ApiError(400, 'Email and password are required')

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password')
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password')
  }
  if (user.status === 'Suspended') throw new ApiError(403, 'Account suspended')

  sendTokenResponse(user, 200, res)
})

// POST /api/auth/admin-login — same credentials check, but requires staff/admin role
const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) throw new ApiError(400, 'Email and password are required')

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password')
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password')
  }
  if (!['admin', 'staff'].includes(user.role)) throw new ApiError(403, 'Not an admin account')

  sendTokenResponse(user, 200, res)
})

// POST /api/auth/forgot-password — { email }
// Always answers the same way so it can't be used to discover accounts.
const forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim()
  if (!EMAIL_RE.test(email)) throw new ApiError(400, 'Enter a valid email address')

  const user = await User.findOne({ email })
  if (user && user.status !== 'Suspended') {
    const token = crypto.randomBytes(32).toString('hex')
    user.resetPasswordTokenHash = hashSecret(token)
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS)
    await user.save()

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`
    sendMailSafe({ to: user.email, ...emails.passwordReset(user, resetUrl) })
  }

  res.json({ success: true, message: 'If an account exists for that email, a reset link is on its way.' })
})

// POST /api/auth/reset-password — { token, password }
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body
  if (!token) throw new ApiError(400, 'Reset link is invalid')
  if (!password || password.length < 6) throw new ApiError(400, 'Password must be at least 6 characters')

  const user = await User.findOne({
    resetPasswordTokenHash: hashSecret(token),
    resetPasswordExpires: { $gt: new Date() },
  })
  if (!user) throw new ApiError(400, 'This reset link is invalid or has expired')

  user.password = password
  user.resetPasswordTokenHash = undefined
  user.resetPasswordExpires = undefined
  await user.save()

  sendMailSafe({ to: user.email, ...emails.passwordChanged(user) })
  sendTokenResponse(user, 200, res)
})

// POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token', authCookieOptions()) // must match the options it was set with
  res.json({ success: true, message: 'Logged out' })
})

// GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password')
  const { password, ...rest } = user.toJSON()
  res.json({ success: true, user: { ...rest, hasPassword: Boolean(password) } })
})

module.exports = {
  sendOtp,
  verifyOtp,
  completeSignup,
  login,
  adminLogin,
  forgotPassword,
  resetPassword,
  logout,
  getMe,
}

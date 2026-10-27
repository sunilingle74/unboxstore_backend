const router = require('express').Router()
const { protect } = require('../middleware/auth')
const {
  sendOtp,
  verifyOtp,
  completeSignup,
  login,
  adminLogin,
  forgotPassword,
  resetPassword,
  logout,
  getMe,
} = require('../controllers/authController')

router.post('/otp/send', sendOtp)
router.post('/otp/verify', verifyOtp)
router.post('/otp/complete', completeSignup)
router.post('/login', login)
router.post('/admin-login', adminLogin)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)
router.post('/logout', logout)
router.get('/me', protect, getMe)

module.exports = router

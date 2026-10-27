const router = require('express').Router()
const { optionalAuth, protect } = require('../middleware/auth')
const { verifyPayment, getPaymentConfig, confirmMockPayment } = require('../controllers/paymentController')

router.get('/config', getPaymentConfig)
router.post('/verify', optionalAuth, verifyPayment)
router.post('/mock', protect, confirmMockPayment)

module.exports = router

const router = require('express').Router()
const { protect, authorize } = require('../middleware/auth')
const {
  getPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  validatePromoCode,
} = require('../controllers/promoCodeController')

router.post('/validate', validatePromoCode)

router.get('/', protect, authorize('admin', 'staff'), getPromoCodes)
router.post('/', protect, authorize('admin', 'staff'), createPromoCode)
router.patch('/:id', protect, authorize('admin', 'staff'), updatePromoCode)
router.delete('/:id', protect, authorize('admin'), deletePromoCode)

module.exports = router

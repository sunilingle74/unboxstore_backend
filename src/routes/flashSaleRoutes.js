const router = require('express').Router()
const { protect, authorize } = require('../middleware/auth')
const {
  getFlashSales,
  getActiveFlashSale,
  createFlashSale,
  updateFlashSale,
  deleteFlashSale,
} = require('../controllers/flashSaleController')

router.get('/active', getActiveFlashSale)

router.get('/', protect, authorize('admin', 'staff'), getFlashSales)
router.post('/', protect, authorize('admin', 'staff'), createFlashSale)
router.patch('/:id', protect, authorize('admin', 'staff'), updateFlashSale)
router.delete('/:id', protect, authorize('admin'), deleteFlashSale)

module.exports = router

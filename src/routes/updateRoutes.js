const router = require('express').Router()
const { protect, authorize } = require('../middleware/auth')
const { getUpdates, createUpdate, deleteUpdate } = require('../controllers/updateController')

router.get('/', getUpdates)
router.post('/', protect, authorize('admin', 'staff'), createUpdate)
router.delete('/:id', protect, authorize('admin'), deleteUpdate)

module.exports = router

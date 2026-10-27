const router = require('express').Router()
const { protect, authorize } = require('../middleware/auth')
const upload = require('../middleware/upload')
const { getBanners, createBanner, updateBanner, deleteBanner } = require('../controllers/bannerController')

router.get('/', getBanners)
router.post('/', protect, authorize('admin', 'staff'), upload.single('image'), createBanner)
router.patch('/:id', protect, authorize('admin', 'staff'), upload.single('image'), updateBanner)
router.delete('/:id', protect, authorize('admin'), deleteBanner)

module.exports = router

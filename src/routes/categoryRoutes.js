const router = require('express').Router()
const { protect, authorize } = require('../middleware/auth')
const upload = require('../middleware/upload')
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController')

router.get('/', getCategories)
router.get('/:idOrSlug', getCategory)

router.post('/', protect, authorize('admin', 'staff'), upload.single('image'), createCategory)
router.patch('/:id', protect, authorize('admin', 'staff'), upload.single('image'), updateCategory)
router.delete('/:id', protect, authorize('admin'), deleteCategory)

module.exports = router

const router = require('express').Router()
const { protect, authorize } = require('../middleware/auth')
const upload = require('../middleware/upload')
const {
  getCollections,
  getCollection,
  getCollectionProducts,
  createCollection,
  updateCollection,
  deleteCollection,
} = require('../controllers/collectionController')

router.get('/', getCollections)
router.get('/:idOrSlug', getCollection)
router.get('/:idOrSlug/products', getCollectionProducts)

router.post('/', protect, authorize('admin', 'staff'), upload.single('image'), createCollection)
router.patch('/:id', protect, authorize('admin', 'staff'), upload.single('image'), updateCollection)
router.delete('/:id', protect, authorize('admin'), deleteCollection)

module.exports = router

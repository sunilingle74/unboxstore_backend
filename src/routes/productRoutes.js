const router = require('express').Router()
const { protect, authorize } = require('../middleware/auth')
const upload = require('../middleware/upload')
const {
  getProducts,
  getProductsAdmin,
  getProductByIdAdmin,
  getFeaturedProducts,
  getNewArrivals,
  getBestSellers,
  searchProducts,
  getProductBySlug,
  getRelatedProducts,
  createProduct,
  updateProduct,
  toggleFeatured,
  deleteProduct,
  deleteProductImage,
} = require('../controllers/productController')

router.get('/', getProducts)
router.get('/admin', protect, authorize('admin', 'staff'), getProductsAdmin)
router.get('/admin/:id', protect, authorize('admin', 'staff'), getProductByIdAdmin)
router.get('/featured', getFeaturedProducts)
router.get('/new-arrivals', getNewArrivals)
router.get('/best-sellers', getBestSellers)
router.get('/search', searchProducts)

router.post('/', protect, authorize('admin', 'staff'), upload.array('images', 6), createProduct)
router.patch('/:id/featured', protect, authorize('admin', 'staff'), toggleFeatured)
router.patch('/:id', protect, authorize('admin', 'staff'), upload.array('images', 6), updateProduct)
router.delete('/:id/images/:publicId', protect, authorize('admin', 'staff'), deleteProductImage)
router.delete('/:id', protect, authorize('admin'), deleteProduct)

router.get('/:slug', getProductBySlug)
router.get('/:slug/related', getRelatedProducts)

module.exports = router

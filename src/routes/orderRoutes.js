const router = require('express').Router()
const { protect, authorize, optionalAuth } = require('../middleware/auth')
const { checkout, getMyOrders, getOrders, getOrder, updateOrderStatus, downloadMyInvoice } = require('../controllers/orderController')
const { shipOrder, trackOrder } = require('../controllers/shipmentController')

router.post('/checkout', optionalAuth, checkout)
router.get('/mine', protect, getMyOrders)
router.get('/', protect, authorize('admin', 'staff'), getOrders)
router.get('/:id', protect, getOrder)
router.get('/:id/invoice', protect, downloadMyInvoice)
router.patch('/:id/status', protect, authorize('admin', 'staff'), updateOrderStatus)
router.post('/:id/ship', protect, authorize('admin', 'staff'), shipOrder)
router.get('/:id/track', protect, trackOrder)

module.exports = router

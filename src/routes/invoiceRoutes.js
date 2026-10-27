const router = require('express').Router()
const { protect, authorize } = require('../middleware/auth')
const { getInvoices, getInvoice, downloadInvoicePdf } = require('../controllers/invoiceController')

router.use(protect, authorize('admin', 'staff'))
router.get('/', getInvoices)
router.get('/:id', getInvoice)
router.get('/:id/pdf', downloadInvoicePdf)

module.exports = router

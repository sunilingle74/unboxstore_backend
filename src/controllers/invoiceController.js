const asyncHandler = require('../middleware/asyncHandler')
const ApiError = require('../utils/ApiError')
const Invoice = require('../models/Invoice')
const { pipeInvoicePdf } = require('../utils/invoicePdf')

// GET /api/invoices (admin)
const getInvoices = asyncHandler(async (req, res) => {
  const invoices = await Invoice.find().populate('order', 'orderNumber items total').sort({ createdAt: -1 })
  res.json({ success: true, invoices })
})

// GET /api/invoices/:id
const getInvoice = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id).populate('order')
  if (!invoice) throw new ApiError(404, 'Invoice not found')
  res.json({ success: true, invoice })
})

// GET /api/invoices/:id/pdf
const downloadInvoicePdf = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id).populate('order')
  if (!invoice) throw new ApiError(404, 'Invoice not found')
  pipeInvoicePdf(res, invoice, invoice.order)
})

module.exports = { getInvoices, getInvoice, downloadInvoicePdf }

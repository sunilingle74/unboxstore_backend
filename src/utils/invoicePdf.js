const PDFDocument = require('pdfkit')

// pdfkit's built-in Helvetica has no ₹ glyph, so amounts use "Rs."
const money = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`

function renderInvoice(doc, invoice, order) {
  doc.fontSize(22).text('unboxstore', { continued: true }).fontSize(10).text('  Tax Invoice', { align: 'right' })
  doc.moveDown()
  doc.fontSize(10).fillColor('#666')
  doc.text(`Invoice: ${invoice.invoiceNumber}`)
  doc.text(`Date: ${invoice.createdAt.toDateString()}`)
  doc.text(`Order: ${order?.orderNumber || '-'}`)
  doc.text(`Billed to: ${invoice.customer}${invoice.email ? ` (${invoice.email})` : ''}`)
  if (order?.shippingAddress) {
    const a = order.shippingAddress
    doc.text(`Ship to: ${a.addressLine}, ${a.city}, ${a.state} ${a.pincode} · ${a.phone}`)
  }
  doc.moveDown()

  doc.fillColor('#000').fontSize(11).text('Items', { underline: true })
  doc.moveDown(0.5)
  ;(order?.items || []).forEach((item) => {
    doc.fontSize(10).text(`${item.name}  (${item.color || '-'}/${item.size || '-'})  x${item.quantity}`, { continued: true })
    doc.text(money(item.price * item.quantity), { align: 'right' })
  })

  if (order) {
    doc.moveDown()
    const line = (label, value) => doc.fontSize(10).text(`${label}: ${value}`, { align: 'right' })
    line('Subtotal', money(order.subtotal))
    if (order.discount) line('Discount', `-${money(order.discount)}`)
    line('Shipping', order.shipping ? money(order.shipping) : 'Free')
    line('Tax (5%)', money(order.tax))
    if (order.codFee) line('COD fee', money(order.codFee))
  }
  doc.moveDown(0.5)
  doc.fontSize(12).text(`Total: ${money(invoice.amount)}`, { align: 'right' })
  doc.fontSize(10).fillColor('#666').text(`Status: ${invoice.status}`, { align: 'right' })
  if (order?.paymentMethod) {
    doc.text(`Payment: ${order.paymentMethod === 'COD' ? 'Cash on delivery' : 'Online (Razorpay)'}`, { align: 'right' })
    doc.text(`Paid online: ${money(order.amountPaid)}`, { align: 'right' })
    const due = order.total - (order.amountPaid || 0)
    if (due > 0) doc.text(`Due on delivery: ${money(due)}`, { align: 'right' })
  }
}

// Streams the invoice straight into an HTTP response.
function pipeInvoicePdf(res, invoice, order) {
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename=${invoice.invoiceNumber}.pdf`)
  const doc = new PDFDocument({ margin: 50 })
  doc.pipe(res)
  renderInvoice(doc, invoice, order)
  doc.end()
}

// Builds the invoice in memory, for email attachments.
function buildInvoicePdf(invoice, order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    renderInvoice(doc, invoice, order)
    doc.end()
  })
}

module.exports = { pipeInvoicePdf, buildInvoicePdf }

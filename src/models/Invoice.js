const mongoose = require('mongoose')

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    customer: String,
    email: String,
    amount: { type: Number, required: true },
    status: { type: String, enum: ['Unpaid', 'Paid', 'Refunded'], default: 'Unpaid' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Invoice', invoiceSchema)

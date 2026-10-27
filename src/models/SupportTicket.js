const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema(
  {
    from: { type: String, enum: ['customer', 'admin'], required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

const supportTicketSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    customer: { type: String, required: true },
    email: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    status: { type: String, enum: ['Open', 'In Progress', 'Resolved'], default: 'Open' },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true }
)

module.exports = mongoose.model('SupportTicket', supportTicketSchema)

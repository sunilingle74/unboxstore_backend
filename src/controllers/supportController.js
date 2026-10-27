const asyncHandler = require('../middleware/asyncHandler')
const ApiError = require('../utils/ApiError')
const SupportTicket = require('../models/SupportTicket')

// GET /api/support (admin)
const getTickets = asyncHandler(async (req, res) => {
  const filter = {}
  if (req.query.status) filter.status = req.query.status
  const tickets = await SupportTicket.find(filter).sort({ createdAt: -1 })
  res.json({ success: true, tickets })
})

// GET /api/support/mine (customer)
const getMyTickets = asyncHandler(async (req, res) => {
  const tickets = await SupportTicket.find({ user: req.user._id }).sort({ createdAt: -1 })
  res.json({ success: true, tickets })
})

// GET /api/support/:id
const getTicket = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id)
  if (!ticket) throw new ApiError(404, 'Ticket not found')
  res.json({ success: true, ticket })
})

// POST /api/support (public/customer)
const createTicket = asyncHandler(async (req, res) => {
  const { subject, customer, email, message, priority, orderId } = req.body
  if (!subject || !customer || !email || !message) {
    throw new ApiError(400, 'Subject, name, email and message are required')
  }

  const ticket = await SupportTicket.create({
    subject,
    customer,
    email,
    priority,
    order: orderId || undefined,
    user: req.user?._id,
    messages: [{ from: 'customer', text: message }],
  })
  res.status(201).json({ success: true, ticket })
})

// POST /api/support/:id/messages
const addMessage = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id)
  if (!ticket) throw new ApiError(404, 'Ticket not found')

  const from = req.user?.role === 'admin' || req.user?.role === 'staff' ? 'admin' : 'customer'
  ticket.messages.push({ from, text: req.body.text })
  if (from === 'admin' && ticket.status === 'Open') ticket.status = 'In Progress'
  await ticket.save()
  res.json({ success: true, ticket })
})

// PATCH /api/support/:id (admin) — status/priority
const updateTicket = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id)
  if (!ticket) throw new ApiError(404, 'Ticket not found')

  if (req.body.status) ticket.status = req.body.status
  if (req.body.priority) ticket.priority = req.body.priority
  await ticket.save()
  res.json({ success: true, ticket })
})

module.exports = { getTickets, getMyTickets, getTicket, createTicket, addMessage, updateTicket }

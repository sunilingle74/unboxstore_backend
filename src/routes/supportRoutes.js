const router = require('express').Router()
const { protect, authorize, optionalAuth } = require('../middleware/auth')
const { getTickets, getMyTickets, getTicket, createTicket, addMessage, updateTicket } = require('../controllers/supportController')

router.post('/', optionalAuth, createTicket)
router.get('/mine', protect, getMyTickets)
router.get('/', protect, authorize('admin', 'staff'), getTickets)
router.get('/:id', protect, getTicket)
router.post('/:id/messages', protect, addMessage)
router.patch('/:id', protect, authorize('admin', 'staff'), updateTicket)

module.exports = router

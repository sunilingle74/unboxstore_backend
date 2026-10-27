const asyncHandler = require('../middleware/asyncHandler')
const ApiError = require('../utils/ApiError')
const NewsletterSubscriber = require('../models/NewsletterSubscriber')
const { sendMailSafe } = require('../services/mailService')
const emails = require('../utils/emailTemplates')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// POST /api/newsletter — { email, source }
// Re-subscribing is a no-op success, so the form never reveals who is on the list.
const subscribe = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) throw new ApiError(400, 'Enter a valid email address')
  const source = req.body.source === 'popup' ? 'popup' : 'footer'

  const result = await NewsletterSubscriber.updateOne({ email }, { $setOnInsert: { email, source } }, { upsert: true })
  if (result.upsertedCount) sendMailSafe({ to: email, ...emails.newsletterWelcome() })

  res.status(201).json({ success: true, message: "You're on the list." })
})

module.exports = { subscribe }

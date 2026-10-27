const fs = require('fs')
const os = require('os')
const path = require('path')
const nodemailer = require('nodemailer')
const { runInBackground } = require('../utils/background')

// Without SMTP credentials (local dev / tests) mail is written to an outbox
// folder as .eml files instead of being sent, so flows stay testable offline.
// Vercel's filesystem is read-only apart from /tmp.
const OUTBOX_DIR =
  process.env.MAIL_OUTBOX_DIR || (process.env.VERCEL ? path.join(os.tmpdir(), 'outbox') : path.join(__dirname, '../../tmp/outbox'))
const smtpConfigured = Boolean(process.env.SMTP_HOST)

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' })

const FROM = process.env.MAIL_FROM || 'unboxstore <no-reply@unboxstore.in>'

async function sendMail({ to, subject, html, text, attachments }) {
  if (!to) return null
  const info = await transporter.sendMail({ from: FROM, to, subject, html, text, attachments })

  if (!smtpConfigured) {
    fs.mkdirSync(OUTBOX_DIR, { recursive: true })
    const safeSubject = subject.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)
    const file = path.join(OUTBOX_DIR, `${Date.now()}-${safeSubject}.eml`)
    fs.writeFileSync(file, info.message)
    console.log(`[mail] SMTP not configured — wrote "${subject}" for ${to} to ${file}`)
  }
  return info
}

// Fire-and-forget wrapper: email failures are logged but never fail the request.
function sendMailSafe(message) {
  return runInBackground(
    sendMail(message).catch((err) => console.error(`[mail] Failed to send "${message.subject}":`, err.message))
  )
}

module.exports = { sendMail, sendMailSafe }

const axios = require('axios')

// Twilio when configured; otherwise the code is only logged to the server
// console (dev) and surfaced to the client as `devCode` by the auth controller.
const twilioConfigured = Boolean(
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER
)

function isSmsConfigured() {
  return twilioConfigured
}

async function sendSms(phone, body) {
  const to = `+91${phone}`
  if (!twilioConfigured) {
    console.log(`[sms] SMS provider not configured — message for ${to}: ${body}`)
    return
  }

  const sid = process.env.TWILIO_ACCOUNT_SID
  await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    new URLSearchParams({ To: to, From: process.env.TWILIO_FROM_NUMBER, Body: body }),
    { auth: { username: sid, password: process.env.TWILIO_AUTH_TOKEN } }
  )
}

module.exports = { sendSms, isSmsConfigured }

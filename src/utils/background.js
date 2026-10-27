const { waitUntil } = require('@vercel/functions')

// Work that shouldn't delay the response (emails, courier booking). On Vercel
// the function can be frozen once the response is sent, so the promise is
// handed to waitUntil to keep it alive; locally it simply runs.
function runInBackground(promise) {
  const safe = Promise.resolve(promise).catch((err) => console.error('[background]', err.message))
  if (process.env.VERCEL) waitUntil(safe)
  return safe
}

module.exports = { runInBackground }

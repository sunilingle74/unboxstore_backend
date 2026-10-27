// "Local development" means: not NODE_ENV=production AND not running on
// Vercel. Dev conveniences (simulated payments, OTP codes in API responses,
// stack traces) depend on this, so a deployment that forgets NODE_ENV still
// never exposes them.
function isLocalDev() {
  return process.env.NODE_ENV !== 'production' && !process.env.VERCEL
}

module.exports = { isLocalDev }

// Vercel serverless entry: every request is rewritten here (see vercel.json).
// Env vars come from the Vercel project settings, not .env.
const app = require('../src/app')
const connectDB = require('../src/config/db')

module.exports = async function handler(req, res) {
  try {
    await connectDB()
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message)
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ success: false, message: 'Service temporarily unavailable' }))
    return
  }
  return app(req, res)
}

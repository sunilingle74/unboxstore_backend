const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const morgan = require('morgan')

const routes = require('./routes')
const { isLocalDev } = require('./config/env')
const { notFound, errorHandler } = require('./middleware/errorHandler')
const { razorpayWebhook } = require('./controllers/paymentController')

// The Express app without a listener, so it can run under `node server.js`
// locally or as a Vercel serverless function (api/index.js).
const app = express()

app.set('trust proxy', 1) // behind Vercel's proxy: correct req.ip / secure cookies

// Updated CORS configuration to allow ANY origin while supporting credentials
app.use(
  cors({
    origin: (origin, callback) => {
      // By returning true for the origin, it dynamically reflects the 
      // requesting origin in the Access-Control-Allow-Origin header.
      callback(null, true);
    },
    credentials: true,
  })
)

app.use(cookieParser())
if (isLocalDev()) app.use(morgan('dev'))

// Razorpay needs the raw request body to verify the webhook signature, so this
// route is mounted before the global JSON body parser.
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), razorpayWebhook)

app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

app.get('/api/health', (req, res) => res.json({ success: true, message: 'Atelier API is running' }))
app.use('/api', routes)

app.use(notFound)
app.use(errorHandler)

module.exports = app
const { isLocalDev } = require('../config/env')

function notFound(req, res, next) {
  res.status(404)
  next(new Error(`Route not found — ${req.method} ${req.originalUrl}`))
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500)
  let message = err.message || 'Server error'

  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404
    message = 'Resource not found'
  }

  if (err.code === 11000) {
    statusCode = 409
    const field = Object.keys(err.keyValue || {})[0]
    message = field ? `${field} already exists` : 'Duplicate value'
  }

  if (err.name === 'ValidationError') {
    statusCode = 400
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ')
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: isLocalDev() ? err.stack : undefined,
  })
}

module.exports = { notFound, errorHandler }

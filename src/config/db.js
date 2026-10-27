const mongoose = require('mongoose')

// Serverless instances are reused between requests, so the connection (and an
// in-flight connect) is cached instead of reconnecting every time.
let connecting = null

async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set')

  mongoose.set('strictQuery', true)
  connecting ||= mongoose
    .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 })
    .then((conn) => {
      console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`)
      return conn.connection
    })
    .catch((err) => {
      connecting = null // let the next request retry
      throw err
    })
  return connecting
}

module.exports = connectDB

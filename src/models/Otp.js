const mongoose = require('mongoose')

const otpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
)

// Mongo removes expired codes on its own.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model('Otp', otpSchema)

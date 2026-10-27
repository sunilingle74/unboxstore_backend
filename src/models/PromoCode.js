const mongoose = require('mongoose')

const promoCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: ['Percent', 'Flat', 'Shipping'], required: true },
    value: { type: Number, default: 0 }, // percent (0-100) or flat amount; ignored for Shipping
    minOrderValue: { type: Number, default: 0 },
    usageLimit: { type: Number, default: 0 }, // 0 = unlimited
    usedCount: { type: Number, default: 0 },
    expiresAt: Date,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
)

promoCodeSchema.virtual('status').get(function status() {
  if (!this.active) return 'Expired'
  if (this.expiresAt && this.expiresAt < new Date()) return 'Expired'
  if (this.usageLimit && this.usedCount >= this.usageLimit) return 'Expired'
  if (this.usageLimit && this.usedCount / this.usageLimit >= 0.9) return 'Expiring'
  return 'Active'
})
promoCodeSchema.set('toJSON', { virtuals: true })
promoCodeSchema.set('toObject', { virtuals: true })

module.exports = mongoose.model('PromoCode', promoCodeSchema)

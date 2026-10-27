const mongoose = require('mongoose')

const flashSaleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    discountPercent: { type: Number, required: true, min: 1, max: 90 },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
  },
  { timestamps: true }
)

flashSaleSchema.virtual('status').get(function status() {
  const now = new Date()
  if (now < this.startsAt) return 'Scheduled'
  if (now > this.endsAt) return 'Ended'
  return 'Live'
})
flashSaleSchema.set('toJSON', { virtuals: true })
flashSaleSchema.set('toObject', { virtuals: true })

module.exports = mongoose.model('FlashSale', flashSaleSchema)

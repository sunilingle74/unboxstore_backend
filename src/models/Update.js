const mongoose = require('mongoose')

const updateSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    tag: { type: String, enum: ['Feature', 'Fix', 'Improvement'], default: 'Feature' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Update', updateSchema)

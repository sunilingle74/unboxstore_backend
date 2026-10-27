const mongoose = require('mongoose')

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 100000 },
})

const Counter = mongoose.model('Counter', counterSchema)

async function nextSequence(name) {
  // Two steps so a brand-new counter starts at the schema default (100000):
  // $inc and a same-path $setOnInsert can't be combined in a single upsert.
  await Counter.updateOne({ _id: name }, { $setOnInsert: { seq: 100000 } }, { upsert: true })
  const counter = await Counter.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true })
  return counter.seq
}

module.exports = { Counter, nextSequence }

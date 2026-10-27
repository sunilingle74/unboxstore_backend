// Creates (or repairs) the admin login from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
// without touching any other data — safe to run against a live database.
require('dotenv').config()
const mongoose = require('mongoose')
const connectDB = require('../config/db')
const User = require('../models/User')

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase()
  const password = process.env.SEED_ADMIN_PASSWORD
  if (!email || !password) throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD')
  if (password.length < 6) throw new Error('SEED_ADMIN_PASSWORD must be at least 6 characters')

  let user = await User.findOne({ email }).select('+password')
  const created = !user
  if (!user) user = new User({ name: 'Admin', email })
  user.password = password // re-hashed by the model's pre-save hook
  user.role = 'admin'
  user.status = 'Active'
  await user.save()
  return { email, created }
}

connectDB()
  .then(seedAdmin)
  .then(({ email, created }) => {
    console.log(`${created ? 'Created' : 'Updated'} admin login: ${email}`)
    return mongoose.disconnect()
  })
  .catch((err) => {
    console.error(err.message)
    process.exit(1)
  })

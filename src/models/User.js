const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const addressSchema = new mongoose.Schema(
  {
    fullName: String,
    phone: { type: String, unique: true, sparse: true, trim: true },
    phoneVerified: { type: Boolean, default: false },
    resetPasswordTokenHash: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    addressLine: String,
    city: String,
    state: String,
    pincode: String,
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
)

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Customers sign in with their mobile number (OTP); email is collected for
    // invoices and order updates, and a password is optional (email sign-in).
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, minlength: 6, select: false },
    role: { type: String, enum: ['customer', 'staff', 'admin'], default: 'customer' },
    status: { type: String, enum: ['Active', 'Suspended'], default: 'Active' },
    phone: { type: String, unique: true, sparse: true, trim: true },
    phoneVerified: { type: Boolean, default: false },
    resetPasswordTokenHash: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    addresses: [addressSchema],
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  },
  { timestamps: true }
)

userSchema.virtual('orderCount', {
  ref: 'Order',
  localField: '_id',
  foreignField: 'user',
  count: true,
})
userSchema.set('toJSON', { virtuals: true })
userSchema.set('toObject', { virtuals: true })

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password') || !this.password) return next()
  this.password = await bcrypt.hash(this.password, 10)
  next()
})

userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return Promise.resolve(false)
  return bcrypt.compare(candidate, this.password)
}

module.exports = mongoose.model('User', userSchema)

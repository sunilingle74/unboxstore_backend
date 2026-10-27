const mongoose = require('mongoose')

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: String,
    image: String,
    price: Number,
    size: String,
    color: String,
    quantity: { type: Number, min: 1 },
  },
  { _id: false }
)

const addressSchema = new mongoose.Schema(
  {
    fullName: String,
    phone: String,
    addressLine: String,
    city: String,
    state: String,
    pincode: String,
  },
  { _id: false }
)

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    email: String,
    items: { type: [orderItemSchema], required: true },
    shippingAddress: { type: addressSchema, required: true },

    promoCode: String,
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    codFee: { type: Number, default: 0 },
    total: { type: Number, required: true },

    paymentMethod: { type: String, enum: ['Razorpay', 'COD'], default: 'Razorpay' },
    // What the customer picked at checkout (upi / card / netbanking / cod).
    paymentOption: { type: String, enum: ['upi', 'card', 'netbanking', 'cod'] },
    // Online amount collected so far: the full total, or just the COD fee.
    amountPaid: { type: Number, default: 0 },
    // True until the online payment (or COD fee) is captured; such orders are
    // not yet confirmed — no stock reserved, invoice or emails.
    awaitingPayment: { type: Boolean, default: false },
    confirmedAt: Date,
    paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Refunded', 'Failed'], default: 'Pending' },
    razorpay: {
      orderId: String,
      paymentId: String,
      signature: String,
    },

    status: {
      type: String,
      enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled'],
      default: 'Processing',
    },
    cancelReason: String,

    shiprocket: {
      shipmentId: String,
      orderId: String,
      awbCode: String,
      courierName: String,
      trackingStatus: String,
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Order', orderSchema)

const axios = require('axios')

const BASE_URL = 'https://apiv2.shiprocket.in/v1/external'

let cachedToken = null
let tokenFetchedAt = 0
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000 // Shiprocket tokens are valid ~10 days

async function getToken() {
  if (cachedToken && Date.now() - tokenFetchedAt < TOKEN_TTL_MS) {
    return cachedToken
  }

  const { data } = await axios.post(`${BASE_URL}/auth/login`, {
    email: process.env.SHIPROCKET_EMAIL,
    password: process.env.SHIPROCKET_PASSWORD,
  })

  cachedToken = data.token
  tokenFetchedAt = Date.now()
  return cachedToken
}

async function authedClient() {
  const token = await getToken()
  return axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${token}` },
  })
}

// order: our Order mongoose document (populated with items + shippingAddress)
async function createShipment(order) {
  const client = await authedClient()

  const payload = {
    order_id: String(order.orderNumber),
    order_date: new Date(order.createdAt).toISOString().slice(0, 19).replace('T', ' '),
    pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary',
    billing_customer_name: order.shippingAddress.fullName,
    billing_last_name: '',
    billing_address: order.shippingAddress.addressLine,
    billing_city: order.shippingAddress.city,
    billing_pincode: order.shippingAddress.pincode,
    billing_state: order.shippingAddress.state,
    billing_country: 'India',
    billing_email: order.email,
    billing_phone: order.shippingAddress.phone,
    shipping_is_billing: true,
    order_items: order.items.map((item) => ({
      name: item.name,
      sku: `${item.productId}-${item.size}-${item.color}`.toUpperCase(),
      units: item.quantity,
      selling_price: item.price,
    })),
    payment_method: order.paymentMethod === 'COD' ? 'COD' : 'Prepaid',
    sub_total: order.subtotal,
    length: 20,
    breadth: 15,
    height: 5,
    weight: Math.max(0.5, order.items.reduce((sum, i) => sum + i.quantity, 0) * 0.3),
  }

  const { data } = await client.post('/orders/create/adhoc', payload)
  return data // contains shipment_id, order_id, status
}

async function trackShipment(awbCode) {
  const client = await authedClient()
  const { data } = await client.get(`/courier/track/awb/${awbCode}`)
  return data
}

async function cancelShipment(shiprocketOrderId) {
  const client = await authedClient()
  const { data } = await client.post('/orders/cancel', { ids: [shiprocketOrderId] })
  return data
}

async function checkServiceability({ pickupPincode, deliveryPincode, weight = 0.5, cod = 0 }) {
  const client = await authedClient()
  const { data } = await client.get('/courier/serviceability/', {
    params: {
      pickup_postcode: pickupPincode,
      delivery_postcode: deliveryPincode,
      weight,
      cod,
    },
  })
  return data
}

module.exports = {
  getToken,
  createShipment,
  trackShipment,
  cancelShipment,
  checkServiceability,
}

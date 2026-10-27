const asyncHandler = require('../middleware/asyncHandler')
const Order = require('../models/Order')
const User = require('../models/User')
const Product = require('../models/Product')

function pctChange(current, previous) {
  if (!previous) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function monthRange(offset = 0) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1)
  const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1)
  return { start, end }
}

// GET /api/dashboard (admin)
const getDashboard = asyncHandler(async (req, res) => {
  const notCancelled = { status: { $ne: 'Cancelled' } }
  const thisMonth = monthRange(0)
  const lastMonth = monthRange(1)

  const [
    revenueAgg,
    revenueThisMonth,
    revenueLastMonth,
    ordersThisMonth,
    ordersLastMonth,
    totalOrders,
    totalCustomers,
    customersThisMonth,
    customersLastMonth,
    orderStatusAgg,
    revenueTrendAgg,
    recentOrders,
    bestSellers,
  ] = await Promise.all([
    Order.aggregate([{ $match: notCancelled }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    Order.aggregate([
      { $match: { ...notCancelled, createdAt: { $gte: thisMonth.start, $lt: thisMonth.end } } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
    Order.aggregate([
      { $match: { ...notCancelled, createdAt: { $gte: lastMonth.start, $lt: lastMonth.end } } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
    Order.countDocuments({ ...notCancelled, createdAt: { $gte: thisMonth.start, $lt: thisMonth.end } }),
    Order.countDocuments({ ...notCancelled, createdAt: { $gte: lastMonth.start, $lt: lastMonth.end } }),
    Order.countDocuments(notCancelled),
    User.countDocuments({ role: 'customer' }),
    User.countDocuments({ role: 'customer', createdAt: { $gte: thisMonth.start, $lt: thisMonth.end } }),
    User.countDocuments({ role: 'customer', createdAt: { $gte: lastMonth.start, $lt: lastMonth.end } }),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { ...notCancelled, createdAt: { $gte: monthRange(11).start } } },
      {
        $group: {
          _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
          total: { $sum: '$total' },
        },
      },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]),
    Order.find().sort({ createdAt: -1 }).limit(5),
    Product.find().sort({ sold: -1 }).limit(5),
  ])

  const revenue = revenueAgg[0]?.total || 0
  const revenueThis = revenueThisMonth[0]?.total || 0
  const revenuePrev = revenueLastMonth[0]?.total || 0

  const statusMap = Object.fromEntries(orderStatusAgg.map((s) => [s._id, s.count]))

  // Build a 12-point trend, filling months with no orders as 0.
  const trend = []
  for (let i = 11; i >= 0; i--) {
    const { start } = monthRange(i)
    const match = revenueTrendAgg.find((r) => r._id.y === start.getFullYear() && r._id.m === start.getMonth() + 1)
    trend.push({ month: start.toLocaleString('en-IN', { month: 'short' }), total: match?.total || 0 })
  }

  res.json({
    success: true,
    stats: {
      revenue,
      revenueChange: pctChange(revenueThis, revenuePrev),
      orders: totalOrders,
      ordersChange: pctChange(ordersThisMonth, ordersLastMonth),
      customers: totalCustomers,
      customersChange: pctChange(customersThisMonth, customersLastMonth),
      aov: totalOrders ? Math.round(revenue / totalOrders) : 0,
    },
    orderStatus: {
      Processing: statusMap.Processing || 0,
      Shipped: statusMap.Shipped || 0,
      Delivered: statusMap.Delivered || 0,
      Cancelled: statusMap.Cancelled || 0,
    },
    revenueTrend: trend,
    recentOrders,
    bestSellers,
  })
})

module.exports = { getDashboard }

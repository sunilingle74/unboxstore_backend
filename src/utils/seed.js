require('dotenv').config()
const connectDB = require('../config/db')
const User = require('../models/User')
const Category = require('../models/Category')
const Collection = require('../models/Collection')
const Product = require('../models/Product')
const PromoCode = require('../models/PromoCode')
const { CATEGORY_NAMES, slugify } = require('./catalogueCategories')


// UnboxStore launches a new themed collection every month or two, spanning
// whatever product types fit the theme (not tied to a single category).
const COLLECTIONS = [
  { name: 'VES', description: 'Polos, shirts, bags and shoes for the everyday uniform.', status: 'Active' },
  { name: 'Aware', description: 'A climate-aware future — hoodies made from recycled fibers.', status: 'Active' },
]

const COLOR_POOL = [
  { name: 'Black', hex: '#1a1a1a' },
  { name: 'Stone', hex: '#c9beac' },
  { name: 'Navy', hex: '#1f2a44' },
  { name: 'Olive', hex: '#5b5d40' },
]

async function run() {
  await connectDB()

  console.log('Clearing existing catalog + promo codes...')
  await Promise.all([
    Product.deleteMany({}),
    Category.deleteMany({}),
    Collection.deleteMany({}),
    PromoCode.deleteMany({}),
  ])

  console.log('Seeding categories...')
  const categories = await Category.insertMany(
    CATEGORY_NAMES.map((name) => ({ name, slug: slugify(name), status: 'Active' }))
  )

  console.log('Seeding collections...')
  const collections = await Collection.insertMany(
    COLLECTIONS.map((c) => ({ ...c, slug: slugify(c.name) }))
  )

  console.log('Seeding products...')
  const products = []
  categories.forEach((category, ci) => {
    for (let i = 0; i < 3; i++) {
      const name = `${category.name.split(' ')[0]} Essential ${i + 1}`
      const price = 40 + ((ci * 3 + i) % 10) * 25
      // Loosely sprinkle a couple of categories into each seasonal collection.
      const collection = ci % 6 === 0 ? collections[0]._id : ci % 6 === 3 ? collections[1]._id : undefined

      products.push({
        name,
        slug: `${slugify(name)}-${ci}${i}`,
        sku: `${slugify(name).toUpperCase()}-${ci}${i}`,
        category: category._id,
        collection,
        price,
        description: `A refined ${name.toLowerCase()} cut from premium materials, designed for everyday wear.`,
        details: ['Premium materials', 'Regular fit — true to size', 'Ethically manufactured'],
        images: [
          { url: `https://picsum.photos/seed/${category.slug}-${i}/800/1000` },
          { url: `https://picsum.photos/seed/${category.slug}-${i}-b/800/1000` },
        ],
        sizes: ['S', 'M', 'L', 'XL'],
        colors: COLOR_POOL.slice(0, 2 + (i % 2)),
        stockCount: (i * 7) % 30,
        isFeatured: i === 0,
        isNewArrival: i === 1,
        rating: 4.2,
        reviewCount: 20 + i * 5,
      })
    }
  })
  await Product.insertMany(products)

  console.log('Seeding promo codes...')
  await PromoCode.insertMany([
    { code: 'WELCOME10', type: 'Percent', value: 10, minOrderValue: 0, usageLimit: 1000 },
    { code: 'FREESHIP', type: 'Shipping', value: 0, minOrderValue: 0, usageLimit: 500 },
  ])

  console.log('Seeding admin user...')
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@atelier.com'
  const existingAdmin = await User.findOne({ email: adminEmail })
  if (!existingAdmin) {
    await User.create({
      name: 'Admin User',
      email: adminEmail,
      password: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',
      role: 'admin',
    })
  }

  console.log(`Done — ${categories.length} categories, ${collections.length} collections, ${products.length} products.`)
  console.log(`Admin login: ${adminEmail} / ${process.env.SEED_ADMIN_PASSWORD || 'Admin@12345'}`)
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})

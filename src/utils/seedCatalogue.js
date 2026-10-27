// Upserts the storefront catalogue (frontend/src/data/catalogue.json) into
// MongoDB so checkout can price and stock-check the same products customers see.
// Safe to re-run: products are matched by slug and stock levels are kept.
require('dotenv').config()
const path = require('path')
const mongoose = require('mongoose')
const connectDB = require('../config/db')
const Category = require('../models/Category')
const Product = require('../models/Product')
const { CATEGORY_NAMES, slugify } = require('./catalogueCategories')

const catalogue = require(path.join(__dirname, '../../../frontend/src/data/catalogue.json'))
const GENDERS = { men: 'Men', women: 'Women', unisex: 'Unisex' }

// Product photos are served by the storefront from /products/<file>. Stored as
// absolute URLs so the admin app (another domain) and emails can load them.
const STOREFRONT_URL = (process.env.STOREFRONT_URL || process.env.CLIENT_URL || '').replace(/\/$/, '')

async function seedCatalogue() {
  const categories = {}
  for (const name of CATEGORY_NAMES) {
    const slug = slugify(name)
    categories[slug] = await Category.findOneAndUpdate(
      { slug },
      { $setOnInsert: { name, slug, status: 'Active' } },
      { upsert: true, new: true }
    )
  }

  for (const item of catalogue) {
    const category = categories[item.category]
    if (!category) throw new Error(`Unknown category "${item.category}" for ${item.slug}`)

    await Product.updateOne(
      { slug: item.slug },
      {
        $set: {
          name: item.name,
          category: category._id,
          description: item.description,
          details: item.details,
          price: item.price,
          originalPrice: item.originalPrice,
          images: item.images.map((file) => ({ url: `${STOREFRONT_URL}/products/${file}` })),
          sizes: item.sizes,
          colors: item.colors,
          gender: GENDERS[item.gender] || 'Unisex',
          isFeatured: item.isFeatured,
          isNewArrival: item.isNewArrival,
          isActive: true,
          rating: item.rating,
          reviewCount: item.reviewCount,
        },
        $setOnInsert: { stockCount: item.stockCount, sku: item.slug.toUpperCase() },
      },
      { upsert: true }
    )
  }
  return catalogue.length
}

if (require.main === module) {
  connectDB()
    .then(seedCatalogue)
    .then((count) => {
      console.log(`Catalogue synced — ${count} products.`)
      return mongoose.disconnect()
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}

module.exports = { seedCatalogue }

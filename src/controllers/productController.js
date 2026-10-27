const asyncHandler = require('../middleware/asyncHandler')
const ApiError = require('../utils/ApiError')
const Product = require('../models/Product')
const Category = require('../models/Category')
const Collection = require('../models/Collection')
const { uploadBuffer, destroyImage } = require('../utils/uploadImage')

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function generateSku(name) {
  const base = name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 20)
  return `${base}-${Date.now().toString(36).toUpperCase().slice(-5)}`
}

// Derives the strikethrough "compare-at" price from a friendlier discount-entry UX,
// so the admin can type "20% off" instead of computing the original price by hand.
function computeOriginalPrice(price, discountType, discountValue) {
  if (!discountType || discountType === 'None' || !discountValue) return undefined
  if (discountType === 'Percent') return Math.round(price / (1 - Math.min(discountValue, 95) / 100))
  if (discountType === 'Flat') return price + Number(discountValue)
  return undefined
}

// Shared query builder used by both the admin table and the storefront listing.
async function buildFilter(query) {
  const { category, categories, collection, sizes, minPrice, maxPrice, inStock, search } = query
  const filter = { isActive: true }

  const categorySlugs = categories ? categories.split(',') : category ? [category] : []
  if (categorySlugs.length) {
    const cats = await Category.find({ slug: { $in: categorySlugs } }).select('_id')
    filter.category = { $in: cats.map((c) => c._id) }
  }

  if (collection) {
    const collectionDoc = await Collection.findOne({ slug: collection }).select('_id')
    filter.collection = collectionDoc?._id || null
  }

  if (sizes) filter.sizes = { $in: sizes.split(',') }
  if (minPrice || maxPrice) {
    filter.price = {}
    if (minPrice) filter.price.$gte = Number(minPrice)
    if (maxPrice) filter.price.$lte = Number(maxPrice)
  }
  if (inStock === '1' || inStock === 'true') filter.stockCount = { $gt: 0 }
  if (search) filter.$text = { $search: search }

  return filter
}

function sortFor(sort) {
  switch (sort) {
    case 'price-asc':
      return { price: 1 }
    case 'price-desc':
      return { price: -1 }
    case 'newest':
      return { createdAt: -1 }
    case 'best-selling':
      return { sold: -1 }
    default:
      return { isFeatured: -1, createdAt: -1 }
  }
}

// GET /api/products
const getProducts = asyncHandler(async (req, res) => {
  const { sort = 'featured', page = 1, limit = 24 } = req.query
  const filter = await buildFilter(req.query)
  const skip = (Number(page) - 1) * Number(limit)

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .populate('collection', 'name slug')
      .sort(sortFor(sort))
      .skip(skip)
      .limit(Number(limit)),
    Product.countDocuments(filter),
  ])

  res.json({ success: true, count: products.length, total, page: Number(page), products })
})

// GET /api/products/admin — full list for the admin table, including inactive/out-of-stock
const getProductsAdmin = asyncHandler(async (req, res) => {
  const { search = '', category, collection } = req.query
  const filter = {}
  if (search) filter.name = new RegExp(search, 'i')
  if (category) filter.category = category
  if (collection) filter.collection = collection

  const products = await Product.find(filter)
    .populate('category', 'name slug')
    .populate('collection', 'name slug')
    .sort({ createdAt: -1 })
  res.json({ success: true, count: products.length, products })
})

// GET /api/products/admin/:id — fetch by Mongo _id, for the admin edit form
// (the public /:slug route below is keyed by slug, not _id)
const getProductByIdAdmin = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('category', 'name slug').populate('collection', 'name slug')
  if (!product) throw new ApiError(404, 'Product not found')
  res.json({ success: true, product })
})

// GET /api/products/featured
const getFeaturedProducts = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 10
  const products = await Product.find({ isFeatured: true, isActive: true }).limit(limit)
  res.json({ success: true, products })
})

// GET /api/products/new-arrivals
const getNewArrivals = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 10
  const products = await Product.find({ isNewArrival: true, isActive: true }).sort({ createdAt: -1 }).limit(limit)
  res.json({ success: true, products })
})

// GET /api/products/best-sellers
const getBestSellers = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 10
  const products = await Product.find({ isActive: true }).sort({ sold: -1 }).limit(limit)
  res.json({ success: true, products })
})

// GET /api/products/search?q=
const searchProducts = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim()
  if (!q) return res.json({ success: true, products: [] })
  const products = await Product.find({ $text: { $search: q }, isActive: true }).limit(8)
  res.json({ success: true, products })
})

// GET /api/products/:slug
const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug })
    .populate('category', 'name slug')
    .populate('collection', 'name slug')
  if (!product) throw new ApiError(404, 'Product not found')
  res.json({ success: true, product })
})

// GET /api/products/:slug/related
const getRelatedProducts = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug })
  if (!product) throw new ApiError(404, 'Product not found')
  const related = await Product.find({ category: product.category, _id: { $ne: product._id }, isActive: true }).limit(4)
  res.json({ success: true, products: related })
})

const OPTIONAL_FIELDS = [
  'shortDescription',
  'description',
  'costPrice',
  'discountType',
  'discountValue',
  'material',
  'gender',
  'weightKg',
  'stockCount',
  'lowStockThreshold',
  'isActive',
  'isFeatured',
  'isNewArrival',
]

function applyOptionalFields(product, body) {
  OPTIONAL_FIELDS.forEach((f) => {
    if (body[f] !== undefined && body[f] !== '') product[f] = body[f]
  })
  if (body.collection !== undefined) product.collection = body.collection || undefined
  if (body.details !== undefined) product.details = parseArrayField(body.details)
  if (body.sizes !== undefined) product.sizes = parseArrayField(body.sizes)
  if (body.colors !== undefined) product.colors = parseColorsField(body.colors)
  if (body.dimensions !== undefined) product.dimensions = parseObjectField(body.dimensions)
  if (body.seo !== undefined) {
    const seo = parseObjectField(body.seo) || {}
    product.seo = { ...seo, tags: parseArrayField(seo.tags) }
  }
}

// POST /api/products (admin)
const createProduct = asyncHandler(async (req, res) => {
  const { name, category, price, sku } = req.body
  if (!name || !category || !price) throw new ApiError(400, 'Name, category and price are required')

  const categoryDoc = await Category.findById(category)
  if (!categoryDoc) throw new ApiError(400, 'Invalid category')

  const images = []
  if (req.files?.length) {
    for (const file of req.files) images.push(await uploadBuffer(file.buffer, 'products'))
  }

  const product = new Product({
    name,
    slug: `${slugify(name)}-${Date.now().toString(36)}`,
    sku: sku?.trim() || generateSku(name),
    category,
    price,
    images,
  })
  applyOptionalFields(product, req.body)

  if (req.body.originalPrice) {
    product.originalPrice = req.body.originalPrice
  } else {
    product.originalPrice = computeOriginalPrice(product.price, product.discountType, product.discountValue)
  }

  await product.save()
  res.status(201).json({ success: true, product })
})

// PATCH /api/products/:id (admin)
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
  if (!product) throw new ApiError(404, 'Product not found')

  const fields = ['name', 'category', 'price']
  fields.forEach((f) => {
    if (req.body[f] !== undefined) product[f] = req.body[f]
  })
  if (req.body.sku !== undefined) product.sku = req.body.sku.trim() || undefined
  if (req.body.name) product.slug = `${slugify(req.body.name)}-${product._id.toString().slice(-6)}`

  applyOptionalFields(product, req.body)

  if (req.body.originalPrice !== undefined) {
    product.originalPrice = req.body.originalPrice || undefined
  } else if (req.body.discountType !== undefined || req.body.discountValue !== undefined || req.body.price !== undefined) {
    product.originalPrice = computeOriginalPrice(product.price, product.discountType, product.discountValue)
  }

  if (req.files?.length) {
    for (const file of req.files) product.images.push(await uploadBuffer(file.buffer, 'products'))
  }

  await product.save()
  res.json({ success: true, product })
})

// PATCH /api/products/:id/featured (admin)
const toggleFeatured = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
  if (!product) throw new ApiError(404, 'Product not found')
  product.isFeatured = req.body.featured ?? !product.isFeatured
  await product.save()
  res.json({ success: true, product })
})

// DELETE /api/products/:id (admin)
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
  if (!product) throw new ApiError(404, 'Product not found')
  await Promise.all(product.images.map((img) => destroyImage(img.publicId)))
  await product.deleteOne()
  res.json({ success: true, message: 'Product deleted' })
})

// DELETE /api/products/:id/images/:publicId (admin) — remove a single gallery image
const deleteProductImage = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
  if (!product) throw new ApiError(404, 'Product not found')
  const publicId = decodeURIComponent(req.params.publicId)
  await destroyImage(publicId)
  product.images = product.images.filter((img) => img.publicId !== publicId)
  await product.save()
  res.json({ success: true, product })
})

function parseArrayField(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed
    } catch {
      // fall through to comma-split
    }
    return value.split(',').map((v) => v.trim()).filter(Boolean)
  }
  return []
}

function parseColorsField(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed
    } catch {
      return []
    }
  }
  return []
}

function parseObjectField(value) {
  if (value && typeof value === 'object') return value
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return undefined
    }
  }
  return undefined
}

module.exports = {
  getProducts,
  getProductsAdmin,
  getProductByIdAdmin,
  getFeaturedProducts,
  getNewArrivals,
  getBestSellers,
  searchProducts,
  getProductBySlug,
  getRelatedProducts,
  createProduct,
  updateProduct,
  toggleFeatured,
  deleteProduct,
  deleteProductImage,
}

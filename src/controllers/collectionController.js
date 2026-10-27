const asyncHandler = require('../middleware/asyncHandler')
const ApiError = require('../utils/ApiError')
const Collection = require('../models/Collection')
const Product = require('../models/Product')
const { uploadBuffer, destroyImage } = require('../utils/uploadImage')

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// GET /api/collections
const getCollections = asyncHandler(async (req, res) => {
  const filter = req.query.all === '1' ? {} : { status: { $ne: 'Hidden' } }
  const collections = await Collection.find(filter).sort({ launchDate: -1, createdAt: -1 })
  const counts = await Product.aggregate([
    { $match: { collection: { $ne: null } } },
    { $group: { _id: '$collection', count: { $sum: 1 } } },
  ])
  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]))

  res.json({
    success: true,
    collections: collections.map((c) => ({ ...c.toObject(), productCount: countMap[String(c._id)] || 0 })),
  })
})

// GET /api/collections/:idOrSlug
const getCollection = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params
  const isId = /^[0-9a-f]{24}$/.test(idOrSlug)
  const collection = await Collection.findOne(isId ? { _id: idOrSlug } : { slug: idOrSlug })
  if (!collection) throw new ApiError(404, 'Collection not found')
  res.json({ success: true, collection })
})

// GET /api/collections/:idOrSlug/products
const getCollectionProducts = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params
  const isId = /^[0-9a-f]{24}$/.test(idOrSlug)
  const collection = await Collection.findOne(isId ? { _id: idOrSlug } : { slug: idOrSlug })
  if (!collection) throw new ApiError(404, 'Collection not found')

  const products = await Product.find({ collection: collection._id }).populate('category', 'name slug')
  res.json({ success: true, collection, products })
})

// POST /api/collections (admin)
const createCollection = asyncHandler(async (req, res) => {
  const { name, description, status, launchDate } = req.body
  if (!name) throw new ApiError(400, 'Collection name is required')

  let image
  if (req.file) image = await uploadBuffer(req.file.buffer, 'collections')

  const collection = await Collection.create({ name, slug: slugify(name), description, status, launchDate, image })
  res.status(201).json({ success: true, collection })
})

// PATCH /api/collections/:id (admin)
const updateCollection = asyncHandler(async (req, res) => {
  const collection = await Collection.findById(req.params.id)
  if (!collection) throw new ApiError(404, 'Collection not found')

  const { name, description, status, launchDate } = req.body
  if (name) {
    collection.name = name
    collection.slug = slugify(name)
  }
  if (description !== undefined) collection.description = description
  if (status) collection.status = status
  if (launchDate !== undefined) collection.launchDate = launchDate || undefined

  if (req.file) {
    await destroyImage(collection.image?.publicId)
    collection.image = await uploadBuffer(req.file.buffer, 'collections')
  }

  await collection.save()
  res.json({ success: true, collection })
})

// DELETE /api/collections/:id (admin)
const deleteCollection = asyncHandler(async (req, res) => {
  const collection = await Collection.findById(req.params.id)
  if (!collection) throw new ApiError(404, 'Collection not found')

  const inUse = await Product.countDocuments({ collection: collection._id })
  if (inUse > 0) throw new ApiError(409, `Cannot delete — ${inUse} products belong to this collection`)

  await destroyImage(collection.image?.publicId)
  await collection.deleteOne()
  res.json({ success: true, message: 'Collection deleted' })
})

module.exports = {
  getCollections,
  getCollection,
  getCollectionProducts,
  createCollection,
  updateCollection,
  deleteCollection,
}

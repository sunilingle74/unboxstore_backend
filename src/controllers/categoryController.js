const asyncHandler = require('../middleware/asyncHandler')
const ApiError = require('../utils/ApiError')
const Category = require('../models/Category')
const Product = require('../models/Product')
const { uploadBuffer, destroyImage } = require('../utils/uploadImage')

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// GET /api/categories
const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find().sort({ name: 1 })
  const counts = await Product.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }])
  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]))

  res.json({
    success: true,
    categories: categories.map((c) => ({ ...c.toObject(), productCount: countMap[String(c._id)] || 0 })),
  })
})

// GET /api/categories/:idOrSlug
const getCategory = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params
  const category = await Category.findOne({ $or: [{ _id: idOrSlug.match(/^[0-9a-f]{24}$/) ? idOrSlug : null }, { slug: idOrSlug }] })
  if (!category) throw new ApiError(404, 'Category not found')
  res.json({ success: true, category })
})

// POST /api/categories (admin)
const createCategory = asyncHandler(async (req, res) => {
  const { name, status } = req.body
  if (!name) throw new ApiError(400, 'Category name is required')

  let image
  if (req.file) image = await uploadBuffer(req.file.buffer, 'categories')

  const category = await Category.create({ name, slug: slugify(name), status, image })
  res.status(201).json({ success: true, category })
})

// PATCH /api/categories/:id (admin)
const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id)
  if (!category) throw new ApiError(404, 'Category not found')

  const { name, status } = req.body
  if (name) {
    category.name = name
    category.slug = slugify(name)
  }
  if (status) category.status = status

  if (req.file) {
    await destroyImage(category.image?.publicId)
    category.image = await uploadBuffer(req.file.buffer, 'categories')
  }

  await category.save()
  res.json({ success: true, category })
})

// DELETE /api/categories/:id (admin)
const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id)
  if (!category) throw new ApiError(404, 'Category not found')

  const inUse = await Product.countDocuments({ category: category._id })
  if (inUse > 0) throw new ApiError(409, `Cannot delete — ${inUse} products use this category`)

  await destroyImage(category.image?.publicId)
  await category.deleteOne()
  res.json({ success: true, message: 'Category deleted' })
})

module.exports = { getCategories, getCategory, createCategory, updateCategory, deleteCategory, slugify }

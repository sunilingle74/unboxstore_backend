const asyncHandler = require('../middleware/asyncHandler')
const ApiError = require('../utils/ApiError')
const Banner = require('../models/Banner')
const { uploadBuffer, destroyImage } = require('../utils/uploadImage')

// GET /api/banners?placement=Home+Hero  (public: only Live unless ?all=1 admin view)
const getBanners = asyncHandler(async (req, res) => {
  const filter = {}
  if (req.query.placement) filter.placement = req.query.placement
  if (req.query.all !== '1') filter.status = 'Live'

  const banners = await Banner.find(filter).sort({ sortOrder: 1, createdAt: -1 })
  res.json({ success: true, banners })
})

// POST /api/banners (admin)
const createBanner = asyncHandler(async (req, res) => {
  const { title, placement, link, status, sortOrder } = req.body
  if (!title || !placement) throw new ApiError(400, 'Title and placement are required')
  if (!req.file) throw new ApiError(400, 'Banner image is required')

  const image = await uploadBuffer(req.file.buffer, 'banners')
  const banner = await Banner.create({ title, placement, link, status, sortOrder, image })
  res.status(201).json({ success: true, banner })
})

// PATCH /api/banners/:id (admin)
const updateBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findById(req.params.id)
  if (!banner) throw new ApiError(404, 'Banner not found')

  const fields = ['title', 'placement', 'link', 'status', 'sortOrder']
  fields.forEach((f) => {
    if (req.body[f] !== undefined) banner[f] = req.body[f]
  })

  if (req.file) {
    await destroyImage(banner.image?.publicId)
    banner.image = await uploadBuffer(req.file.buffer, 'banners')
  }

  await banner.save()
  res.json({ success: true, banner })
})

// DELETE /api/banners/:id (admin)
const deleteBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findById(req.params.id)
  if (!banner) throw new ApiError(404, 'Banner not found')
  await destroyImage(banner.image?.publicId)
  await banner.deleteOne()
  res.json({ success: true, message: 'Banner deleted' })
})

module.exports = { getBanners, createBanner, updateBanner, deleteBanner }

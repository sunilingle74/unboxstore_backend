const multer = require('multer')

const storage = multer.memoryStorage()

function fileFilter(req, file, cb) {
  if (file.mimetype.startsWith('image/')) cb(null, true)
  else cb(new Error('Only image files are allowed'), false)
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
})

module.exports = upload

const streamifier = require('streamifier')
const cloudinary = require('../config/cloudinary')

// Uploads a multer in-memory file buffer to Cloudinary and resolves with { url, publicId }.
function uploadBuffer(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: `atelier/${folder}` }, (err, result) => {
      if (err) return reject(err)
      resolve({ url: result.secure_url, publicId: result.public_id })
    })
    streamifier.createReadStream(buffer).pipe(stream)
  })
}

async function destroyImage(publicId) {
  if (!publicId) return
  await cloudinary.uploader.destroy(publicId)
}

module.exports = { uploadBuffer, destroyImage }

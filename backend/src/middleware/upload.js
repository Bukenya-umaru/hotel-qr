import { v2 as cloudinary } from 'cloudinary'
import multer from 'multer'
import { CloudinaryStorage } from 'multer-storage-cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const mimeExtensions = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'hotel-qr-uploads',
    allowed_formats: ['jpg', 'png', 'webp'],
  },
})

export const uploadMenuImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!mimeExtensions.has(file.mimetype)) {
      return callback(new Error('Menu photos must be JPG, PNG, or WebP.'))
    }
    callback(null, true)
  },
}).single('image')

export async function removeUploadedImage(imageUrl) {
  if (!imageUrl) return

  try {
    // Cloudinary URLs end in <folder>/<publicId>.<ext>; destroy() needs the public id.
    const parts = imageUrl.split('/')
    const filenameWithExt = parts.pop()
    const publicIdWithExt = filenameWithExt.split('.')[0]

    const folder = 'hotel-qr-uploads'
    const fullPublicId = `${folder}/${publicIdWithExt}`

    await cloudinary.uploader.destroy(fullPublicId)
  } catch (error) {
    console.error(`Failed to remove Cloudinary image ${imageUrl}: ${error.message}`)
  }
}

export const uploadDirectory = 'cloudinary'

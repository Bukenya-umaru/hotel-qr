import { v2 as cloudinary } from 'cloudinary'
import multer from 'multer'
import { CloudinaryStorage } from 'multer-storage-cloudinary'

// Configure Cloudinary
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

// Configure Cloudinary Storage for Multer
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
    // Extract the public ID from the Cloudinary URL
    // Example URL: https://res.cloudinary.com/cloudname/image/upload/v12345/folder/image_id.jpg
    const parts = imageUrl.split('/')
    const filenameWithExt = parts.pop()
    const publicIdWithExt = filenameWithExt.split('.')[0]

    // Cloudinary needs the folder path if you used one
    const folder = 'hotel-qr-uploads'
    const fullPublicId = `${folder}/${publicIdWithExt}`

    await cloudinary.uploader.destroy(fullPublicId)
  } catch (error) {
    console.error(`Failed to remove Cloudinary image ${imageUrl}: ${error.message}`)
  }
}

// Keeping this for backward compatibility with any code using the constant
export const uploadDirectory = 'cloudinary'

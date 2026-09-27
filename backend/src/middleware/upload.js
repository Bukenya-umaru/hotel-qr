import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import multer from 'multer'

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const uploadDirectory = path.join(backendDirectory, 'uploads')
fs.mkdirSync(uploadDirectory, { recursive: true })

const mimeExtensions = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
])

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${mimeExtensions.get(file.mimetype)}`),
})

export const uploadMenuImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!mimeExtensions.has(file.mimetype)) return callback(new Error('Menu photos must be JPG, PNG, or WebP.'))
    callback(null, true)
  },
}).single('image')

export async function removeUploadedImage(imageUrl) {
  if (!imageUrl?.startsWith('/uploads/')) return
  const filename = path.basename(imageUrl)
  if (!/^[\da-f-]+\.(jpg|png|webp)$/i.test(filename)) return
  await fs.promises.unlink(path.join(uploadDirectory, filename)).catch(error => {
    if (error.code !== 'ENOENT') throw error
  })
}

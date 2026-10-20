import 'dotenv/config'
import http from 'node:http'
import cookieParser from 'cookie-parser'
import compression from 'compression'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { Server as SocketServer } from 'socket.io'
import { COOKIE_NAME } from './middleware/auth.js'
import { apiLimiter } from './middleware/rateLimit.js'
import { uploadDirectory } from './middleware/upload.js'
import { Hotel } from './models/Hotel.js'
import { User } from './models/User.js'
import authRoutes from './routes/auth.js'
import developerRoutes from './routes/developer.js'
import ownerRoutes from './routes/owner.js'
import supportRoutes from './routes/support.js'
import stockRoutes from './routes/stock.js'
import notificationRoutes from './routes/notifications.js'

const app = express()
const server = http.createServer(app)
// Allowed CORS origins must come from .env — no hard-coded fallback.
const origins = String(process.env.CLIENT_URLS || '')
  .split(',').map(origin => origin.trim()).filter(Boolean)
// Only trust X-Forwarded-For when explicitly enabled for the deployment
// (e.g. TRUST_PROXY=1 behind a single reverse proxy), so the client IPs used
// by rate limiting are the real ones and headers from random clients are ignored.
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY)
const io = new SocketServer(server, { cors: { origin: origins, credentials: true } })
app.set('io', io)

// Secure HTTP response headers. HSTS is only sent in production so that
// local development over plain HTTP is not forced onto https://.
const isProduction = process.env.NODE_ENV === 'production'
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      // The backend only serves JSON APIs and uploaded images — no scripts,
      // styles, frames, or plugins should ever load from these responses.
      scriptSrc: ["'none'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'none'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'none'"],
      baseUri: ["'none'"],
      imgSrc: ["'self'", 'data:'],
      // Only enforce https:// in production; dev may run plain HTTP.
      upgradeInsecureRequests: isProduction ? [] : null,
    },
  },
  // Uploaded images must remain loadable from the frontend origins.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  strictTransportSecurity: isProduction
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
}))
// Compress responses (gzip) so API payloads transfer faster over the network.
// Only compressible content types are compressed; uploaded images (JPG/PNG/WebP)
// and already-compressed responses are left untouched.
app.use(compression())
app.use(cors({ origin: origins, credentials: true }))
app.use(express.json({ limit: '32kb' }))
app.use(cookieParser())
// Backstop against abuse and traffic spikes on every API endpoint.
app.use('/api', apiLimiter)

app.use('/uploads', express.static(uploadDirectory, {
  index: false,
  dotfiles: 'deny',
  maxAge: '7d',
  immutable: true,
}))

app.get('/api/health', (_req, res) => res.json({
  status: 'ok',
  database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
}))
app.use('/api/auth', authRoutes)
app.use('/api/owner', ownerRoutes)
app.use('/api/stock', stockRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/developer', developerRoutes)
app.use('/api/support', supportRoutes)

app.use('/api', (_req, res) => res.status(404).json({ message: 'This action is not available.' }))

io.use(async (socket, next) => {
  try {
    const cookie = socket.handshake.headers.cookie?.split(';')
      .map(entry => entry.trim()).find(entry => entry.startsWith(`${COOKIE_NAME}=`))
    if (cookie) {
      if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        return next(new Error('Invalid server configuration.'))
      }
      const payload = jwt.verify(decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1)), process.env.JWT_SECRET, { issuer: 'stayserve' })
      const user = await User.findById(payload.userId).populate('hotelId', 'isActive').select('_id role hotelId isActive')
      if (!user?.isActive || user.role !== payload.role ||
          (user.role !== 'DEVELOPER' && !user.hotelId?.isActive)) {
        return next(new Error('This session is no longer authorized.'))
      }
      socket.data.user = user
    }
    next()
  } catch (error) {
    next(new Error(error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError'
      ? 'This session is no longer valid.'
      : 'Socket authentication failed.'))
  }
})

io.on('connection', socket => {
  socket.on('join_hotel', hotelId => {
    const user = socket.data.user
    if (user && ['OWNER', 'KITCHEN'].includes(user.role) &&
        user.hotelId?._id.toString() === String(hotelId)) socket.join(`hotel:${hotelId}`)
    if (user?.role === 'DEVELOPER') {
      Hotel.exists({ _id: hotelId, isActive: true })
        .then(business => { if (business) socket.join(`hotel:${hotelId}`) })
        .catch(error => console.error(`Unable to join business update stream: ${error.message}`))
    }
  })
})

app.use((error, _req, res, _next) => {
  if (error.code === 11000) return res.status(409).json({ message: 'That account or business identifier is already in use.' })
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ message: 'The submitted data is invalid.' })
  }
  if (error.name === 'MulterError') {
    return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Menu photo must be 5 MB or smaller.' : 'Invalid photo upload.' })
  }
  if (error.message === 'Menu photos must be JPG, PNG, or WebP.') return res.status(400).json({ message: error.message })
  console.error(error)
  res.status(500).json({ message: 'Something went wrong. Please try again in a moment.' })
})

const port = Number(process.env.PORT || 4000)
try {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters.')
  if (origins.length === 0) throw new Error('CLIENT_URLS must list at least one allowed CORS origin in backend/.env.')
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stayserve')
  server.listen(port, () => console.log(`StayServe API listening on http://localhost:${port}`))
} catch (error) {
  console.error(`Unable to start StayServe API: ${error.message}`)
  process.exitCode = 1
}

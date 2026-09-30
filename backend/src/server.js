import 'dotenv/config'
import http from 'node:http'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { Server as SocketServer } from 'socket.io'
import { COOKIE_NAME } from './middleware/auth.js'
import { uploadDirectory } from './middleware/upload.js'
import { Hotel } from './models/Hotel.js'
import { Order } from './models/Order.js'
import { User } from './models/User.js'
import authRoutes from './routes/auth.js'
import developerRoutes from './routes/developer.js'
import menuRoutes from './routes/menu.js'
import orderRoutes from './routes/orders.js'
import ownerRoutes from './routes/owner.js'
import stockRoutes from './routes/stock.js'
import tableRoutes from './routes/tables.js'

const app = express()
const server = http.createServer(app)
const origins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:5174')
  .split(',').map(origin => origin.trim()).filter(Boolean)
const io = new SocketServer(server, { cors: { origin: origins, credentials: true } })
app.set('io', io)

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: origins, credentials: true }))
app.use(express.json({ limit: '32kb' }))
app.use(cookieParser())
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
app.use('/api/menu', menuRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/tables', tableRoutes)
app.use('/api/owner', ownerRoutes)
app.use('/api/stock', stockRoutes)
app.use('/api/developer', developerRoutes)

app.use('/api', (_req, res) => res.status(404).json({ message: 'API endpoint not found.' }))

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
        .catch(error => console.error(`Unable to join business order stream: ${error.message}`))
    }
  })
  socket.on('join_menu', async slug => {
    const hotel = await Hotel.findOne({ slug: String(slug || '').trim().toLowerCase(), isActive: true }).select('_id').catch(() => null)
    if (hotel) socket.join(`menu:${hotel._id}`)
  })
  socket.on('join_order', async orderId => {
    if (!/^[a-f\d]{24}$/i.test(String(orderId))) return
    const order = await Order.exists({ _id: orderId }).catch(() => null)
    if (order) socket.join(`order:${orderId}`)
  })
})

app.use((error, _req, res, _next) => {
  if (error.code === 11000) return res.status(409).json({ message: 'That account, business, or table identifier is already in use.' })
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ message: 'The submitted data is invalid.' })
  }
  if (error.name === 'MulterError') {
    return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Menu photo must be 5 MB or smaller.' : 'Invalid photo upload.' })
  }
  if (error.message === 'Menu photos must be JPG, PNG, or WebP.') return res.status(400).json({ message: error.message })
  console.error(error)
  res.status(500).json({ message: 'An unexpected server error occurred.' })
})

const port = Number(process.env.PORT || 4000)
try {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters.')
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stayserve')
  server.listen(port, () => console.log(`StayServe API listening on http://localhost:${port}`))
} catch (error) {
  console.error(`Unable to start StayServe API: ${error.message}`)
  process.exitCode = 1
}

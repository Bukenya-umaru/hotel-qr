import bcrypt from 'bcryptjs'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate, cookieOptions, COOKIE_NAME, issueToken, publicUser } from '../middleware/auth.js'
import { User } from '../models/User.js'
import { asyncRoute } from '../utils/http.js'

const router = express.Router()
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many sign-in attempts. Please try again in 15 minutes.' },
})

router.post('/login', loginLimiter, asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' })
  const user = await User.findOne({ email }).select('+password').populate('hotelId', 'name slug currency taxRate isActive')
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid email or password.' })
  }
  if (user.role !== 'DEVELOPER' && (!user.hotelId || !user.hotelId.isActive)) {
    return res.status(403).json({ message: 'This business is not active.' })
  }
  res.cookie(COOKIE_NAME, issueToken(user), cookieOptions())
  res.json({ user: publicUser(user) })
}))

router.get('/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }))
router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined })
  res.status(204).end()
})

export default router

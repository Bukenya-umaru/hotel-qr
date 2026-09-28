import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'

export const COOKIE_NAME = 'stayserve_session'
const jwtSecret = () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters.')
  }
  return process.env.JWT_SECRET
}

export function issueToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role, hotelId: user.hotelId?.toString() || null },
    jwtSecret(),
    { expiresIn: '12h', issuer: 'stayserve' },
  )
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: 12 * 60 * 60 * 1000,
  }
}

export async function authenticate(req, res, next) {
  try {
    const token = req.cookies[COOKIE_NAME]
    if (!token) return res.status(401).json({ message: 'Authentication required.' })
    const payload = jwt.verify(token, jwtSecret(), { issuer: 'stayserve' })
    const user = await User.findById(payload.userId).populate('hotelId', 'name slug currency taxRate isActive')
    if (!user || !user.isActive || user.role !== payload.role) {
      return res.status(401).json({ message: 'Your session is no longer valid.' })
    }
    if (user.role !== 'DEVELOPER' && (!user.hotelId || !user.hotelId.isActive)) {
      return res.status(403).json({ message: 'This business is not active.' })
    }
    req.user = user
    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Your session has expired. Please sign in again.' })
    }
    next(error)
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Authentication required.' })
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'You do not have permission to access this resource.' })
    next()
  }
}

export function hotelScope(req) {
  if (req.user.role === 'DEVELOPER') {
    return req.params.hotelId || req.body?.hotelId || req.query.hotelId || null
  }
  return req.user.hotelId._id
}

export function publicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    hotelId: user.hotelId?._id?.toString() || user.hotelId?.toString() || null,
    permissions: user.permissions,
    hotel: user.hotelId?.name ? {
      name: user.hotelId.name,
      slug: user.hotelId.slug,
      currency: user.hotelId.currency,
    } : null,
    isActive: user.isActive,
  }
}

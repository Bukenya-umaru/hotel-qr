import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'
import { recordSecurityEvent } from '../utils/securityLog.js'

export const COOKIE_NAME = 'stayserve_session'
const SESSION_DURATION = '6h'
const SESSION_MAX_AGE_MS = 6 * 60 * 60 * 1000
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
    { expiresIn: SESSION_DURATION, issuer: 'stayserve' },
  )
}

export function cookieOptions() {
  const secure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure,
    // SameSite=None (Secure only) lets the cross-origin Socket.IO handshake carry the cookie.
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_MS,
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
      // Log once per request even if this middleware runs more than once.
      if (req.user === undefined) recordSecurityEvent({ type: 'access_denied', detail: 'Attempt to reach a deactivated business', actorId: user._id }, req)
      return res.status(403).json({ message: 'This business is not active.' })
    }
    req.user = user
    res.cookie(COOKIE_NAME, issueToken(user), cookieOptions())
    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      if (error.name === 'JsonWebTokenError') {
        recordSecurityEvent({ type: 'token_rejected', severity: 'high', detail: `Invalid session token: ${error.message}` }, req)
      }
      return res.status(401).json({ message: 'Your session has expired. Please sign in again.' })
    }
    next(error)
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Authentication required.' })
    if (!roles.includes(req.user.role)) {
      recordSecurityEvent({ type: 'access_denied', severity: 'high', detail: `${req.user.role} attempted a ${roles.join('/')} endpoint: ${req.method} ${req.originalUrl}`, actorId: req.user._id, email: req.user.email }, req)
      return res.status(403).json({ message: 'You do not have permission to access this resource.' })
    }
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

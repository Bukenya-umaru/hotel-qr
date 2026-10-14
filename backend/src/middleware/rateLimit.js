import rateLimit from 'express-rate-limit'
import { recordSecurityEvent } from '../utils/securityLog.js'

// When a limiter fires, the attack signal is recorded first, then the caller
// still receives the same JSON error. Every limiter reports its own event
// type so the developer dashboard can tell a sign-in brute force apart from
// general API flooding.
const limited = eventOptions => (req, res, next, options) => {
  recordSecurityEvent({
    type: eventOptions.type,
    severity: 'high',
    detail: options.message.message,
    email: eventOptions.email ? String(req.body?.email || '').trim().toLowerCase() : '',
  }, req)
  res.status(options.statusCode).json(options.message)
}

// All limiters count requests per client IP inside one shared sliding window.
// Every threshold can be tuned from backend/.env without touching code.
const windowMs = (Number(process.env.RATE_LIMIT_WINDOW_MINUTES) || 15) * 60 * 1000
const draftHeaders = { standardHeaders: 'draft-7', legacyHeaders: false }

// General protection for every API endpoint — generous enough that normal
// dashboard use (including the live-updates polling) never comes close.
export const apiLimiter = rateLimit({
  windowMs,
  limit: Number(process.env.RATE_LIMIT_MAX) || 500,
  ...draftHeaders,
  message: { message: 'Too many requests. Please wait a few minutes and try again.' },
  handler: limited({ type: 'rate_limited' }),
})

// Brute-force protection for sign-in. Only failed attempts count toward the
// limit, so normal logins and account switches are never blocked.
export const loginLimiter = rateLimit({
  windowMs,
  limit: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 10,
  skipSuccessfulRequests: true,
  ...draftHeaders,
  message: { message: 'Too many sign-in attempts. Please try again in a few minutes.' },
  handler: limited({ type: 'login_bruteforce' }),
})

// Per-account brute-force shield, keyed by the submitted email address
// instead of the IP. Stalls credential-stuffing attacks that rotate IPs
// against one account, while a shared office IP can still let many people
// sign into their own accounts. Successful logins also count here — a real
// user signs in a handful of times per window, well below the limit.
export const accountLimiter = rateLimit({
  windowMs,
  limit: Number(process.env.ACCOUNT_RATE_LIMIT_MAX) || 30,
  keyGenerator: req => String(req.body?.email || '').trim().toLowerCase(),
  skip: req => !req.body?.email,
  ...draftHeaders,
  message: { message: 'Too many sign-in attempts for this account. Please try again in a few minutes.' },
  handler: limited({ type: 'account_bruteforce', email: true }),
})

// Upload flood protection for the image-upload endpoints. Each upload
// writes a file to disk and therefore costs far more than a JSON call, so
// a smaller ceiling blunts storage-fill and bandwidth abuse.
export const uploadLimiter = rateLimit({
  windowMs,
  limit: Number(process.env.UPLOAD_RATE_LIMIT_MAX) || 40,
  ...draftHeaders,
  message: { message: 'Too many uploads. Please wait a few minutes and try again.' },
})

// Small allowance for endpoints that confirm or expose passwords:
// change-password and the owner/developer "view password" support feature.
export const sensitiveLimiter = rateLimit({
  windowMs,
  limit: Number(process.env.SENSITIVE_RATE_LIMIT_MAX) || 20,
  ...draftHeaders,
  message: { message: 'Too many attempts. Please wait a few minutes and try again.' },
})
import rateLimit from 'express-rate-limit'
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
})

// Brute-force protection for sign-in. Only failed attempts count toward the
// limit, so normal logins and account switches are never blocked.
export const loginLimiter = rateLimit({
  windowMs,
  limit: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 10,
  skipSuccessfulRequests: true,
  ...draftHeaders,
  message: { message: 'Too many sign-in attempts. Please try again in a few minutes.' },
})

// Small allowance for endpoints that confirm or expose passwords:
// change-password and the owner/developer "view password" support feature.
export const sensitiveLimiter = rateLimit({
  windowMs,
  limit: Number(process.env.SENSITIVE_RATE_LIMIT_MAX) || 20,
  ...draftHeaders,
  message: { message: 'Too many attempts. Please wait a few minutes and try again.' },
})
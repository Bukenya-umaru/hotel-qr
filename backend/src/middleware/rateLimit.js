import rateLimit from 'express-rate-limit'
import { recordSecurityEvent } from '../utils/securityLog.js'

const limited = eventOptions => (req, res, next, options) => {
  recordSecurityEvent({
    type: eventOptions.type,
    severity: 'high',
    detail: options.message.message,
    email: eventOptions.email ? String(req.body?.email || '').trim().toLowerCase() : '',
  }, req)
  res.status(options.statusCode).json(options.message)
}

const windowMs = (Number(process.env.RATE_LIMIT_WINDOW_MINUTES) ) * 60 * 1000
const draftHeaders = { standardHeaders: 'draft-7', legacyHeaders: false }

export const apiLimiter = rateLimit({
  windowMs,
  limit: Number(process.env.RATE_LIMIT_MAX),
  ...draftHeaders,
  message: { message: 'Too many requests. Please wait a few minutes and try again.' },
  handler: limited({ type: 'rate_limited' }),
})

export const loginLimiter = rateLimit({
  windowMs,
  limit: Number(process.env.LOGIN_RATE_LIMIT_MAX),
  skipSuccessfulRequests: true,
  ...draftHeaders,
  message: { message: 'Too many sign-in attempts. Please try again in a few minutes.' },
  handler: limited({ type: 'login_bruteforce' }),
})

export const accountLimiter = rateLimit({
  windowMs,
  limit: Number(process.env.ACCOUNT_RATE_LIMIT_MAX),
  keyGenerator: req => String(req.body?.email || '').trim().toLowerCase(),
  skip: req => !req.body?.email,
  ...draftHeaders,
  message: { message: 'Too many sign-in attempts for this account. Please try again in a few minutes.' },
  handler: limited({ type: 'account_bruteforce', email: true }),
})

export const uploadLimiter = rateLimit({
  windowMs,
  limit: Number(process.env.UPLOAD_RATE_LIMIT_MAX),
  ...draftHeaders,
  message: { message: 'Too many uploads. Please wait a few minutes and try again.' },
})

export const sensitiveLimiter = rateLimit({
  windowMs,
  limit: Number(process.env.SENSITIVE_RATE_LIMIT_MAX),
  ...draftHeaders,
  message: { message: 'Too many attempts. Please wait a few minutes and try again.' },
})

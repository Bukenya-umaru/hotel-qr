import { SecurityEvent } from '../models/SecurityEvent.js'

export function recordSecurityEvent({
  type,
  severity = 'low',
  detail = '',
  email = '',
  ip = '',
  userAgent = '',
  actorId = null,
}, req = null) {
  if (req) {
    ip = ip || req.ip || ''
    userAgent = userAgent || req.headers?.['user-agent'] || ''
  }
  SecurityEvent.create({
    type,
    severity,
    detail: String(detail || '').slice(0, 400),
    email: String(email || '').trim().toLowerCase().slice(0, 254),
    ip: String(ip || '').slice(0, 100),
    userAgent: String(userAgent || '').slice(0, 250),
    actorId: actorId || null,
  }).catch(error => console.error(`Unable to record security event: ${error.message}`))
}

export const SECURITY_EVENT_LABELS = {
  login_failed: 'Sign-in failed',
  password_change_failed: 'Password change blocked',
  login_bruteforce: 'Sign-in flood (one IP)',
  account_bruteforce: 'Sign-in flood (one account)',
  rate_limited: 'API flood',
  token_rejected: 'Tampered session token',
  access_denied: 'Forbidden access attempt',
  password_revealed: 'Password revealed',
  account_created: 'Account created',
}

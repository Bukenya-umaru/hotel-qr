import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  type: { type: String, required: true, enum: [
    'login_failed',
    'password_change_failed',
    'login_bruteforce',
    'account_bruteforce',
    'rate_limited',
    'token_rejected',
    'access_denied',
    'password_revealed',
    'account_created',
  ], index: true },
  severity: { type: String, enum: ['low', 'high'], default: 'low' },
  detail: { type: String, default: '', maxlength: 400 },
  email: { type: String, default: '', maxlength: 254, set: v => String(v || '').toLowerCase() },
  ip: { type: String, default: '', maxlength: 100 },
  userAgent: { type: String, default: '', maxlength: 250 },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true })

const days = Number(process.env.SECURITY_LOG_DAYS) || 90
schema.index({ createdAt: 1 }, { expireAfterSeconds: Math.max(1, days) * 24 * 60 * 60, name: 'createdAt_ttl' })
schema.index({ createdAt: -1 })

export const SecurityEvent = mongoose.model('SecurityEvent', schema)

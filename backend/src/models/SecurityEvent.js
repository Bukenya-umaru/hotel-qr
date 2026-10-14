import mongoose from 'mongoose'

// Every suspicious request signalled by the auth, rate-limit, or password
// layers lands here. The developer dashboard lists the newest events so an
// attack attempt (brute-force sign-in, token tampering, permission probing)
// is visible right away — see GET /api/developer/security.
const schema = new mongoose.Schema({
  type: { type: String, required: true, enum: [
    'login_failed',           // wrong credentials on /api/auth/login
    'password_change_failed', // wrong current password
    'login_bruteforce',       // sign-in rate limit hit for one IP
    'account_bruteforce',     // per-account rate limit hit for one email
    'rate_limited',           // general API rate limit tripped
    'token_rejected',         // malformed / tampered session signature
    'access_denied',          // signed-in user probing a forbidden resource
    'password_revealed',      // a stored password was decrypted for viewing
    'account_created',        // informational: new owner/chef account
  ], index: true },
  // 'high' events are smoke signals worth immediate review; 'low' is context.
  severity: { type: String, enum: ['low', 'high'], default: 'low' },
  detail: { type: String, default: '', maxlength: 400 },
  // Target account email (login attempts) or actor email.
  email: { type: String, default: '', maxlength: 254, set: v => String(v || '').toLowerCase() },
  ip: { type: String, default: '', maxlength: 100 },
  userAgent: { type: String, default: '', maxlength: 250 },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true })

// Rapid-fire attacks create far more rows than reads need; a small TTL keeps
// the log useful without turning into an unbounded growth risk. Default 90
// days, configurable via SECURITY_LOG_DAYS.
const days = Number(process.env.SECURITY_LOG_DAYS) || 90
schema.index({ createdAt: 1 }, { expireAfterSeconds: Math.max(1, days) * 24 * 60 * 60, name: 'createdAt_ttl' })
schema.index({ createdAt: -1 })

export const SecurityEvent = mongoose.model('SecurityEvent', schema)

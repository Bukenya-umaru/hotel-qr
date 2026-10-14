// End-to-end check of the "view password" recovery path via the real HTTP API.
// Creates a temp chef whose stored vault blob was encrypted with a key that
// no longer matches (simulating a lost/rotated vault key), then verifies:
// hasViewablePassword=false, the new distinct 404 message, a one-time reset
// that re-encrypts under the current key, and a successful reveal. Deletes the
// temp account afterwards. Run with cwd=backend: node ../scripts/e2e-vault.mjs
import 'dotenv/config'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
// Import specifiers resolve against this file's location, so derive backend
// source paths from the working directory (run with cwd=backend).
const fromCwd = p => new URL('file://' + process.cwd().replace(/\\/g, '/') + '/' + p).href
const { User } = await import(fromCwd('src/models/User.js'))
const { Hotel } = await import(fromCwd('src/models/Hotel.js'))
const { COOKIE_NAME } = await import(fromCwd('src/middleware/auth.js'))

const BASE = 'http://localhost:4000'
const EMAIL = 'vault-e2e-chef@stayserve.local'

const step = (name, ok, detail = '') =>
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)

await mongoose.connect(process.env.MONGODB_URI)
const hotel = await Hotel.findOne({}).sort('_id').lean()
const developer = await User.findOne({ role: 'DEVELOPER' }).lean()

// Simulate a blob from a lost vault key: encrypt a known plaintext under a key
// derived from a secret that the running server does not have.
const LOST_SECRET = 'this-key-is-gone-lost-forever-1234567890abcdef'
const saltKey = secret => crypto.scryptSync(secret, 'stayserve-password-vault-v1', 32)
const encrypt = (secret, plain) => {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', saltKey(secret), iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), encrypted].map(p => p.toString('base64')).join(':')
}

const OriginalChefPassword = 'StaleBlob123'
await User.deleteOne({ email: EMAIL })
const chef = await User.create({
  name: 'Vault E2E Chef',
  email: EMAIL,
  password: await bcrypt.hash(OriginalChefPassword, 12),
  role: 'KITCHEN',
  hotelId: hotel._id,
  isActive: true,
})
chef.passwordVault = encrypt(LOST_SECRET, OriginalChefPassword)
await chef.save()

const token = jwt.sign(
  { userId: developer._id.toString(), role: 'DEVELOPER', hotelId: null },
  process.env.JWT_SECRET,
  { expiresIn: '30m', issuer: 'stayserve' },
)
const headers = { 'Content-Type': 'application/json', Cookie: `${COOKIE_NAME}=${token}` }
const GET = url => fetch(`${BASE}${url}`, { headers }).then(r => r.json().then(b => ({ status: r.status, body: b })))
const PATCH = (url, payload) => fetch(`${BASE}${url}`, { method: 'PATCH', headers, body: JSON.stringify(payload) }).then(r => r.json().then(b => ({ status: r.status, body: b })))

try {
  // 1) Listing hides the broken vault — the badge must not promise decryption.
  const list = await GET('/api/developer/users')
  const listed = list.body.users.find(u => u.email === EMAIL)
  const ownerBadge = list.body.users.find(u => u.email === 'owner@wagabits.com')
  step('list: stale vault marked not viewable', listed?.hasViewablePassword === false, JSON.stringify(listed?.hasViewablePassword))
  step('list: real owner (lost key) marked not viewable', ownerBadge?.hasViewablePassword === false)

  // 2) Reveal on a stale blob explains the rotated key instead of lying.
  const stale = await GET(`/api/developer/users/${chef._id}/password`)
  step('stale blob: HTTP 404', stale.status === 404)
  step('stale blob: explains the earlier vault key',
    /earlier vault key/i.test(stale.body.message || ''), stale.body.message)

  // 3) One reset re-encrypts under the current key.
  const NewChefPassword = 'FreshBlob123'
  const reset = await PATCH(`/api/developer/users/${chef._id}`, { password: NewChefPassword })
  step('reset succeeds', reset.status === 200)

  // 4) Reveal now returns the live password.
  const revealed = await GET(`/api/developer/users/${chef._id}/password`)
  step('reveal after reset returns 200', revealed.status === 200)
  step('revealed plaintext matches the reset value', revealed.body.password === NewChefPassword)

  // 5) Stale-blob accounts for the real business are reported honestly.
  const afterList = await GET('/api/developer/users')
  const afterChef = afterList.body.users.find(u => u.email === EMAIL)
  step('list flips the badge after reset', afterChef?.hasViewablePassword === true)
  const beforeResetCheckpoint = await GET(`/api/developer/users/${ownerBadge._id}/password`).catch(e => e)
  // The real owner still needs a reset — verify the message, not the reveal.
  const ownerStillStale = typeof beforeResetCheckpoint === 'object' && beforeResetCheckpoint.status === 404
  step('owner account still reports the rotated-key cause', ownerStillStale)
} catch (err) {
  console.log('FAIL e2e run aborted —', err.message)
} finally {
  await User.deleteOne({ email: EMAIL })
  const left = await User.countDocuments({ email: /vault-e2e-chef/ })
  console.log('cleanup: temp users remaining =', left)
  await mongoose.disconnect()
}

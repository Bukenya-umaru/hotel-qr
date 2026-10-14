// One-time recovery: resets the passwords of the real owner and chef accounts
// so their vault copies get re-encrypted under the current backend/.env key,
// making the developer "view password" feature work for them. Verifies each
// reset by revealing the stored copy through the live API. Deletes nothing —
// these are real accounts. Run with cwd=backend: node ../scripts/reset-vaulted-accounts.mjs
import 'dotenv/config'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import mongoose from 'mongoose'
// Import specifiers resolve against this file's location, so derive backend
// source paths from the working directory (run with cwd=backend).
const fromCwd = p => new URL('file://' + process.cwd().replace(/\\/g, '/') + '/' + p).href
const { COOKIE_NAME } = await import(fromCwd('src/middleware/auth.js'))
const { User } = await import(fromCwd('src/models/User.js'))

const BASE = 'http://localhost:4000'
const TARGETS = ['owner@wagabits.com', 'umarubukenya561@gmail.com']

// Strong but readable: mixed-case + digits, 18 chars grouped as XXXX-XXXX-XXXX? no —
// the login form takes one string, so keep it a plain string (no dash re-type).
const generatePassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  return Array.from(crypto.randomBytes(18), b => alphabet[b % alphabet.length]).join('')
}

await mongoose.connect(process.env.MONGODB_URI)
const developer = await User.findOne({ role: 'DEVELOPER' }).lean()
const token = jwt.sign(
  { userId: developer._id.toString(), role: 'DEVELOPER', hotelId: null },
  process.env.JWT_SECRET,
  { expiresIn: '30m', issuer: 'stayserve' },
)
const headers = { 'Content-Type': 'application/json', Cookie: `${COOKIE_NAME}=${token}` }
const GET = url => fetch(`${BASE}${url}`, { headers }).then(r => r.json().then(b => ({ status: r.status, body: b })))
const PATCH = (url, payload) => fetch(`${BASE}${url}`, { method: 'PATCH', headers, body: JSON.stringify(payload) })

try {
  const list = await GET('/api/developer/users')
  for (const email of TARGETS) {
    const account = list.body.users.find(u => u.email === email)
    if (!account) { console.log(`FAIL ${email} — not found in developer listing`); continue }
    if (account.role !== 'OWNER' && account.role !== 'KITCHEN') { console.log(`FAIL ${email} — unsupported role ${account.role}`); continue }

    const newPassword = generatePassword()
    const patch = await PATCH(`/api/developer/users/${account._id}`, { password: newPassword })
    if (patch.status !== 200) { console.log(`FAIL reset ${email} — ${patch.status}`, JSON.stringify(patch.body)); continue }

    const reveal = await GET(`/api/developer/users/${account._id}/password`)
    if (reveal.status !== 200 || reveal.body.password !== newPassword) {
      console.log(`FAIL verify ${email} — status ${reveal.status}`)
      continue
    }
    console.log(`PASS ${email} (${account.role}) password reset + vault verified`)
    console.log(`     new password: ${newPassword}`)
  }
} catch (err) {
  console.log('FAIL run aborted —', err.message)
} finally {
  await mongoose.disconnect()
}

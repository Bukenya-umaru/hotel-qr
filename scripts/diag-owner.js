// Temporary diagnostic: check the owner account state and recent security events.
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
// Backend source paths derive from the working directory (run with cwd=backend).
const fromCwd = p => new URL('file:///' + process.cwd().replace(/\\/g, '/') + '/' + p).href
const { User } = await import(fromCwd('src/models/User.js'))
const { SecurityEvent } = await import(fromCwd('src/models/SecurityEvent.js'))
const { revealPassword } = await import(fromCwd('src/utils/passwordVault.js'))

await mongoose.connect(process.env.MONGODB_URI)
const owner = await User.findOne({ email: 'owner@wagabits.com' }).select('+passwordVault +password')
console.log('isActive:', owner.isActive, '| role:', owner.role)
const lpr = await bcrypt.compare('LPRUWYeNscBPKj4eS9', owner.password)
const jgl = await bcrypt.compare('JgLj28Tb4YWE4Ltp3A', owner.password)
console.log('bcrypt matches LPRUWY(2nd):', lpr, '| JgLj(1st):', jgl)
const vault = revealPassword(owner)
console.log('vault decrypts to:', vault === 'LPRUWYeNscBPKj4eS9' ? 'LPRUWY(2nd)' : vault === 'JgLj28Tb4YWE4Ltp3A' ? 'JgLj(1st)' : vault ? 'a DIFFERENT password (someone reset it again)' : 'null (no/undecryptable vault)')
const events = await SecurityEvent.find({ email: 'owner@wagabits.com' }).sort({ createdAt: -1 }).limit(8).select('type severity createdAt ip -_id').lean()
console.log('recent owner security events:', JSON.stringify(events, null, 1))
await mongoose.disconnect()

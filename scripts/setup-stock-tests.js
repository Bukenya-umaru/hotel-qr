// Temporary setup: creates the approver temp chef used by e2e-stock-verify.mjs.
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
const fromCwd = p => new URL('file:///' + process.cwd().replace(/\\/g, '/') + '/' + p).href
const { User } = await import(fromCwd('src/models/User.js'))
const { Hotel } = await import(fromCwd('src/models/Hotel.js'))

await mongoose.connect(process.env.MONGODB_URI)
const hotel = await Hotel.findOne({}).sort('_id').lean()
if (!hotel) { console.log('ERROR: no hotel'); process.exit(1) }
await User.deleteOne({ email: 'stock-e2e-approver@stayserve.local' })
const u = await User.create({
  name: 'Stock E2E Approver',
  email: 'stock-e2e-approver@stayserve.local',
  password: await bcrypt.hash('Approving1', 12),
  role: 'KITCHEN',
  hotelId: hotel._id,
  isActive: true,
  permissions: ['view_sales', 'manage_stock', 'manage_expenses', 'manage_sales', 'edit_records', 'approve_records'],
})
console.log('temp approver chef created (full permissions incl approve_records)')
await mongoose.disconnect()

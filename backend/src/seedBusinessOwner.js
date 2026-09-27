import 'dotenv/config'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { Hotel } from './models/Hotel.js'
import { User } from './models/User.js'

const {
  MONGODB_URI,
  BUSINESS_NAME = 'WAGA BITS',
  BUSINESS_CITY = '',
  OWNER_NAME,
  OWNER_EMAIL,
  OWNER_PASSWORD,
} = process.env

if (!MONGODB_URI || !OWNER_NAME || !OWNER_EMAIL || !OWNER_PASSWORD) {
  console.error('Set MONGODB_URI, OWNER_NAME, OWNER_EMAIL, and OWNER_PASSWORD in backend/.env.')
  process.exit(1)
}
if (OWNER_PASSWORD.length < 12) {
  console.error('OWNER_PASSWORD must be at least 12 characters long.')
  process.exit(1)
}

try {
  await mongoose.connect(MONGODB_URI)

  let business = await Hotel.findOne().sort({ createdAt: 1 })
  if (!business) {
    business = await Hotel.create({
      name: BUSINESS_NAME.trim() || 'WAGA BITS',
      slug: 'waga-bits',
      city: BUSINESS_CITY.trim(),
      tableCount: 24,
      currency: 'UGX',
      taxRate: 0,
      isActive: true,
    })
    console.log(`Single business initialized: ${business.name}.`)
  }

  const email = OWNER_EMAIL.trim().toLowerCase()
  const existing = await User.findOne({ email })
  if (existing) {
    if (existing.role !== 'OWNER' || existing.hotelId?.toString() !== business._id.toString()) {
      throw new Error('OWNER_EMAIL is already assigned to a different account.')
    }
    console.log(`Business owner account already exists for ${email}; no changes were made.`)
  } else {
    const existingOwner = await User.findOne({ hotelId: business._id, role: 'OWNER' })
    if (existingOwner) {
      throw new Error(`The business already has an owner account (${existingOwner.email}); no changes were made.`)
    }
    await User.create({
      name: OWNER_NAME.trim(),
      email,
      password: await bcrypt.hash(OWNER_PASSWORD, 12),
      role: 'OWNER',
      hotelId: business._id,
    })
    console.log(`Business owner account created for ${email}.`)
  }
} catch (error) {
  console.error(`Unable to initialize the business owner account: ${error.message}`)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}

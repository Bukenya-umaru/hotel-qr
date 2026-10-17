import 'dotenv/config'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { Hotel } from './models/Hotel.js'
import { User } from './models/User.js'
import { storePassword } from './utils/passwordVault.js'

const {
  MONGODB_URI,
  BUSINESS_NAME = 'WAGE BITES',
  BUSINESS_CITY = '',
  OWNER_NAME,
  OWNER_EMAIL,
  OWNER_PASSWORD,
} = process.env

if (!MONGODB_URI || !OWNER_NAME || !OWNER_EMAIL || !OWNER_PASSWORD) {
  console.error('Set MONGODB_URI, OWNER_NAME, OWNER_EMAIL, and OWNER_PASSWORD in backend/.env.')
  process.exit(1)
}
if (OWNER_PASSWORD.length < 6) {
  console.error('OWNER_PASSWORD must be at least 6 characters long.')
  process.exit(1)
}

try {
  await mongoose.connect(MONGODB_URI)

  let business = await Hotel.findOne().sort({ createdAt: 1 })
  if (!business) {
    business = await Hotel.create({
      name: BUSINESS_NAME.trim() || 'WAGE BITES',
      slug: 'wage-bites',
      city: BUSINESS_CITY.trim(),
      tableCount: 24,
      currency: 'UGX',
      taxRate: 0,
      isActive: true,
    })
    console.log(`Single business initialized: ${business.name}.`)
  } else if (!business.isActive) {
    business.isActive = true
    await business.save()
    console.log(`Business reactivated: ${business.name}.`)
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
    const owner = await User.create({
      name: OWNER_NAME.trim(),
      email,
      password: await bcrypt.hash(OWNER_PASSWORD, 12),
      role: 'OWNER',
      hotelId: business._id,
    })
    storePassword(owner, OWNER_PASSWORD)
    await owner.save()
    console.log(`Business owner account created for ${email}.`)
  }
} catch (error) {
  console.error(`Unable to initialize the business owner account: ${error.message}`)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}

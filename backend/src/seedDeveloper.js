import 'dotenv/config'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { User } from './models/User.js'

const { MONGODB_URI, DEVELOPER_NAME, DEVELOPER_EMAIL, DEVELOPER_PASSWORD } = process.env

if (!MONGODB_URI || !DEVELOPER_NAME || !DEVELOPER_EMAIL || !DEVELOPER_PASSWORD) {
  console.error('Set MONGODB_URI, DEVELOPER_NAME, DEVELOPER_EMAIL, and DEVELOPER_PASSWORD in backend/.env.')
  process.exit(1)
}
if (DEVELOPER_PASSWORD.length < 6) {
  console.error('DEVELOPER_PASSWORD must be at least 6 characters long.')
  process.exit(1)
}

try {
  await mongoose.connect(MONGODB_URI)
  const email = DEVELOPER_EMAIL.trim().toLowerCase()
  const existing = await User.findOne({ email })
  if (existing) {
    console.error('An account with DEVELOPER_EMAIL already exists; no changes were made.')
    process.exitCode = 1
  } else {
    await User.create({
      name: DEVELOPER_NAME.trim(),
      email,
      password: await bcrypt.hash(DEVELOPER_PASSWORD, 12),
      role: 'DEVELOPER',
    })
    console.log(`Developer account created for ${email}.`)
  }
} catch (error) {
  console.error(`Unable to create developer account: ${error.message}`)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}

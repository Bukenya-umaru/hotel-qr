import 'dotenv/config'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'

// Your exact original model schema definition
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  passwordVault: { type: String, select: false },
  role: { type: String, enum: ['DEVELOPER', 'OWNER', 'KITCHEN'], required: true },
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', default: null },
  isActive: { type: Boolean, default: true },
  permissions: { type: [String], default: undefined },
}, { timestamps: true })

const User = mongoose.model('User', schema)

// Hardcoded developer details and your MongoDB connection string
const MONGODB_URI = "mongodb+srv://umarubukenya561_db_user:rVEMtauA9Qf8hpFe@cluster0.vfujghf.mongodb.net/hotel_bites?retryWrites=true&w=majority"
const DEVELOPER_NAME = "bukenya Umaru"
const DEVELOPER_EMAIL = "umarubukenya561@gmail.com"
const DEVELOPER_PASSWORD = "umaru@222"

if (DEVELOPER_PASSWORD.length < 6) {
  console.error('DEVELOPER_PASSWORD must be at least 6 characters long.')
  process.exit(1)
}

try {
  await mongoose.connect(MONGODB_URI)
  const email = DEVELOPER_EMAIL.trim().toLowerCase()
  const hashedPassword = await bcrypt.hash(DEVELOPER_PASSWORD, 12)

  // Creates or updates the developer account matching your exact schema structure
  await User.findOneAndUpdate(
    { email },
    {
      name: DEVELOPER_NAME.trim(),
      email,
      password: hashedPassword,
      role: 'DEVELOPER',
      hotelId: null,
      isActive: true,
    },
    { upsert: true, new: true, runValidators: true }
  )

  console.log(`Developer account successfully configured for ${email}.`)
} catch (error) {
  console.error(`Unable to create/update developer account: ${error.message}`)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}

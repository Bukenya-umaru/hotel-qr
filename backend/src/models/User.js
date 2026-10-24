import mongoose from 'mongoose'
import { attachCachePurge } from '../utils/cache.js'

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

attachCachePurge(schema)

export const User = mongoose.model('User', schema)

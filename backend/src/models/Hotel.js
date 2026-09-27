import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  city: { type: String, default: '', trim: true },
  tableCount: { type: Number, default: 24, min: 1 },
  currency: { type: String, default: 'UGX', enum: ['UGX'] },
  taxRate: { type: Number, default: 0, min: 0, max: 100 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

export const Hotel = mongoose.model('Hotel', schema)

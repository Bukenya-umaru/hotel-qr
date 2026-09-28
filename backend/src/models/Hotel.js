import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  city: { type: String, default: '', trim: true },
  tableCount: { type: Number, default: 24, min: 1 },
  currency: { type: String, default: 'UGX', enum: ['UGX'] },
  taxRate: { type: Number, default: 0, min: 0, max: 100 },
  isActive: { type: Boolean, default: true },
  // Help & support details shown to customers on the menu page. The owner and
  // the developer both may edit these; customers only ever read them.
  support: {
    phone: { type: String, default: '', trim: true, maxlength: 40 },
    whatsapp: { type: String, default: '', trim: true, maxlength: 40 },
    email: { type: String, default: '', trim: true, lowercase: true, maxlength: 120 },
    hours: { type: String, default: '', trim: true, maxlength: 200 },
    message: { type: String, default: '', trim: true, maxlength: 400 },
  },
}, { timestamps: true })

export const Hotel = mongoose.model('Hotel', schema)

import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  price: { type: Number, required: true, min: 0 },
  costPrice: { type: Number, required: true, min: 0, select: false },
  isAvailable: { type: Boolean, default: true },
  imageUrl: { type: String, default: '' },
}, { timestamps: true })

export const MenuItem = mongoose.model('MenuItem', schema)

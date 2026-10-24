import mongoose from 'mongoose'
import { attachCachePurge } from '../utils/cache.js'

const schema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name: { type: String, required: true, trim: true, maxlength: 60 },
  foodType: { type: String, default: '', trim: true, maxlength: 60 },
  unit: { type: String, enum: ['plates', 'items', 'cups', 'kg', 'other'], default: 'plates' },
  customUnit: { type: String, default: '', trim: true, maxlength: 20 },
  imageUrl: { type: String, default: '' },
  plates: { type: Number, required: true, min: 0, default: 0 },
  price: { type: Number, required: true, min: 0, default: 0 },
  totalAdded: { type: Number, required: true, min: 0, default: 0 },
  totalUsed: { type: Number, required: true, min: 0, default: 0 },
  approved: { type: Boolean, default: false, index: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
}, { timestamps: true })

schema.index({ hotelId: 1, name: 1 }, { unique: true })

attachCachePurge(schema)

export const StockItem = mongoose.model('StockItem', schema)

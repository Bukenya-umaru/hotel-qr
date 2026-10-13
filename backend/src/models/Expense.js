import mongoose from 'mongoose'
import { attachCachePurge } from '../utils/cache.js'

// A single recorded kitchen expense, filed under one of the business's menu
// sections. Amount is in the business currency (UGX).
const schema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuCategory', required: true, index: true },
  categoryName: { type: String, required: true, trim: true, maxlength: 60 },
  amount: { type: Number, required: true, min: 0 },
  note: { type: String, default: '', trim: true, maxlength: 200 },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

schema.index({ hotelId: 1, createdAt: -1 })

attachCachePurge(schema)

export const Expense = mongoose.model('Expense', schema)

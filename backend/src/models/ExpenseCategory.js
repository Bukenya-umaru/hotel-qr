import mongoose from 'mongoose'
import { attachCachePurge } from '../utils/cache.js'

const schema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 60 },
}, { timestamps: true })

schema.index({ hotelId: 1, name: 1 }, { unique: true })

attachCachePurge(schema)

export const ExpenseCategory = mongoose.model('ExpenseCategory', schema)

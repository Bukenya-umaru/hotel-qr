import mongoose from 'mongoose'
import { attachCachePurge } from '../utils/cache.js'

const schema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 60 },
  quantity: { type: Number, required: true, min: 0, default: 1 },
  unit: { type: String, default: '', trim: true, maxlength: 20 },
  value: { type: Number, required: true, min: 0 },
  stockItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockItem', default: null },
  note: { type: String, default: '', trim: true, maxlength: 200 },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approved: { type: Boolean, default: false, index: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  edits: [{
    name: { type: String, default: '' },
    quantity: { type: Number, default: 0 },
    value: { type: Number, default: 0 },
    stockItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockItem', default: null },
    note: { type: String, default: '' },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    editedByName: { type: String, default: '' },
    editedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true })

schema.index({ hotelId: 1, createdAt: -1 })

attachCachePurge(schema)

export const DamageRecord = mongoose.model('DamageRecord', schema)

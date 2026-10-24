import mongoose from 'mongoose'
import { attachCachePurge } from '../utils/cache.js'

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  quantity: { type: Number, required: true, min: 0, default: 1 },
  unit: { type: String, default: '', trim: true, maxlength: 20 },
  amount: { type: Number, required: true, min: 0 },
  stockItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockItem', default: null },
}, { _id: false })

const editSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  items: { type: [itemSchema], default: undefined },
  amount: { type: Number, default: 0 },
  customerName: { type: String, default: '' },
  note: { type: String, default: '' },
  editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  editedByName: { type: String, default: '' },
  editedAt: { type: Date, default: Date.now },
}, { _id: true })

const schema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  saleNumber: { type: Number, default: null, min: 1 },
  name: { type: String, required: true, trim: true, maxlength: 60 },
  items: { type: [itemSchema], default: undefined },
  quantity: { type: Number, required: true, min: 0, default: 1 },
  unit: { type: String, default: '', trim: true, maxlength: 20 },
  amount: { type: Number, required: true, min: 0 },
  customerName: { type: String, default: '', trim: true, maxlength: 80 },
  customerContact: { type: String, default: '', trim: true, maxlength: 60 },
  note: { type: String, default: '', trim: true, maxlength: 200 },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approved: { type: Boolean, default: false, index: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  edits: { type: [editSchema], default: undefined },
}, { timestamps: true })

schema.index({ hotelId: 1, createdAt: -1 })
schema.index({ hotelId: 1, saleNumber: 1 }, { unique: true, sparse: true })

export const formatSaleId = saleNumber => Number.isInteger(saleNumber) && saleNumber > 0
  ? `SAL-${String(saleNumber).padStart(6, '0')}`
  : ''

attachCachePurge(schema)

export const Sale = mongoose.model('Sale', schema)

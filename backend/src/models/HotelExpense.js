import mongoose from 'mongoose'
import { attachCachePurge } from '../utils/cache.js'

// One recorded expense for the whole business — e.g. cooking gas, wages,
// transport — filed under one of the expense categories managed in
// Categories > Expenses. Amount is in the business currency (UGX).
// `categoryName` snapshots the bucket's name so old entries still read
// correctly if the category is renamed later.
const schema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'ExpenseCategory', required: true, index: true },
  categoryName: { type: String, required: true, trim: true, maxlength: 60 },
  amount: { type: Number, required: true, min: 0 },
  note: { type: String, default: '', trim: true, maxlength: 200 },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Sign-off: every new expense waits for explicit approval. Approved expenses are locked
  // — they can no longer be deleted or changed.
  approved: { type: Boolean, default: false, index: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  // Change trail: each edit before approval snapshots what the expense
  // looked like before it, so the owner sees "changed from X to this".
  edits: [{
    amount: { type: Number, default: 0 },
    note: { type: String, default: '' },
    categoryName: { type: String, default: '' },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    editedByName: { type: String, default: '' },
    editedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true })

schema.index({ hotelId: 1, createdAt: -1 })

attachCachePurge(schema)

export const HotelExpense = mongoose.model('HotelExpense', schema)

import mongoose from 'mongoose'
import { attachCachePurge } from '../utils/cache.js'

// One line inside a multi-item sale — e.g. "Beef plates ×3 — UGX 15,000".
// `amount` is the line's total (quantity × whatever one costs), not a unit price.
const itemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  quantity: { type: Number, required: true, min: 0, default: 1 },
  unit: { type: String, default: '', trim: true, maxlength: 20 },
  amount: { type: Number, required: true, min: 0 },
  // The stock this line was picked from, when it was. Kept for
  // traceability; the stock count itself is reduced when the sale records.
  stockItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockItem', default: null },
}, { _id: false })

// A snapshot of what an edited sale looked like before one change, so the
// owner can see "changed from X to this". Kept small: summary, total,
// customer and the full item lines.
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

// A single manually recorded sale — e.g. walk-in cash sales or items sold
// outside the app. A sale can hold several items recorded in one go, with an
// optional customer name and contact. `amount` is the total money the whole
// sale brought in (UGX); older sales keep their single item in the top-level
// name/quantity/unit fields.
const schema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  // Human-friendly receipt number, sequential per hotel (1, 2, 3…). The API
  // formats it as an ID like SAL-000042 so every sale can be quoted by hand.
  saleNumber: { type: Number, default: null, min: 1 },
  // Short summary of the sale, e.g. the first item's name. Kept in sync for
  // older screens; the full breakdown lives in `items`.
  name: { type: String, required: true, trim: true, maxlength: 60 },
  items: { type: [itemSchema], default: undefined },
  // How many of the item were sold; defaults to one for quick entries.
  quantity: { type: Number, required: true, min: 0, default: 1 },
  // What one `quantity` means, e.g. "plates", "cups" or a custom word like
  // "crates". Empty for sales recorded before units were tracked.
  unit: { type: String, default: '', trim: true, maxlength: 20 },
  amount: { type: Number, required: true, min: 0 },
  // Optional walk-in customer details for identifying a recorded sale.
  customerName: { type: String, default: '', trim: true, maxlength: 80 },
  customerContact: { type: String, default: '', trim: true, maxlength: 60 },
  note: { type: String, default: '', trim: true, maxlength: 200 },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Sign-off: records made by someone who cannot approve wait for the owner
  // (or staff granted the approval permission). Approved sales are locked —
  // they can no longer be deleted or changed.
  approved: { type: Boolean, default: false, index: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  // Change trail: each time an unapproved sale is edited, one entry records
  // what it looked like before the change and who made it. The owner sees
  // "changed from X to this" on the sale card.
  edits: { type: [editSchema], default: undefined },
}, { timestamps: true })

schema.index({ hotelId: 1, createdAt: -1 })
// One receipt number per hotel; sparse so sales recorded before IDs existed
// (saleNumber null) don't collide with each other.
schema.index({ hotelId: 1, saleNumber: 1 }, { unique: true, sparse: true })

// Formats a sale's receipt number as its public ID, e.g. 42 -> SAL-000042.
export const formatSaleId = saleNumber => Number.isInteger(saleNumber) && saleNumber > 0
  ? `SAL-${String(saleNumber).padStart(6, '0')}`
  : ''

attachCachePurge(schema)

export const Sale = mongoose.model('Sale', schema)

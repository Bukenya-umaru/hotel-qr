import mongoose from 'mongoose'

// One notification per business event (sale recorded, expense recorded,
// record approved, stock low). Every staff member of the hotel can see
// them; they are per-hotel, so the same bell works for owner and chefs.
// 'stock_pending' notifies approvers that a stock batch awaits approval.
const schema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  // What happened — drives the icon and wording on the client.
  type: {
    type: String,
    enum: ['new_sale', 'new_expense', 'new_damage', 'sale_approved', 'expense_approved', 'stock_confirmed', 'stock_pending', 'low_stock'],
    required: true,
  },
  title: { type: String, required: true, trim: true, maxlength: 80 },
  body: { type: String, default: '', trim: true, maxlength: 160 },
  // Links to the record so "view" can navigate; cleared if the record goes.
  refId: { type: mongoose.Schema.Types.ObjectId, default: null },
  // How many unread staff notifications the bell should show. Cleared by each
  // user separately below.
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true })

schema.index({ hotelId: 1, createdAt: -1 })
schema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 14 })

export const Notification = mongoose.model('Notification', schema)

export const NOTIFICATION_TYPES = schema.path('type').enumValues

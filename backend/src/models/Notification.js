import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  type: {
    type: String,
    enum: ['new_sale', 'new_expense', 'new_damage', 'sale_approved', 'expense_approved', 'stock_confirmed', 'stock_pending', 'stock_updated', 'low_stock'],
    required: true,
  },
  title: { type: String, required: true, trim: true, maxlength: 80 },
  body: { type: String, default: '', trim: true, maxlength: 160 },
  refId: { type: mongoose.Schema.Types.ObjectId, default: null },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true })

schema.index({ hotelId: 1, createdAt: -1 })
schema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 14 })

export const Notification = mongoose.model('Notification', schema)

export const NOTIFICATION_TYPES = schema.path('type').enumValues

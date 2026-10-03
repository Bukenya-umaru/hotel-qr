import mongoose from 'mongoose'

// A single manually recorded sale — e.g. walk-in cash sales or items sold
// outside the app. Amount is the total money the sale brought in (UGX).
const schema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 60 },
  // How many of the item were sold; defaults to one for quick entries.
  quantity: { type: Number, required: true, min: 0, default: 1 },
  amount: { type: Number, required: true, min: 0 },
  note: { type: String, default: '', trim: true, maxlength: 200 },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

schema.index({ hotelId: 1, createdAt: -1 })

export const Sale = mongoose.model('Sale', schema)

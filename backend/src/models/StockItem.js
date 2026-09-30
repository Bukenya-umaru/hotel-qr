import mongoose from 'mongoose'

// One stock entry per meat/food kind the kitchen tracks in plates,
// e.g. "Beef plates", "Chicken plates". Chefs adjust the count by hand
// and customer orders deduct from it automatically.
const schema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 60 },
  plates: { type: Number, required: true, min: 0, default: 0 },
  // Keeps a running total of plates ever added, for quick insight.
  totalAdded: { type: Number, required: true, min: 0, default: 0 },
  // Running total of plates deducted by orders (manual reduces excluded).
  totalUsed: { type: Number, required: true, min: 0, default: 0 },
}, { timestamps: true })

schema.index({ hotelId: 1, name: 1 }, { unique: true })

export const StockItem = mongoose.model('StockItem', schema)

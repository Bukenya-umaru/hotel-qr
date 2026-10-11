import mongoose from 'mongoose'

// One stock entry per meat/food kind the kitchen tracks in plates,
// e.g. "Beef plates", "Chicken plates". Chefs adjust the count by hand
// and recorded sales deduct from it automatically.
const schema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 60 },
  // The kind of food this stock holds, chosen from the business's
  // food-type categories (Beef, Chicken, Fish, …).
  foodType: { type: String, default: '', trim: true, maxlength: 60 },
  // What the count on `plates` represents: plated portions, counted
  // pieces (gas cylinders, boxes), weight in kilograms, cups (milk,
  // porridge), or any other measure named in `customUnit`.
  unit: { type: String, enum: ['plates', 'items', 'cups', 'kg', 'other'], default: 'plates' },
  // When `unit` is 'other', the name of that measure, e.g. "crate", "tray".
  customUnit: { type: String, default: '', trim: true, maxlength: 20 },
  // Photo of the actual batch, so the kitchen can recognise it at a glance.
  imageUrl: { type: String, default: '' },
  // Count of whatever `unit` measures. Kept in `plates` for older records.
  plates: { type: Number, required: true, min: 0, default: 0 },
  // Money value of ONE `unit` (a single plate, a single item, 1 kg), in the
  // business currency. The entry's total value is this × `plates`.
  price: { type: Number, required: true, min: 0, default: 0 },
  // Keeps a running total of the count ever added, for quick insight.
  totalAdded: { type: Number, required: true, min: 0, default: 0 },
  // Running total of stock deducted by sales (manual reduces excluded).
  totalUsed: { type: Number, required: true, min: 0, default: 0 },
  // Sign-off on the current count: stock added by someone who cannot approve
  // waits for the owner (or staff granted the approval permission). Approved
  // stock is locked — its details can no longer be edited or removed, and
  // freshly added stock goes back to pending until approved again.
  approved: { type: Boolean, default: false, index: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
}, { timestamps: true })

schema.index({ hotelId: 1, name: 1 }, { unique: true })

export const StockItem = mongoose.model('StockItem', schema)

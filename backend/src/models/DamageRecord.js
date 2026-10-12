import mongoose from 'mongoose'

// One recorded damage entry — stock that was spoilt, broken, spilled or
// otherwise lost, either drawn from a tracked stock item (its count drops)
// or unrelated to stock (e.g. a broken plate, a spoilt delivery not yet in
// stock). `value` is the money value of what was lost, in the business
// currency, so reports can price the losses.
const schema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 60 },
  quantity: { type: Number, required: true, min: 0, default: 1 },
  // What one `quantity` means — 'plates', 'items', 'cups', 'kg' or a custom
  // word like 'crates', kept as the display text the record was given.
  unit: { type: String, default: '', trim: true, maxlength: 20 },
  // Money value of the damage (UGX). Stock-picked entries price it from
  // the stock item's unit price × quantity.
  value: { type: Number, required: true, min: 0 },
  // The tracked stock the damage drew down, when it was. Deleting the
  // record restores the stock count.
  stockItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockItem', default: null },
  note: { type: String, default: '', trim: true, maxlength: 200 },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

schema.index({ hotelId: 1, createdAt: -1 })

export const DamageRecord = mongoose.model('DamageRecord', schema)

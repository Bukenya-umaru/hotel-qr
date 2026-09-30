import mongoose from 'mongoose'

// Name-only expense categories the chef defines, e.g. "Cooking gas",
// "Meat purchases". No amounts here — just the buckets to record under.
const schema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 60 },
}, { timestamps: true })

schema.index({ hotelId: 1, name: 1 }, { unique: true })

export const ExpenseCategory = mongoose.model('ExpenseCategory', schema)

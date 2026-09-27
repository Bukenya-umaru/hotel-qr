import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 60 },
}, { timestamps: true })

schema.index({ hotelId: 1, name: 1 }, { unique: true })

export const MenuCategory = mongoose.model('MenuCategory', schema)

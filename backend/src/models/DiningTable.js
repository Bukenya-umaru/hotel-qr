import mongoose from 'mongoose'

const reservationSchema = new mongoose.Schema({
  visitId: { type: String, required: true },
  guestCount: { type: Number, required: true, min: 1 },
  source: { type: String, enum: ['GUEST', 'CHEF'], default: 'GUEST' },
}, { _id: false })

const schema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  tableNumber: { type: String, required: true, trim: true },
  capacity: { type: Number, required: true, min: 1, max: 100 },
  occupiedSeats: { type: Number, default: 0, min: 0 },
  reservations: { type: [reservationSchema], default: [] },
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

schema.index({ hotelId: 1, tableNumber: 1 }, { unique: true })

export const DiningTable = mongoose.model('DiningTable', schema)

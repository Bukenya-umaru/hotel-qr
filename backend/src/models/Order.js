import mongoose from 'mongoose'

const itemSchema = new mongoose.Schema({
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  costPrice: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
}, { _id: false })

const schema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
  tableNumber: { type: String, required: true, trim: true },
  guestCount: { type: Number, required: true, min: 1, default: 1 },
  customerName: { type: String, default: '', maxlength: 80, trim: true },
  items: { type: [itemSchema], required: true },
  totalAmount: { type: Number, required: true, min: 0 },
  totalCost: { type: Number, required: true, min: 0 },
  totalProfit: { type: Number, required: true },
  status: { type: String, enum: ['Pending', 'Preparing', 'Ready', 'Served', 'Cancelled'], default: 'Pending', index: true },
  notes: { type: String, default: '', maxlength: 500, trim: true },
}, { timestamps: true })

schema.index({ hotelId: 1, createdAt: -1 })

export const Order = mongoose.model('Order', schema)

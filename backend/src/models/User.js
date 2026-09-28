import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['DEVELOPER', 'OWNER', 'KITCHEN'], required: true },
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', default: null },
  isActive: { type: Boolean, default: true },
  // Capabilities granted by the owner to KITCHEN staff. Missing (undefined)
  // means every capability is allowed — preserves existing chef accounts.
  permissions: { type: [String], default: undefined },
}, { timestamps: true })

export const User = mongoose.model('User', schema)

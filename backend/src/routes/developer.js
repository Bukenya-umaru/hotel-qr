import bcrypt from 'bcryptjs'
import express from 'express'
import mongoose from 'mongoose'
import { authenticate, authorize, publicUser } from '../middleware/auth.js'
import { Hotel } from '../models/Hotel.js'
import { Order } from '../models/Order.js'
import { User } from '../models/User.js'
import { asyncRoute, idIsValid, safeSupport } from '../utils/http.js'
import { revealPassword, storePassword, vaultEnabled } from '../utils/passwordVault.js'
import { isStrongPassword, PASSWORD_RULE_MESSAGE } from '../utils/passwordPolicy.js'

const router = express.Router()
router.use(authenticate, authorize('DEVELOPER'))

// Help & support details the developer maintains for the customer menu page.
router.get('/support', asyncRoute(async (_req, res) => {
  const hotel = await Hotel.findOne({ isActive: true }).select('support')
  if (!hotel) return res.status(404).json({ message: 'No active business is configured yet.' })
  res.json({ support: safeSupport(hotel.support) })
}))

router.patch('/support', asyncRoute(async (req, res) => {
  const business = await Hotel.findOne({ isActive: true }).select('_id')
  if (!business) return res.status(404).json({ message: 'No active business is configured yet.' })
  const input = req.body.support && typeof req.body.support === 'object' ? req.body.support : req.body
  const limits = { phone: 40, whatsapp: 40, email: 120, hours: 200, message: 400 }
  const updates = {}
  for (const field of Object.keys(limits)) {
    if (input[field] === undefined) continue
    updates[`support.${field}`] = String(input[field] ?? '').trim().slice(0, limits[field])
  }
  if (!Object.keys(updates).length) return res.status(400).json({ message: 'Provide a phone number, WhatsApp number, email, opening hours, or a help message to save.' })
  const hotel = await Hotel.findByIdAndUpdate(business._id, { $set: updates }, { new: true, runValidators: true }).select('support')
  req.app.get('io').to(`menu:${business._id}`).emit('support_updated', safeSupport(hotel.support))
  res.json({ support: safeSupport(hotel.support) })
}))

router.get('/users', asyncRoute(async (_req, res) => {
  const business = await Hotel.findOne({ isActive: true }).select('_id')
  const users = business
    ? await User.find({ hotelId: business._id, role: { $in: ['OWNER', 'KITCHEN'] } }).sort({ createdAt: -1 }).select('+passwordVault')
    : []
  res.json({
    users: users.map(user => ({ ...publicUser(user), hasViewablePassword: Boolean(user.passwordVault) })),
    passwordViewable: vaultEnabled(),
  })
}))

router.get('/orders', asyncRoute(async (_req, res) => {
  const business = await Hotel.findOne({ isActive: true }).select('_id')
  const orders = business
    ? await Order.find({ hotelId: business._id }).sort({ createdAt: -1 }).limit(200)
    : []
  res.json({ orders })
}))

router.patch('/users/:id', asyncRoute(async (req, res) => {
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Account not found.' })
  const business = await Hotel.findOne({ isActive: true }).select('_id')
  if (!business) return res.status(404).json({ message: 'The business could not be found.' })
  const user = await User.findOne({ _id: req.params.id, hotelId: business._id, role: { $in: ['OWNER', 'KITCHEN'] } })
  if (!user) return res.status(404).json({ message: 'Account not found.' })
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim()
    if (!name) return res.status(400).json({ message: 'Name cannot be empty.' })
    user.name = name
  }
  if (req.body.email !== undefined) {
    const email = String(req.body.email).trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Provide a valid email address.' })
    user.email = email
  }
  if (typeof req.body.isActive === 'boolean') user.isActive = req.body.isActive
  if (req.body.password !== undefined) {
    if (!isStrongPassword(req.body.password)) return res.status(400).json({ message: PASSWORD_RULE_MESSAGE })
    user.password = await bcrypt.hash(req.body.password, 12)
    storePassword(user, String(req.body.password))
  }
  if (typeof req.body.isActive !== 'boolean' && req.body.password === undefined &&
      req.body.name === undefined && req.body.email === undefined) {
    return res.status(400).json({ message: 'Provide account details, an isActive flag, or a new password.' })
  }
  await user.save()
  res.json({ user: publicUser(user) })
}))

// Reveal the stored password of a business owner or chef account. The
// plaintext is decrypted server-side only for authenticated developers and
// never included in any list or login response.
router.get('/users/:id/password', asyncRoute(async (req, res) => {
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Account not found.' })
  const business = await Hotel.findOne({ isActive: true }).select('_id')
  if (!business) return res.status(404).json({ message: 'The business could not be found.' })
  const user = await User.findOne({ _id: req.params.id, hotelId: business._id, role: { $in: ['OWNER', 'KITCHEN'] } }).select('+passwordVault')
  if (!user) return res.status(404).json({ message: 'Account not found.' })
  const password = revealPassword(user)
  if (password === null) {
    return res.status(404).json({ message: 'No viewable password is stored for this account yet. Reset the password once — after that you can view the current password anytime.' })
  }
  res.json({ password })
}))

router.get('/overview', asyncRoute(async (_req, res) => {
  const business = await Hotel.findOne({ isActive: true }).select('name slug city tableCount currency taxRate')
  const businessFilter = business ? { hotelId: business._id } : { hotelId: null }
  const [userCount, activeOrdersCount, recentOrders] = await Promise.all([
    User.countDocuments({ ...businessFilter, role: { $in: ['OWNER', 'KITCHEN'] }, isActive: true }),
    Order.countDocuments({ ...businessFilter, status: { $in: ['Pending', 'Preparing', 'Ready'] } }),
    Order.find({ ...businessFilter, status: { $nin: ['Served', 'Cancelled'] } }).sort({ createdAt: -1 }).limit(12),
  ])
  res.json({
    business,
    businessCount: business ? 1 : 0,
    userCount,
    activeOrdersCount,
    recentOrders,
    databaseStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
  })
}))

export default router

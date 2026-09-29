import bcrypt from 'bcryptjs'
import express from 'express'
import mongoose from 'mongoose'
import { authenticate, authorize, hotelScope } from '../middleware/auth.js'
import { DiningTable } from '../models/DiningTable.js'
import { User } from '../models/User.js'
import { MenuItem } from '../models/MenuItem.js'
import { MenuCategory } from '../models/MenuCategory.js'
import { Order } from '../models/Order.js'
import { Hotel } from '../models/Hotel.js'
import { removeUploadedImage, uploadMenuImage } from '../middleware/upload.js'
import { asyncRoute, idIsValid, safeMenuItem, safeSupport } from '../utils/http.js'
import { storePassword } from '../utils/passwordVault.js'
import { isStrongPassword, PASSWORD_RULE_MESSAGE } from '../utils/passwordPolicy.js'

const router = express.Router()

// Capabilities an owner can grant to chefs. A chef with no stored
// permissions still has full access (legacy accounts / not restricted yet).
const ALL_PERMISSIONS = ['view_sales', 'manage_menu', 'manage_tables']
const hasPerm = (user, key) => user.role !== 'KITCHEN' || !user.permissions || user.permissions.includes(key)
const validPermissions = value => Array.isArray(value) && value.every(perm => ALL_PERMISSIONS.includes(perm))
const staffUser = user => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  hotelId: user.hotelId.toString(),
  isActive: user.isActive,
  permissions: user.permissions,
})

// Help & support details shown on the customer menu page.
const SUPPORT_FIELDS = ['phone', 'whatsapp', 'email', 'hours', 'message']
const SUPPORT_LIMITS = { phone: 40, whatsapp: 40, email: 120, hours: 200, message: 400 }

const supportPayload = req => {
  const input = req.body.support && typeof req.body.support === 'object' ? req.body.support : req.body
  const updates = {}
  for (const field of SUPPORT_FIELDS) {
    if (input[field] === undefined) continue
    updates[field] = String(input[field] ?? '').trim().slice(0, SUPPORT_LIMITS[field])
  }
  return updates
}

router.get('/support', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  const hotel = await Hotel.findById(hotelScope(req)).select('support')
  if (!hotel) return res.status(404).json({ message: 'This business could not be found.' })
  res.json({ support: safeSupport(hotel.support) })
}))

router.patch('/support', authenticate, authorize('OWNER'), asyncRoute(async (req, res) => {
  const updates = supportPayload(req)
  if (!Object.keys(updates).length) return res.status(400).json({ message: 'Provide a phone number, WhatsApp number, email, opening hours, or a help message to save.' })
  const hotel = await Hotel.findByIdAndUpdate(
    hotelScope(req),
    { $set: Object.fromEntries(Object.entries(updates).map(([key, value]) => ([`support.${key}`, value]))) },
    { new: true, runValidators: true },
  ).select('support')
  if (!hotel) return res.status(404).json({ message: 'This business could not be found.' })
  req.app.get('io').to(`menu:${req.user.hotelId._id}`).emit('support_updated', safeSupport(hotel.support))
  res.json({ support: safeSupport(hotel.support) })
}))

router.get('/menu', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  const query = MenuItem.find({ hotelId: scope }).sort({ category: 1, name: 1 })
  if (req.user.role === 'OWNER') query.select('+costPrice')
  res.json({ items: await query })
}))

router.get('/tables', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  const tables = await DiningTable.find({ hotelId: hotelScope(req) }).sort({ tableNumber: 1 })
  res.json({ tables })
}))

router.post('/tables', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_tables')) return res.status(403).json({ message: 'You do not have permission to manage tables.' })
  const tableNumber = String(req.body.tableNumber || '').trim()
  const capacity = Number(req.body.capacity)
  if (!tableNumber || tableNumber.length > 32 || !Number.isInteger(capacity) || capacity < 1 || capacity > 100) {
    return res.status(400).json({ message: 'Provide a table number and a capacity from 1 to 100 people.' })
  }
  const table = await DiningTable.create({
    hotelId: hotelScope(req),
    tableNumber,
    capacity,
  })
  req.app.get('io').to(`menu:${req.user.hotelId._id}`).emit('tables_updated')
  res.status(201).json({ table })
}))

router.patch('/tables/:id', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_tables')) return res.status(403).json({ message: 'You do not have permission to manage tables.' })
  if (!idIsValid(req.params.id) || !Number.isInteger(Number(req.body.capacity))) {
    return res.status(400).json({ message: 'Provide a valid table and seating capacity.' })
  }
  const capacity = Number(req.body.capacity)
  if (capacity < 1 || capacity > 100) {
    return res.status(400).json({ message: 'Table capacity must be from 1 to 100 people.' })
  }
  const table = await DiningTable.findOneAndUpdate(
    { _id: req.params.id, hotelId: hotelScope(req), occupiedSeats: { $lte: capacity } },
    { $set: { capacity } },
    { new: true, runValidators: true },
  )
  if (!table) {
    const existing = await DiningTable.findOne({ _id: req.params.id, hotelId: hotelScope(req) }).select('occupiedSeats')
    if (!existing) return res.status(404).json({ message: 'Table not found.' })
    return res.status(409).json({ message: `This table currently has ${existing.occupiedSeats} occupied seats. Clear the table before lowering its capacity.` })
  }
  req.app.get('io').to(`menu:${table.hotelId}`).emit('tables_updated')
  res.json({ table })
}))

router.patch('/tables/:id/clear', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_tables')) return res.status(403).json({ message: 'You do not have permission to manage tables.' })
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Table not found.' })
  const table = await DiningTable.findOneAndUpdate(
    { _id: req.params.id, hotelId: hotelScope(req) },
    { $set: { occupiedSeats: 0, reservations: [] } },
    { new: true },
  )
  if (!table) return res.status(404).json({ message: 'Table not found.' })
  req.app.get('io').to(`menu:${table.hotelId}`).emit('tables_updated')
  res.json({ table })
}))

router.delete('/tables/:id', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_tables')) return res.status(403).json({ message: 'You do not have permission to manage tables.' })
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Table not found.' })
  const table = await DiningTable.findOneAndDelete({
    _id: req.params.id,
    hotelId: hotelScope(req),
    occupiedSeats: 0,
  })
  if (!table) {
    const existing = await DiningTable.exists({ _id: req.params.id, hotelId: hotelScope(req) })
    if (!existing) return res.status(404).json({ message: 'Table not found.' })
    return res.status(409).json({ message: 'Clear this table before removing it.' })
  }
  req.app.get('io').to(`menu:${table.hotelId}`).emit('tables_updated')
  res.status(204).end()
}))

router.get('/categories', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  const categories = await MenuCategory.find({ hotelId: scope }).sort({ name: 1 })
  res.json({ categories: categories.map(category => ({ _id: category._id, name: category.name })) })
}))

router.post('/categories', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_menu')) return res.status(403).json({ message: 'You do not have permission to manage the menu.' })
  const name = String(req.body.name || '').trim().slice(0, 60)
  if (!name) return res.status(400).json({ message: 'Provide a category name.' })
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  const category = await MenuCategory.findOneAndUpdate(
    { hotelId: scope, name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    { $setOnInsert: { hotelId: scope, name } },
    { new: true, upsert: true },
  )
  req.app.get('io').to(`menu:${scope}`).emit('menu_updated', { categoriesChanged: true })
  res.status(201).json({ category: { _id: category._id, name: category.name } })
}))

router.patch('/categories/:id', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_menu')) return res.status(403).json({ message: 'You do not have permission to manage the menu.' })
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Category not found.' })
  const name = String(req.body.name || '').trim().slice(0, 60)
  if (!name) return res.status(400).json({ message: 'Provide a category name.' })
  const scope = hotelScope(req)
  const category = await MenuCategory.findOne({ _id: req.params.id, hotelId: scope })
  if (!category) return res.status(404).json({ message: 'Category not found.' })
  const previousName = category.name
  if (previousName !== name) {
    category.name = name
    await category.save().catch(async error => {
      if (error.code === 11000) {
        const merged = await MenuCategory.findOne({ hotelId: scope, name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })
        if (!merged) throw error
        await MenuItem.updateMany({ hotelId: scope, category: previousName }, { $set: { category: name } })
        await category.deleteOne()
        req.app.get('io').to(`menu:${scope}`).emit('menu_updated', { categoriesChanged: true })
        return res.json({ category: { _id: merged._id, name: merged.name }, merged: true })
      }
      throw error
    })
    if (res.headersSent) return
    await MenuItem.updateMany({ hotelId: scope, category: previousName }, { $set: { category: name } })
  }
  req.app.get('io').to(`menu:${scope}`).emit('menu_updated', { categoriesChanged: true })
  res.json({ category: { _id: category._id, name: category.name } })
}))

router.delete('/categories/:id', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_menu')) return res.status(403).json({ message: 'You do not have permission to manage the menu.' })
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Category not found.' })
  const scope = hotelScope(req)
  const category = await MenuCategory.findOneAndDelete({ _id: req.params.id, hotelId: scope })
  if (!category) return res.status(404).json({ message: 'Category not found.' })
  req.app.get('io').to(`menu:${scope}`).emit('menu_updated', { categoriesChanged: true })
  res.status(204).end()
}))

router.get('/staff', authenticate, authorize('OWNER'), asyncRoute(async (req, res) => {
  const users = await User.find({ hotelId: req.user.hotelId._id, role: 'KITCHEN' }).sort({ createdAt: -1 })
  res.json({ users: users.map(staffUser) })
}))

router.post('/staff', authenticate, authorize('OWNER'), asyncRoute(async (req, res) => {
  const { name, email, password } = req.body
  const permissions = req.body.permissions === undefined ? ALL_PERMISSIONS : req.body.permissions
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!String(name || '').trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
      !isStrongPassword(password)) {
    return res.status(400).json({ message: 'Provide a name, valid email, and a password of at least 8 characters with letters and numbers.' })
  }
  if (!validPermissions(permissions)) {
    return res.status(400).json({ message: 'One or more permissions are not supported.' })
  }
  const user = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    password: await bcrypt.hash(password, 12),
    role: 'KITCHEN',
    hotelId: req.user.hotelId._id,
    permissions,
  })
  storePassword(user, String(password))
  await user.save()
  res.status(201).json({ user: staffUser(user) })
}))

router.patch('/staff/:id', authenticate, authorize('OWNER'), asyncRoute(async (req, res) => {
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Chef account not found.' })
  if (req.body.permissions !== undefined && !validPermissions(req.body.permissions)) {
    return res.status(400).json({ message: 'One or more permissions are not supported.' })
  }
  if (req.body.isActive !== undefined && typeof req.body.isActive !== 'boolean') {
    return res.status(400).json({ message: 'Provide a valid active status.' })
  }
  if (req.body.permissions === undefined && req.body.isActive === undefined) {
    return res.status(400).json({ message: 'Provide permissions or an active status to update.' })
  }
  const user = await User.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId._id,
    role: 'KITCHEN',
  })
  if (!user) return res.status(404).json({ message: 'Chef account not found.' })
  if (req.body.isActive !== undefined) user.isActive = req.body.isActive
  if (req.body.permissions !== undefined) user.permissions = req.body.permissions
  await user.save()
  res.json({ user: staffUser(user) })
}))

router.post('/menu', authenticate, authorize('OWNER', 'KITCHEN'), uploadMenuImage, asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_menu')) return res.status(403).json({ message: 'You do not have permission to manage the menu.' })
  const { name, category, description = '', price, costPrice } = req.body
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  if (!req.file) return res.status(400).json({ message: 'Upload a photo for this menu item.' })
  if (!String(name || '').trim() || !String(category || '').trim() ||
      !Number.isFinite(Number(price)) || Number(price) < 0 ||
      (req.user.role === 'OWNER' && (!Number.isFinite(Number(costPrice)) || Number(costPrice) < 0))) {
    return res.status(400).json({ message: req.user.role === 'OWNER'
      ? 'Name, category, a selling price, and item cost are required.'
      : 'Name, category, and a selling price are required.' })
  }
  const item = await MenuItem.create({
    hotelId: scope,
    name: String(name).trim(),
    category: String(category).trim(),
    description: String(description).trim(),
    price: Number(price),
    costPrice: req.user.role === 'OWNER' ? Number(costPrice) : 0,
    imageUrl: req.file ? `/uploads/${req.file.filename}` : '',
  })
  await MenuCategory.findOneAndUpdate(
    { hotelId: scope, name: new RegExp(`^${String(category).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    { $setOnInsert: { hotelId: scope, name: String(category).trim() } },
    { upsert: true },
  )
  req.app.get('io').to(`menu:${item.hotelId}`).emit('menu_updated', safeMenuItem(item))
  res.status(201).json({ item: req.user.role === 'OWNER' ? item : safeMenuItem(item) })
}))

router.patch('/menu/:id', authenticate, authorize('OWNER', 'KITCHEN'), uploadMenuImage, asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_menu')) return res.status(403).json({ message: 'You do not have permission to manage the menu.' })
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Menu item not found.' })
  const allowed = req.user.role === 'OWNER'
    ? ['name', 'category', 'description', 'price', 'costPrice', 'isAvailable']
    : ['name', 'category', 'description', 'price', 'isAvailable']
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)))
  if (req.file) updates.imageUrl = `/uploads/${req.file.filename}`
  if (!Object.keys(updates).length) return res.status(400).json({ message: 'No supported changes were provided.' })
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  for (const key of ['price', 'costPrice']) {
    if (key in updates && (!Number.isFinite(Number(updates[key])) || Number(updates[key]) < 0)) {
      return res.status(400).json({ message: `${key} must be a non-negative number.` })
    }
    if (key in updates) updates[key] = Number(updates[key])
  }
  const item = await MenuItem.findOne({ _id: req.params.id, hotelId: scope }).select('+costPrice')
  if (!item) return res.status(404).json({ message: 'Menu item not found.' })
  const previousImage = item.imageUrl
  const previousCategory = item.category
  Object.assign(item, updates)
  await item.save()
  if (updates.category && updates.category !== previousCategory) {
    await MenuCategory.findOneAndUpdate(
      { hotelId: scope, name: new RegExp(`^${String(updates.category).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      { $setOnInsert: { hotelId: scope, name: String(updates.category).trim() } },
      { upsert: true },
    )
  }
  if (req.file && previousImage) await removeUploadedImage(previousImage)
  req.app.get('io').to(`menu:${item.hotelId}`).emit('menu_updated', safeMenuItem(item))
  res.json({ item: req.user.role === 'OWNER' ? item : safeMenuItem(item) })
}))

router.delete('/menu/:id', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_menu')) return res.status(403).json({ message: 'You do not have permission to manage the menu.' })
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Menu item not found.' })
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  const item = await MenuItem.findOneAndDelete({ _id: req.params.id, hotelId: scope })
  if (!item) return res.status(404).json({ message: 'Menu item not found.' })
  await removeUploadedImage(item.imageUrl)
  req.app.get('io').to(`menu:${item.hotelId}`).emit('menu_updated', { _id: item._id, deleted: true })
  res.status(204).end()
}))

router.get('/analytics/daily', authenticate, authorize('OWNER'), asyncRoute(async (req, res) => report(req, res)))
router.get('/analytics/reports', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'view_sales')) return res.status(403).json({ message: 'The owner has not granted you permission to view sales.' })
  return report(req, res)
}))

async function report(req, res) {
  const todayInUganda = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const fromDate = String(req.query.from || todayInUganda)
  const toDate = String(req.query.to || todayInUganda)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    return res.status(400).json({ message: 'Provide dates in YYYY-MM-DD format.' })
  }
  const dateIsValid = value => {
    const [year, month, day] = value.split('-').map(Number)
    const parsed = new Date(Date.UTC(year, month - 1, day))
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
  }
  if (!dateIsValid(fromDate) || !dateIsValid(toDate)) {
    return res.status(400).json({ message: 'Provide valid calendar dates.' })
  }
  const from = new Date(`${fromDate}T00:00:00+03:00`)
  const to = new Date(`${toDate}T23:59:59.999+03:00`)
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) {
    return res.status(400).json({ message: 'Provide a valid date range.' })
  }
  const scope = hotelScope(req)
  const filter = { createdAt: { $gte: from, $lte: to }, status: { $ne: 'Cancelled' } }
  if (scope) filter.hotelId = scope
  const match = scope ? { ...filter, hotelId: new mongoose.Types.ObjectId(scope) } : { ...filter, hotelId: { $exists: true } }
  const [orders, totals, series] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).limit(1000),
    Order.aggregate([
      { $match: match },
      { $group: { _id: null, totalOrdersCount: { $sum: 1 }, totalRevenue: { $sum: '$totalAmount' }, totalCost: { $sum: '$totalCost' }, netProfit: { $sum: '$totalProfit' } } },
    ]),
    Order.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Africa/Kampala' } }, revenue: { $sum: '$totalAmount' }, profit: { $sum: '$totalProfit' }, orderCount: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ])
  res.json({
    from: from.toISOString(),
    to: to.toISOString(),
    ...(totals[0] || { totalOrdersCount: 0, totalRevenue: 0, totalCost: 0, netProfit: 0 }),
    series: series.map(day => ({ date: day._id, revenue: day.revenue, profit: day.profit, orderCount: day.orderCount })),
    orders,
  })
}

export default router

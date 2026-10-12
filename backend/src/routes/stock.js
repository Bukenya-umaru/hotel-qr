import express from 'express'
import mongoose from 'mongoose'
import { authenticate, authorize, hotelScope } from '../middleware/auth.js'
import { StockItem } from '../models/StockItem.js'
import { MenuItem } from '../models/MenuItem.js'
import { removeUploadedImage, uploadMenuImage } from '../middleware/upload.js'
import { asyncRoute, idIsValid, safeNumber } from '../utils/http.js'
import { notifyHotel, checkLowStock, LOW_STOCK_LIMIT } from '../utils/notify.js'
import { hasPerm } from './owner.js'

const router = express.Router()

const requireStockPermission = (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_stock')) {
    res.status(403).json({ message: 'The owner has not granted you permission to manage stock.' })
    return false
  }
  return true
}

const normalizeName = value => String(value || '').trim().slice(0, 60)
const normalizeFoodType = value => String(value || '').trim().slice(0, 60)
const STOCK_UNITS = ['plates', 'items', 'cups', 'kg', 'other']
const normalizeUnit = value => {
  const unit = String(value || '').trim().toLowerCase()
  return STOCK_UNITS.includes(unit) ? unit : 'plates'
}
// Free-named measure used when `unit` is 'other', e.g. "crate", "tray".
const normalizeCustomUnit = value => String(value || '').trim().toLowerCase().slice(0, 20)
// Weight can be fractional (2.5 kg); counted things are always whole.
const normalizeQuantity = (value, unit) => {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number) || number < 0) return null
  return unit === 'kg' ? Math.round(number * 100) / 100 : Math.floor(number)
}
const safeAmount = value => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null
}

// Every stock entry plus linked food names, so the chef sees which sale items
// deduct from each stock item without extra requests.
router.get('/', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  const [items, dishes] = await Promise.all([
    StockItem.find({ hotelId: scope }).sort({ name: 1 }).populate('approvedBy', 'name'),
    MenuItem.find({ hotelId: scope }).select('name stockItemId').sort({ name: 1 }),
  ])
  const linked = items.map(item => ({
    _id: item._id,
    name: item.name,
    foodType: item.foodType || '',
    unit: item.unit || 'plates',
    customUnit: item.customUnit || '',
    imageUrl: item.imageUrl || '',
    price: item.price ?? 0,
    // Money this entry is worth right now: per-unit price × count on hand.
    value: Math.round((item.price ?? 0) * (item.plates ?? 0) * 100) / 100,
    plates: item.plates,
    totalAdded: item.totalAdded,
    totalUsed: item.totalUsed,
    approved: item.approved,
    approvedAt: item.approvedAt,
    approvedByName: item.approvedBy?.name || '',
    dishes: dishes.filter(dish => String(dish.stockItemId || '') === String(item._id)).map(dish => dish.name),
  }))
  const unlinked = dishes.filter(dish => !dish.stockItemId).map(dish => ({ _id: dish._id, name: dish.name }))
  res.json({ items: linked, unlinkedDishes: unlinked })
}))

router.post('/', authenticate, authorize('OWNER', 'KITCHEN'), uploadMenuImage, asyncRoute(async (req, res) => {
  if (!requireStockPermission(req, res)) return
  const name = normalizeName(req.body.name)
  const foodType = normalizeFoodType(req.body.foodType)
  const price = safeAmount(req.body.price ?? 0)
  const unit = normalizeUnit(req.body.unit)
  const customUnit = unit === 'other' ? normalizeCustomUnit(req.body.customUnit) : ''
  const quantity = normalizeQuantity(req.body.quantity ?? req.body.plates, unit)
  if (!name) return res.status(400).json({ message: 'Give the stock a name, e.g. Beef plates.' })
  if (!foodType) return res.status(400).json({ message: 'Choose the food type this stock belongs to.' })
  if (unit === 'other' && !customUnit) return res.status(400).json({ message: 'Name the unit, e.g. crate, tray or bottle.' })
  if (quantity === null) return res.status(400).json({ message: 'Enter a count of zero or more.' })
  if (price === null) return res.status(400).json({ message: 'Price must be zero or more.' })
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  const existing = await StockItem.findOne({
    hotelId: scope,
    name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  })
  if (existing) {
    await removeUploadedImage(req.file ? `/uploads/${req.file.filename}` : '')
    return res.status(409).json({ message: 'A stock with that name already exists.' })
  }
  const stock = await StockItem.create({
    hotelId: scope,
    name,
    foodType,
    unit,
    customUnit,
    imageUrl: req.file ? `/uploads/${req.file.filename}` : '',
    price,
    plates: quantity,
    totalAdded: quantity,
    // Stock added by someone allowed to approve is trusted straight away;
    // everyone else's waits for the owner's (or an approver's) sign-off.
    approved: hasPerm(req.user, 'approve_records'),
    approvedBy: hasPerm(req.user, 'approve_records') ? req.user._id : null,
    approvedAt: hasPerm(req.user, 'approve_records') ? new Date() : null,
  })
  if (!stock.approved) {
    await notifyHotel(req.app.get('io'), String(scope), {
      type: 'stock_pending',
      title: `Stock awaits confirmation — ${stock.name}`,
      body: `${quantity} ${noun(stock)} added by ${req.user.name}`,
      refId: stock._id,
    })
  }
  req.app.get('io').to(`hotel:${scope}`).emit('stock_updated')
  res.status(201).json({ item: stock })
}))

router.patch('/:id/adjust', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (!requireStockPermission(req, res)) return
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Stock not found.' })
  const scope = hotelScope(req)
  const stock = await StockItem.findOne({ _id: req.params.id, hotelId: scope })
  if (!stock) return res.status(404).json({ message: 'Stock not found.' })
  const noun = stock.unit === 'kg' ? 'kg'
    : stock.unit === 'items' ? 'items'
    : stock.unit === 'cups' ? 'cups'
    : stock.unit === 'other' && stock.customUnit ? stock.customUnit
    : 'plates'
  const delta = Number(req.body.delta)
  const whole = stock.unit === 'kg' ? Math.abs(delta * 100 - Math.round(delta * 100)) < 0.001 : Number.isInteger(delta)
  if (!whole || delta === 0 || Math.abs(delta) > 100000) {
    return res.status(400).json({ message: `Provide a number of ${noun} to add or reduce.` })
  }
  const nextPlates = stock.plates + delta
  if (nextPlates < 0) return res.status(409).json({ message: `Only ${stock.plates} ${noun} left — you cannot reduce more than are in stock.` })
  stock.plates = nextPlates
  if (delta > 0) {
    stock.totalAdded += delta
    // Freshly added stock needs sign-off again — unless the person adding
    // it is allowed to approve, in which case it is trusted straight away.
    // Reducing (waste, spoilage) never touches the approval.
    const autoApproved = hasPerm(req.user, 'approve_records')
    stock.approved = autoApproved
    stock.approvedBy = autoApproved ? req.user._id : null
    stock.approvedAt = autoApproved ? new Date() : null
  }
  // `price` is the rate for one plate/item/kg, so it never changes with the
  // count — the money value of the entry moves on its own (price × count).
  await stock.save()
  if (delta < 0) await checkLowStock(req.app.get('io'), String(scope), [stock._id])
  req.app.get('io').to(`hotel:${scope}`).emit('stock_updated')
  res.json({ item: stock })
}))

router.patch('/:id', authenticate, authorize('OWNER', 'KITCHEN'), uploadMenuImage, asyncRoute(async (req, res) => {
  if (!requireStockPermission(req, res)) return
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Stock not found.' })
  const scope = hotelScope(req)
  const current = await StockItem.findOne({ _id: req.params.id, hotelId: scope }).select('unit customUnit imageUrl approved plates')
  if (!current) return res.status(404).json({ message: 'Stock not found.' })
  // Approved stock is the signed-off record — its details can no longer change.
  if (current.approved) return res.status(403).json({ message: 'This stock has been approved and can no longer be edited.' })
  const updates = {}
  if (req.body.name !== undefined) {
    const name = normalizeName(req.body.name)
    if (!name) return res.status(400).json({ message: 'Give the stock a name.' })
    updates.name = name
  }
  if (req.body.unit !== undefined) updates.unit = normalizeUnit(req.body.unit)
  if (req.body.customUnit !== undefined) updates.customUnit = normalizeCustomUnit(req.body.customUnit)
  // A named measure only makes sense for the 'other' unit.
  if (updates.unit && updates.unit !== 'other') updates.customUnit = ''
  const nextUnit = updates.unit || current.unit || 'plates'
  const nextCustomUnit = updates.customUnit !== undefined ? updates.customUnit : (current.customUnit || '')
  if (nextUnit === 'other' && !nextCustomUnit) return res.status(400).json({ message: 'Name the unit, e.g. crate, tray or bottle.' })
  if (req.body.quantity !== undefined || req.body.plates !== undefined) {
    const quantity = normalizeQuantity(req.body.quantity ?? req.body.plates, updates.unit || current.unit || 'plates')
    if (quantity === null) return res.status(400).json({ message: 'Enter a count of zero or more.' })
    updates.plates = quantity
  }
  if (req.body.foodType !== undefined) updates.foodType = normalizeFoodType(req.body.foodType)
  if (req.body.price !== undefined) {
    const price = safeAmount(req.body.price)
    if (price === null) return res.status(400).json({ message: 'Price must be zero or more.' })
    updates.price = price
  }
  if (req.file) updates.imageUrl = `/uploads/${req.file.filename}`
  if (!Object.keys(updates).length) return res.status(400).json({ message: 'No supported changes were provided.' })
  if (updates.name) {
    const duplicate = await StockItem.findOne({
      _id: { $ne: req.params.id },
      hotelId: scope,
      name: new RegExp(`^${updates.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    })
    if (duplicate) {
      if (req.file) await removeUploadedImage(updates.imageUrl)
      return res.status(409).json({ message: 'A stock with that name already exists.' })
    }
  }
  const stock = await StockItem.findOneAndUpdate(
    { _id: req.params.id, hotelId: scope },
    { $set: updates },
    { new: true },
  )
  if (!stock) {
    if (req.file) await removeUploadedImage(updates.imageUrl)
    return res.status(404).json({ message: 'Stock not found.' })
  }
  if (req.file && current.imageUrl) await removeUploadedImage(current.imageUrl)
  // Editing the count down is the same as reducing it — alert the staff when
  // the edited count has dipped to the low-stock limit.
  if (stock.plates < current.plates) await checkLowStock(req.app.get('io'), String(scope), [stock._id])
  req.app.get('io').to(`hotel:${scope}`).emit('stock_updated')
  res.json({ item: stock })
}))

router.delete('/:id', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (!requireStockPermission(req, res)) return
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Stock not found.' })
  const scope = hotelScope(req)
  const stock = await StockItem.findOne({ _id: req.params.id, hotelId: scope })
  if (!stock) return res.status(404).json({ message: 'Stock not found.' })
  // Approved stock is the signed-off record — it can no longer be removed.
  if (stock.approved) return res.status(403).json({ message: 'This stock has been approved and can no longer be changed.' })
  await StockItem.deleteOne({ _id: stock._id })
  // Detach linked food items so future sales no longer deduct this stock.
  await MenuItem.updateMany({ hotelId: scope, stockItemId: stock._id }, { $unset: { stockItemId: '' } })
  await removeUploadedImage(stock.imageUrl)
  req.app.get('io').to(`hotel:${scope}`).emit('stock_updated')
  res.status(204).end()
}))

// The owner — or staff granted the approval permission — signs the stock's
// current count off. Approved stock can no longer be edited or removed, and
// newly added stock goes back to pending until it is approved again.
router.post('/:id/approve', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (!hasPerm(req.user, 'approve_records')) return res.status(403).json({ message: 'You do not have permission to approve stock.' })
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Stock not found.' })
  const scope = hotelScope(req)
  const stock = await StockItem.findOneAndUpdate(
    { _id: req.params.id, hotelId: scope },
    { $set: { approved: true, approvedBy: req.user._id, approvedAt: new Date() } },
    { new: true },
  ).populate('approvedBy', 'name')
  if (!stock) return res.status(404).json({ message: 'Stock not found.' })
  await notifyHotel(req.app.get('io'), String(scope), {
    type: 'stock_confirmed',
    title: `Stock confirmed — ${stock.name}`,
    body: `${stock.plates} ${noun(stock)} signed off by ${req.user.name}`,
    refId: stock._id,
  })
  req.app.get('io').to(`hotel:${scope}`).emit('stock_updated')
  res.json({ item: stock })
}))

router.post('/:id/link', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (!requireStockPermission(req, res)) return
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Stock not found.' })
  const menuItemId = String(req.body.menuItemId || '')
  if (!idIsValid(menuItemId)) return res.status(400).json({ message: 'Choose a dish to link.' })
  const scope = hotelScope(req)
  const stock = await StockItem.findOne({ _id: req.params.id, hotelId: scope })
  if (!stock) return res.status(404).json({ message: 'Stock not found.' })
  const menuItem = await MenuItem.findOne({ _id: menuItemId, hotelId: scope })
  if (!menuItem) return res.status(404).json({ message: 'Dish not found.' })
  menuItem.stockItemId = stock._id
  await menuItem.save()
  req.app.get('io').to(`hotel:${scope}`).emit('stock_updated')
  res.json({ ok: true })
}))

router.post('/:id/unlink', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (!requireStockPermission(req, res)) return
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Stock not found.' })
  const menuItemId = String(req.body.menuItemId || '')
  if (!idIsValid(menuItemId)) return res.status(400).json({ message: 'Choose a dish to unlink.' })
  const scope = hotelScope(req)
  await MenuItem.updateOne(
    { _id: menuItemId, hotelId: scope, stockItemId: req.params.id },
    { $unset: { stockItemId: '' } },
  )
  req.app.get('io').to(`hotel:${scope}`).emit('stock_updated')
  res.json({ ok: true })
}))

export default router

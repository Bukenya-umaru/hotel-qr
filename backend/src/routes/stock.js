import express from 'express'
import mongoose from 'mongoose'
import { authenticate, authorize, hotelScope } from '../middleware/auth.js'
import { StockItem } from '../models/StockItem.js'
import { MenuItem } from '../models/MenuItem.js'
import { removeUploadedImage, uploadMenuImage } from '../middleware/upload.js'
import { asyncRoute, idIsValid, safeNumber } from '../utils/http.js'
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
const STOCK_UNITS = ['plates', 'items', 'kg']
const normalizeUnit = value => {
  const unit = String(value || '').trim().toLowerCase()
  return STOCK_UNITS.includes(unit) ? unit : 'plates'
}
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

// Every stock entry plus the dish names that deduct from it, so the chef
// sees which dishes pull from which plates without extra requests.
router.get('/', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  const [items, dishes] = await Promise.all([
    StockItem.find({ hotelId: scope }).sort({ name: 1 }),
    MenuItem.find({ hotelId: scope }).select('name stockItemId').sort({ name: 1 }),
  ])
  const linked = items.map(item => ({
    _id: item._id,
    name: item.name,
    foodType: item.foodType || '',
    unit: item.unit || 'plates',
    imageUrl: item.imageUrl || '',
    price: item.price ?? 0,
    plates: item.plates,
    totalAdded: item.totalAdded,
    totalUsed: item.totalUsed,
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
  const quantity = normalizeQuantity(req.body.quantity ?? req.body.plates, unit)
  if (!name) return res.status(400).json({ message: 'Give the stock a name, e.g. Beef plates.' })
  if (!foodType) return res.status(400).json({ message: 'Choose the food type this stock belongs to.' })
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
    imageUrl: req.file ? `/uploads/${req.file.filename}` : '',
    price,
    plates: quantity,
    totalAdded: quantity,
  })
  req.app.get('io').to(`hotel:${scope}`).emit('stock_updated')
  res.status(201).json({ item: stock })
}))

router.patch('/:id/adjust', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (!requireStockPermission(req, res)) return
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Stock not found.' })
  const scope = hotelScope(req)
  const stock = await StockItem.findOne({ _id: req.params.id, hotelId: scope })
  if (!stock) return res.status(404).json({ message: 'Stock not found.' })
  const noun = stock.unit === 'kg' ? 'kg' : stock.unit === 'items' ? 'items' : 'plates'
  const delta = Number(req.body.delta)
  const whole = stock.unit === 'kg' ? Math.abs(delta * 100 - Math.round(delta * 100)) < 0.001 : Number.isInteger(delta)
  if (!whole || delta === 0 || Math.abs(delta) > 100000) {
    return res.status(400).json({ message: `Provide a number of ${noun} to add or reduce.` })
  }
  const nextPlates = stock.plates + delta
  if (nextPlates < 0) return res.status(409).json({ message: `Only ${stock.plates} ${noun} left — you cannot reduce more than are in stock.` })
  stock.plates = nextPlates
  if (delta > 0) stock.totalAdded += delta
  // Keep the money value proportional to the count (same per-unit value); if
  // the stock was at zero the price is left for the chef to set explicitly.
  if (stock.plates > 0 && stock.plates !== nextPlates) {
    stock.price = safeAmount(stock.price * (nextPlates / stock.plates)) ?? stock.price
  }
  await stock.save()
  req.app.get('io').to(`hotel:${scope}`).emit('stock_updated')
  res.json({ item: stock })
}))

router.patch('/:id', authenticate, authorize('OWNER', 'KITCHEN'), uploadMenuImage, asyncRoute(async (req, res) => {
  if (!requireStockPermission(req, res)) return
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Stock not found.' })
  const scope = hotelScope(req)
  const current = await StockItem.findOne({ _id: req.params.id, hotelId: scope }).select('unit imageUrl')
  if (!current) return res.status(404).json({ message: 'Stock not found.' })
  const updates = {}
  if (req.body.name !== undefined) {
    const name = normalizeName(req.body.name)
    if (!name) return res.status(400).json({ message: 'Give the stock a name.' })
    updates.name = name
  }
  if (req.body.unit !== undefined) updates.unit = normalizeUnit(req.body.unit)
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
  req.app.get('io').to(`hotel:${scope}`).emit('stock_updated')
  res.json({ item: stock })
}))

router.delete('/:id', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (!requireStockPermission(req, res)) return
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Stock not found.' })
  const scope = hotelScope(req)
  const stock = await StockItem.findOneAndDelete({ _id: req.params.id, hotelId: scope })
  if (!stock) return res.status(404).json({ message: 'Stock not found.' })
  // Detach dishes that were linked so their next orders stop deducting.
  await MenuItem.updateMany({ hotelId: scope, stockItemId: stock._id }, { $unset: { stockItemId: '' } })
  await removeUploadedImage(stock.imageUrl)
  req.app.get('io').to(`hotel:${scope}`).emit('stock_updated')
  res.status(204).end()
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

import bcrypt from 'bcryptjs'
import express from 'express'
import mongoose from 'mongoose'
import { authenticate, authorize, hotelScope } from '../middleware/auth.js'
import { sensitiveLimiter } from '../middleware/rateLimit.js'
import { cacheHotelResource } from '../utils/cache.js'
import { User } from '../models/User.js'
import { MenuItem } from '../models/MenuItem.js'
import { MenuCategory } from '../models/MenuCategory.js'
import { Expense } from '../models/Expense.js'
import { ExpenseCategory } from '../models/ExpenseCategory.js'
import { HotelExpense } from '../models/HotelExpense.js'
import { DamageRecord } from '../models/DamageRecord.js'
import { Sale, formatSaleId } from '../models/Sale.js'
import { StockItem } from '../models/StockItem.js'
import { Hotel } from '../models/Hotel.js'
import { removeUploadedImage, uploadMenuImage } from '../middleware/upload.js'
import { asyncRoute, idIsValid, safeMenuItem, safeSupport } from '../utils/http.js'
import { notifyHotel, checkLowStock, broadcastChange } from '../utils/notify.js'
import { revealPassword, storePassword, vaultEnabled } from '../utils/passwordVault.js'
import { isStrongPassword, PASSWORD_RULE_MESSAGE } from '../utils/passwordPolicy.js'
import { ALL_PERMISSIONS } from '../utils/permissions.js'

const router = express.Router()

export const hasPerm = (user, key) => user.role !== 'KITCHEN' || !user.permissions || user.permissions.includes(key)
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

// Business contact details shown on the information page.
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
  res.json({ support: safeSupport(hotel.support) })
}))

router.get('/menu', authenticate, authorize('OWNER', 'KITCHEN'), cacheHotelResource('menu', req => req.user.role), asyncRoute(async (req, res) => {
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  const query = MenuItem.find({ hotelId: scope }).sort({ category: 1, name: 1 }).lean()
  if (req.user.role === 'OWNER') query.select('+costPrice')
  res.json({ items: await query })
}))

router.get('/categories', authenticate, authorize('OWNER', 'KITCHEN'), cacheHotelResource('categories'), asyncRoute(async (req, res) => {
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  const categories = await MenuCategory.find({ hotelId: scope }).sort({ name: 1 }).lean()
  res.json({ categories: categories.map(category => ({ _id: category._id, name: category.name, foodType: category.foodType || '' })) })
}))

router.post('/categories', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_menu')) return res.status(403).json({ message: 'You do not have permission to manage the menu.' })
  const name = String(req.body.name || '').trim().slice(0, 60)
  const foodType = String(req.body.foodType || '').trim().slice(0, 60)
  if (!name) return res.status(400).json({ message: 'Provide a category name.' })
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  const category = await MenuCategory.findOneAndUpdate(
    { hotelId: scope, name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    { $setOnInsert: { hotelId: scope, name, foodType } },
    { new: true, upsert: true },
  )
  res.status(201).json({ category: { _id: category._id, name: category.name, foodType: category.foodType } })
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
  const foodType = req.body.foodType === undefined
    ? category.foodType
    : String(req.body.foodType || '').trim().slice(0, 60)
  if (previousName !== name || foodType !== category.foodType) {
    category.name = name
    category.foodType = foodType
    await category.save().catch(async error => {
      if (error.code === 11000) {
        const merged = await MenuCategory.findOne({ hotelId: scope, name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })
        if (!merged) throw error
        await MenuItem.updateMany({ hotelId: scope, category: previousName }, { $set: { category: name } })
        await category.deleteOne()
        return res.json({ category: { _id: merged._id, name: merged.name }, merged: true })
      }
      throw error
    })
    if (res.headersSent) return
    await MenuItem.updateMany({ hotelId: scope, category: previousName }, { $set: { category: name } })
  }
  res.json({ category: { _id: category._id, name: category.name, foodType: category.foodType || '' } })
}))

router.delete('/categories/:id', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_menu')) return res.status(403).json({ message: 'You do not have permission to manage the menu.' })
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Category not found.' })
  const scope = hotelScope(req)
  const category = await MenuCategory.findOneAndDelete({ _id: req.params.id, hotelId: scope })
  if (!category) return res.status(404).json({ message: 'Category not found.' })
  await Expense.deleteMany({ hotelId: scope, category: category._id })
  res.status(204).end()
}))

// Name-only expense categories the chef defines (e.g. "Cooking gas").
router.get('/expense-categories', authenticate, authorize('OWNER', 'KITCHEN'), cacheHotelResource('expense-categories'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_expenses')) return res.status(403).json({ message: 'The owner has not granted you permission to manage expenses.' })
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  const categories = await ExpenseCategory.find({ hotelId: scope }).sort({ name: 1 }).lean()
  res.json({ categories: categories.map(category => ({ _id: category._id, name: category.name })) })
}))

router.post('/expense-categories', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_expenses')) return res.status(403).json({ message: 'The owner has not granted you permission to manage expenses.' })
  const name = String(req.body.name || '').trim().slice(0, 60)
  if (!name) return res.status(400).json({ message: 'Give the expense category a name, e.g. Cooking gas.' })
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  const category = await ExpenseCategory.findOneAndUpdate(
    { hotelId: scope, name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    { $setOnInsert: { hotelId: scope, name } },
    { new: true, upsert: true },
  )
  res.status(201).json({ category: { _id: category._id, name: category.name } })
}))

router.patch('/expense-categories/:id', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_expenses')) return res.status(403).json({ message: 'The owner has not granted you permission to manage expenses.' })
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Expense category not found.' })
  const name = String(req.body.name || '').trim().slice(0, 60)
  if (!name) return res.status(400).json({ message: 'Give the expense category a name.' })
  const scope = hotelScope(req)
  const category = await ExpenseCategory.findOne({ _id: req.params.id, hotelId: scope })
  if (!category) return res.status(404).json({ message: 'Expense category not found.' })
  category.name = name
  await category.save().catch(error => {
    if (error.code === 11000) return res.status(409).json({ message: 'An expense category with that name already exists.' })
    throw error
  })
  if (res.headersSent) return
  res.json({ category: { _id: category._id, name: category.name } })
}))

router.delete('/expense-categories/:id', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_expenses')) return res.status(403).json({ message: 'The owner has not granted you permission to manage expenses.' })
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Expense category not found.' })
  const category = await ExpenseCategory.findOneAndDelete({ _id: req.params.id, hotelId: hotelScope(req) })
  if (!category) return res.status(404).json({ message: 'Expense category not found.' })
  res.status(204).end()
}))

// The hotel-wide expense ledger: everything the business spends, filed
// under the expense categories managed in Categories > Expenses. Recording
// with a brand-new category name creates the bucket on the fly.
const requireExpenseAccess = (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_expenses')) {
    res.status(403).json({ message: 'The owner has not granted you permission to manage expenses.' })
    return false
  }
  return true
}

router.get('/expenses', authenticate, authorize('OWNER', 'KITCHEN'), cacheHotelResource('expenses'), asyncRoute(async (req, res) => {
  if (!requireExpenseAccess(req, res)) return
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const [expenses, allTime, todayTotals, byCategory] = await Promise.all([
    HotelExpense.find({ hotelId: scope }).sort({ createdAt: -1 }).limit(100).populate('recordedBy', 'name').populate('approvedBy', 'name').lean(),
    HotelExpense.aggregate([
      { $match: { hotelId: new mongoose.Types.ObjectId(scope) } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    HotelExpense.aggregate([
      { $match: { hotelId: new mongoose.Types.ObjectId(scope), createdAt: { $gte: startOfToday } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    HotelExpense.aggregate([
      { $match: { hotelId: new mongoose.Types.ObjectId(scope) } },
      { $group: { _id: '$categoryName', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
  ])
  res.json({
    total: allTime[0]?.total || 0,
    count: allTime[0]?.count || 0,
    todayTotal: todayTotals[0]?.total || 0,
    todayCount: todayTotals[0]?.count || 0,
    byCategory: byCategory.map(entry => ({ category: entry._id, total: entry.total, count: entry.count })),
    expenses: expenses.map(expense => ({
      _id: expense._id,
      category: String(expense.category),
      categoryName: expense.categoryName,
      amount: expense.amount,
      note: expense.note,
      recordedBy: expense.recordedBy?.name || '',
      createdAt: expense.createdAt,
      approved: expense.approved,
      approvedAt: expense.approvedAt,
      approvedByName: expense.approvedBy?.name || '',
      // Change trail for the owner: what the expense looked like before each
      // edit, newest last.
      edits: (expense.edits || []).map(edit => ({
        amount: edit.amount,
        note: edit.note || '',
        categoryName: edit.categoryName || '',
        editedByName: edit.editedByName || '',
        editedAt: edit.editedAt,
      })),
    })),
  })
}))

router.post('/expenses', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (!requireExpenseAccess(req, res)) return
  const amount = Number(req.body.amount)
  const note = String(req.body.note || '').trim().slice(0, 200)
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Enter an expense amount greater than zero.' })
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  let category
  if (idIsValid(req.body.categoryId)) {
    category = await ExpenseCategory.findOne({ _id: req.body.categoryId, hotelId: scope })
    if (!category) return res.status(404).json({ message: 'Expense category not found.' })
  } else {
    const name = String(req.body.categoryName || '').trim().slice(0, 60)
    if (!name) return res.status(400).json({ message: 'Choose a category, or type a new category name.' })
    category = await ExpenseCategory.findOneAndUpdate(
      { hotelId: scope, name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      { $setOnInsert: { hotelId: scope, name } },
      { new: true, upsert: true },
    )
  }
  // A record made by someone allowed to approve is trusted straight away;
  // everyone else's waits for the owner's (or an approver's) sign-off.
  const autoApproved = hasPerm(req.user, 'approve_records')
  const expense = await HotelExpense.create({
    hotelId: scope,
    category: category._id,
    categoryName: category.name,
    amount: Math.round(amount * 100) / 100,
    note,
    recordedBy: req.user._id,
    approved: autoApproved,
    approvedBy: autoApproved ? req.user._id : null,
    approvedAt: autoApproved ? new Date() : null,
  })
  await notifyHotel(req.app.get('io'), scope, {
    type: 'new_expense',
    title: `New expense recorded — ${category.name}`,
    body: `${expense.amount} · ${note || 'no note'} · by ${req.user.name}${autoApproved ? '' : ' · awaiting approval'}`,
    refId: expense._id,
  })
  broadcastChange(req.app.get('io'), scope, 'expenses_changed')
  res.status(201).json({ expense: { ...expense.toObject(), recordedBy: req.user.name } })
}))

router.delete('/expenses/:expenseId', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (!requireExpenseAccess(req, res)) return
  if (!idIsValid(req.params.expenseId)) return res.status(404).json({ message: 'Expense not found.' })
  const expense = await HotelExpense.findOne({ _id: req.params.expenseId, hotelId: hotelScope(req) }).select('approved')
  if (!expense) return res.status(404).json({ message: 'Expense not found.' })
  // Approved expenses are the books of record — they can no longer be changed.
  if (expense.approved) return res.status(403).json({ message: 'This expense has been approved and can no longer be changed.' })
  await HotelExpense.deleteOne({ _id: expense._id })
  broadcastChange(req.app.get('io'), String(hotelScope(req)), 'expenses_changed')
  res.status(204).end()
}))

// A chef with the edit permission can correct any unapproved expense until
// it is signed off. Every edit snapshots what the expense looked like
// BEFORE the change into `edits`, so the owner sees "changed from X to this"
// with who made the change and when.
router.patch('/expenses/:expenseId', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (!requireExpenseAccess(req, res)) return
  if (!idIsValid(req.params.expenseId)) return res.status(404).json({ message: 'Expense not found.' })
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'approve_records') && !hasPerm(req.user, 'edit_records')) {
    return res.status(403).json({ message: 'The owner has not granted you permission to edit expenses.' })
  }
  const scope = hotelScope(req)
  const expense = await HotelExpense.findOne({ _id: req.params.expenseId, hotelId: scope })
  if (!expense) return res.status(404).json({ message: 'Expense not found.' })
  // Approved expenses are the books of record — they can no longer be changed.
  if (expense.approved) return res.status(403).json({ message: 'This expense has been approved and can no longer be changed.' })
  const amount = Number(req.body.amount)
  const note = String(req.body.note || '').trim().slice(0, 200)
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Enter an expense amount greater than zero.' })
  // Category can be re-picked by id or created by name, exactly as when
  // recording. Omitted means the expense keeps its current category.
  let category = null
  let categoryName = expense.categoryName
  if (req.body.categoryId !== undefined || req.body.categoryName !== undefined) {
    if (idIsValid(req.body.categoryId)) {
      category = await ExpenseCategory.findOne({ _id: req.body.categoryId, hotelId: scope })
      if (!category) return res.status(404).json({ message: 'Expense category not found.' })
    } else {
      const name = String(req.body.categoryName || '').trim().slice(0, 60)
      if (!name) return res.status(400).json({ message: 'Choose a category, or type a new category name.' })
      category = await ExpenseCategory.findOneAndUpdate(
        { hotelId: scope, name: new RegExp(`^${name.replace(/[.*+?^${}()|[\\]]/g, '\\$&')}$`, 'i') },
        { $setOnInsert: { hotelId: scope, name } },
        { new: true, upsert: true },
      )
    }
    categoryName = category.name
  }
  const same = expense.amount === Math.round(amount * 100) / 100
    && expense.note === note
    && (!category || String(category._id) === String(expense.category))
  if (same) return res.status(400).json({ message: 'Nothing changed — update the amount, category or note before saving.' })
  expense.edits = [...(expense.edits || []), {
    amount: expense.amount,
    note: expense.note || '',
    categoryName: expense.categoryName,
    editedBy: req.user._id,
    editedByName: req.user.name,
    editedAt: new Date(),
  }].slice(-20)
  expense.amount = Math.round(amount * 100) / 100
  expense.note = note
  if (category) {
    expense.category = category._id
    expense.categoryName = categoryName
  }
  await expense.save()
  broadcastChange(req.app.get('io'), String(scope), 'expenses_changed')
  res.json({ expense: { ...expense.toObject(), editedByName: req.user.name } })
}))

// The owner — or staff granted the approval permission — signs an expense off.
// Once approved the expense is locked and can no longer be deleted.
router.post('/expenses/:expenseId/approve', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (!hasPerm(req.user, 'approve_records')) return res.status(403).json({ message: 'You do not have permission to approve expenses.' })
  if (!idIsValid(req.params.expenseId)) return res.status(404).json({ message: 'Expense not found.' })
  const expense = await HotelExpense.findOneAndUpdate(
    { _id: req.params.expenseId, hotelId: hotelScope(req) },
    { $set: { approved: true, approvedBy: req.user._id, approvedAt: new Date() } },
    { new: true },
  )
  if (!expense) return res.status(404).json({ message: 'Expense not found.' })
  await notifyHotel(req.app.get('io'), String(hotelScope(req)), {
    type: 'expense_approved',
    title: `Expense approved — ${expense.categoryName}`,
    body: `Signed off by ${req.user.name}`,
    refId: expense._id,
  })
  broadcastChange(req.app.get('io'), String(hotelScope(req)), 'expenses_changed')
  res.json({ expense: { ...expense.toObject(), approvedByName: req.user.name } })
}))

// ---- Damaged goods: stock lost to spoilage, breakage, spillage etc. ----
// ---- Records drawn from stock reduce its count; deleting a record   ----
// ---- restores it. Entries not tied to stock are recorded as-is.     ----

router.get('/damages', authenticate, authorize('OWNER', 'KITCHEN'), cacheHotelResource('damages'), asyncRoute(async (req, res) => {
  if (!requireExpenseAccess(req, res)) return
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const [damages, allTime, todayTotals] = await Promise.all([
    DamageRecord.find({ hotelId: scope }).sort({ createdAt: -1 }).limit(100).populate('recordedBy', 'name').populate('approvedBy', 'name').populate('stockItemId', 'name imageUrl').lean(),
    DamageRecord.aggregate([
      { $match: { hotelId: new mongoose.Types.ObjectId(scope) } },
      { $group: { _id: null, total: { $sum: '$value' }, count: { $sum: 1 } } },
    ]),
    DamageRecord.aggregate([
      { $match: { hotelId: new mongoose.Types.ObjectId(scope), createdAt: { $gte: startOfToday } } },
      { $group: { _id: null, total: { $sum: '$value' }, count: { $sum: 1 } } },
    ]),
  ])
  res.json({
    total: allTime[0]?.total || 0,
    count: allTime[0]?.count || 0,
    todayTotal: todayTotals[0]?.total || 0,
    todayCount: todayTotals[0]?.count || 0,
    damages: damages.map(damage => ({
      _id: damage._id,
      name: damage.name,
      quantity: damage.quantity,
      unit: damage.unit || '',
      value: damage.value,
      stockItem: damage.stockItemId ? { _id: String(damage.stockItemId._id || damage.stockItemId), name: damage.stockItemId.name || '', imageUrl: damage.stockItemId.imageUrl || '' } : null,
      note: damage.note,
      recordedBy: damage.recordedBy?.name || '',
      createdAt: damage.createdAt,
      approved: damage.approved,
      approvedAt: damage.approvedAt,
      approvedByName: damage.approvedBy?.name || '',
      edits: (damage.edits || []).map(edit => ({
        name: edit.name,
        quantity: edit.quantity,
        value: edit.value,
        note: edit.note || '',
        editedByName: edit.editedByName || '',
        editedAt: edit.editedAt,
      })),
    })),
  })
}))

router.post('/damages', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (!requireExpenseAccess(req, res)) return
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  const name = String(req.body.name || '').trim().slice(0, 60)
  const quantity = req.body.quantity === undefined || req.body.quantity === '' ? 1 : Number(req.body.quantity)
  const unit = String(req.body.unit || '').trim().toLowerCase().slice(0, 20)
  const note = String(req.body.note || '').trim().slice(0, 200)
  if (!name) return res.status(400).json({ message: 'Give the damaged item a name, e.g. Beef plates.' })
  if (!Number.isFinite(quantity) || quantity <= 0) return res.status(400).json({ message: 'Enter the quantity that was damaged.' })
  // Stock-picked damages price themselves from the stock's unit price ×
  // quantity; a tampered client cannot set its own value for those.
  let stockItem = null
  let value = 0
  if (idIsValid(req.body.stockItemId)) {
    stockItem = await StockItem.findOne({ _id: req.body.stockItemId, hotelId: scope })
    if (!stockItem) return res.status(404).json({ message: 'The chosen stock item could not be found.' })
    if (stockItem.plates < quantity) return res.status(400).json({ message: `Only ${stockItem.plates} ${stockItem.unit === 'other' ? `(${stockItem.customUnit || 'units'})` : stockItem.unit || 'units'} of ${stockItem.name} in stock — you cannot record damage of ${quantity}.` })
    value = Math.round((stockItem.price || 0) * quantity * 100) / 100
  } else {
    value = Math.round((Number(req.body.value) || 0) * 100) / 100
    if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ message: 'Enter the money value of what was damaged.' })
  }
  const damage = await DamageRecord.create({
    hotelId: scope,
    name,
    quantity: Math.round(quantity * 100) / 100,
    unit,
    value,
    stockItemId: stockItem ? stockItem._id : null,
    note,
    recordedBy: req.user._id,
    // Records by someone allowed to approve are trusted straight away;
    // everyone else's wait for the owner's (or an approver's) sign-off.
    approved: hasPerm(req.user, 'approve_records'),
    approvedBy: hasPerm(req.user, 'approve_records') ? req.user._id : null,
    approvedAt: hasPerm(req.user, 'approve_records') ? new Date() : null,
  })
  if (stockItem) {
    await StockItem.updateOne({ _id: stockItem._id, plates: { $gte: quantity } }, { $inc: { plates: -quantity, totalUsed: quantity } }).catch(() => {})
    req.app.get('io').to(`hotel:${scope}`).emit('stock_updated')
    await checkLowStock(req.app.get('io'), scope, [String(stockItem._id)])
  }
  await notifyHotel(req.app.get('io'), scope, {
    type: 'new_damage',
    title: `Damage recorded — ${damage.name}`,
    body: `${damage.quantity} ${damage.unit || 'units'} · ${damage.value} value · by ${req.user.name}`,
    refId: damage._id,
  })
  broadcastChange(req.app.get('io'), scope, 'damages_changed')
  res.status(201).json({ damage: { ...damage.toObject(), recordedBy: req.user.name } })
}))

router.delete('/damages/:damageId', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (!requireExpenseAccess(req, res)) return
  if (!idIsValid(req.params.damageId)) return res.status(404).json({ message: 'Damage record not found.' })
  const scope = hotelScope(req)
  const damage = await DamageRecord.findOne({ _id: req.params.damageId, hotelId: scope })
  if (!damage) return res.status(404).json({ message: 'Damage record not found.' })
  // Approved damages are the books of record — they can no longer be changed.
  if (damage.approved) return res.status(403).json({ message: 'This damage has been approved and can no longer be changed.' })
  await DamageRecord.deleteOne({ _id: damage._id })
  // Restoring stock on delete keeps the ledger consistent with the count.
  if (damage.stockItemId && damage.quantity > 0) {
    await StockItem.updateOne({ _id: damage.stockItemId, hotelId: scope }, { $inc: { plates: damage.quantity, totalUsed: -damage.quantity } }).catch(() => {})
    req.app.get('io').to(`hotel:${scope}`).emit('stock_updated')
  }
  broadcastChange(req.app.get('io'), String(scope), 'damages_changed')
  res.status(204).end()
}))

// A chef with the edit permission can correct any unapproved damage until
// it is signed off. The drawn stock follows the correction: the previously
// recorded quantity is restored to the old stock item and the new amount is
// deducted (priced from the stock's unit value like a fresh record), or the
// value is set by hand for records not tied to stock.
router.patch('/damages/:damageId', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (!requireExpenseAccess(req, res)) return
  if (!idIsValid(req.params.damageId)) return res.status(404).json({ message: 'Damage record not found.' })
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'approve_records') && !hasPerm(req.user, 'edit_records')) {
    return res.status(403).json({ message: 'The owner has not granted you permission to edit damage records.' })
  }
  const scope = hotelScope(req)
  const damage = await DamageRecord.findOne({ _id: req.params.damageId, hotelId: scope })
  if (!damage) return res.status(404).json({ message: 'Damage record not found.' })
  if (damage.approved) return res.status(403).json({ message: 'This damage has been approved and can no longer be changed.' })
  const name = req.body.name === undefined ? damage.name : String(req.body.name || '').trim().slice(0, 60)
  const quantity = req.body.quantity === undefined || req.body.quantity === '' ? damage.quantity : Number(req.body.quantity)
  const note = req.body.note === undefined ? damage.note : String(req.body.note || '').trim().slice(0, 200)
  if (!name) return res.status(400).json({ message: 'Give the damaged item a name, e.g. Beef plates.' })
  if (!Number.isFinite(quantity) || quantity <= 0) return res.status(400).json({ message: 'Enter the quantity that was damaged.' })
  // The stock link can be re-picked by id (or dropped with null); omitted
  // means the record keeps its current link.
  let stockItem = null
  let value = 0
  const wantsStock = req.body.stockItemId !== undefined
  if (wantsStock) {
    if (idIsValid(req.body.stockItemId)) {
      stockItem = await StockItem.findOne({ _id: req.body.stockItemId, hotelId: scope })
      if (!stockItem) return res.status(404).json({ message: 'The chosen stock item could not be found.' })
      value = Math.round((stockItem.price || 0) * quantity * 100) / 100
    } else {
      stockItem = null
      value = Math.round((Number(req.body.value) || 0) * 100) / 100
      if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ message: 'Enter the money value of what was damaged.' })
    }
  } else if (damage.stockItemId && idIsValid(damage.stockItemId)) {
    stockItem = await StockItem.findOne({ _id: damage.stockItemId, hotelId: scope })
    value = stockItem ? Math.round((stockItem.price || 0) * quantity * 100) / 100 : damage.value
    if (!stockItem) {
      stockItem = null
      value = Math.round((Number(req.body.value) || 0) || damage.value) || damage.value
    }
  } else {
    value = req.body.value === undefined ? damage.value : Math.round((Number(req.body.value) || 0) * 100) / 100
    if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ message: 'Enter the money value of what was damaged.' })
  }
  const same = damage.name === name && damage.quantity === quantity && damage.note === note
    && value === damage.value && String(damage.stockItemId || '') === String(stockItem ? stockItem._id : '')
  if (same) return res.status(400).json({ message: 'Nothing changed — update the record before saving.' })
  damage.edits = [...(damage.edits || []), {
    name: damage.name,
    quantity: damage.quantity,
    value: damage.value,
    stockItemId: damage.stockItemId || null,
    note: damage.note || '',
    editedBy: req.user._id,
    editedByName: req.user.name,
    editedAt: new Date(),
  }].slice(-20)
  damage.name = name
  damage.quantity = Math.round(quantity * 100) / 100
  damage.value = value
  damage.stockItemId = stockItem ? stockItem._id : null
  damage.note = note
  await damage.save()
  // Stock follows the corrected record: restore what the earlier record
  // drew down, then deduct the new quantity (subject to availability).
  const oldStockId = (damage.edits[damage.edits.length - 1].stockItemId || null) && String(damage.edits[damage.edits.length - 1].stockItemId)
  const newStockId = stockItem ? String(stockItem._id) : null
  const adjusted = new Set()
  if (oldStockId) {
    const oldQty = damage.edits[damage.edits.length - 1].quantity
    if (oldQty > 0) {
      await StockItem.updateOne({ _id: oldStockId, hotelId: scope }, { $inc: { plates: oldQty, totalUsed: -oldQty } }).catch(() => {})
      adjusted.add(oldStockId)
    }
  }
  if (newStockId && quantity > 0) {
    await StockItem.updateOne({ _id: newStockId, hotelId: scope, plates: { $gte: quantity } }, { $inc: { plates: -quantity, totalUsed: quantity } }).catch(() => {})
    adjusted.add(newStockId)
  }
  if (adjusted.size) {
    req.app.get('io').to(`hotel:${scope}`).emit('stock_updated')
    await checkLowStock(req.app.get('io'), scope, [...adjusted])
  }
  broadcastChange(req.app.get('io'), String(scope), 'damages_changed')
  res.json({ damage: { ...damage.toObject(), editedByName: req.user.name } })
}))

// The owner — or staff granted the approval permission — signs a damage off.
// Once approved the damage is locked and can no longer be edited or deleted.
router.post('/damages/:damageId/approve', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (!requireExpenseAccess(req, res)) return
  if (!hasPerm(req.user, 'approve_records')) return res.status(403).json({ message: 'You do not have permission to approve damage records.' })
  if (!idIsValid(req.params.damageId)) return res.status(404).json({ message: 'Damage record not found.' })
  const damage = await DamageRecord.findOneAndUpdate(
    { _id: req.params.damageId, hotelId: hotelScope(req) },
    { $set: { approved: true, approvedBy: req.user._id, approvedAt: new Date() } },
    { new: true },
  )
  if (!damage) return res.status(404).json({ message: 'Damage record not found.' })
  await notifyHotel(req.app.get('io'), String(hotelScope(req)), {
    type: 'damage_approved',
    title: `Damage approved — ${damage.name}`,
    body: `Signed off by ${req.user.name}`,
    refId: damage._id,
  })
  broadcastChange(req.app.get('io'), String(hotelScope(req)), 'damages_changed')
  res.json({ damage: { ...damage.toObject(), approvedByName: req.user.name } })
}))

// Spending totals per section, newest expense included for a quick glance.
router.get('/categories/expenses-summary', authenticate, authorize('OWNER', 'KITCHEN'), cacheHotelResource('expense-summary'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_expenses')) return res.status(403).json({ message: 'The owner has not granted you permission to manage expenses.' })
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  const [totals, latest] = await Promise.all([
    Expense.aggregate([
      { $match: { hotelId: new mongoose.Types.ObjectId(scope) } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Expense.find({ hotelId: scope }).sort({ createdAt: -1 }).limit(50).populate('recordedBy', 'name').select('category amount note createdAt recordedBy').lean(),
  ])
  const totalsByCategory = new Map(totals.map(total => [String(total._id), total]))
  res.json({
    summary: totals.map(total => ({ category: String(total._id), total: total.total, count: total.count })),
    recent: latest.map(expense => ({
      _id: expense._id,
      category: String(expense.category),
      categoryName: expense.categoryName,
      amount: expense.amount,
      note: expense.note,
      recordedBy: expense.recordedBy?.name || '',
      createdAt: expense.createdAt,
    })),
  })
}))

router.get('/categories/:id/expenses', authenticate, authorize('OWNER', 'KITCHEN'), cacheHotelResource('category-expenses', req => req.params.id), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_expenses')) return res.status(403).json({ message: 'The owner has not granted you permission to manage expenses.' })
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Category not found.' })
  const scope = hotelScope(req)
  const category = await MenuCategory.findOne({ _id: req.params.id, hotelId: scope })
  if (!category) return res.status(404).json({ message: 'Category not found.' })
  const [expenses, totals] = await Promise.all([
    Expense.find({ hotelId: scope, category: category._id }).sort({ createdAt: -1 }).limit(100).populate('recordedBy', 'name').lean(),
    Expense.aggregate([
      { $match: { hotelId: new mongoose.Types.ObjectId(scope), category: new mongoose.Types.ObjectId(category._id) } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ])
  res.json({
    category: { _id: category._id, name: category.name, foodType: category.foodType || '' },
    total: totals[0]?.total || 0,
    count: totals[0]?.count || 0,
    expenses: expenses.map(expense => ({
      _id: expense._id,
      amount: expense.amount,
      note: expense.note,
      recordedBy: expense.recordedBy?.name || '',
      createdAt: expense.createdAt,
    })),
  })
}))

router.post('/categories/:id/expenses', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_expenses')) return res.status(403).json({ message: 'The owner has not granted you permission to manage expenses.' })
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Category not found.' })
  const amount = Number(req.body.amount)
  const note = String(req.body.note || '').trim().slice(0, 200)
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Enter an expense amount greater than zero.' })
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  const category = await MenuCategory.findOne({ _id: req.params.id, hotelId: scope })
  if (!category) return res.status(404).json({ message: 'Category not found.' })
  const expense = await Expense.create({
    hotelId: scope,
    category: category._id,
    categoryName: category.name,
    amount: Math.round(amount * 100) / 100,
    note,
    recordedBy: req.user._id,
  })
  res.status(201).json({ expense: { ...expense.toObject(), recordedBy: req.user.name } })
}))

router.delete('/categories/:id/expenses/:expenseId', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_expenses')) return res.status(403).json({ message: 'The owner has not granted you permission to manage expenses.' })
  if (!idIsValid(req.params.id) || !idIsValid(req.params.expenseId)) return res.status(404).json({ message: 'Expense not found.' })
  const expense = await Expense.findOneAndDelete({ _id: req.params.expenseId, hotelId: hotelScope(req), category: req.params.id })
  if (!expense) return res.status(404).json({ message: 'Expense not found.' })
  res.status(204).end()
}))

// Manually recorded sales, e.g. walk-in cash sales or items sold outside
// the app. A sale can hold several items recorded in one go, with an optional
// customer name and contact. Amount is the total money the sale brought in.
// Every sale is scoped to one hotel and carries a receipt-style ID (e.g.
// SAL-000042); a stable fallback is derived from the record itself for sales
// that predate receipt numbers so an ID is always available.
const displaySaleId = sale => formatSaleId(sale.saleNumber) || `SAL-${String(sale._id).slice(-6).toUpperCase()}`

// The line items of a sale. Multi-item sales store them in `items`; sales
// recorded before multi-item support (and legacy single-item API calls) only
// have the top-level name/quantity/unit, presented as a single line.
const saleItems = sale => (Array.isArray(sale.items) && sale.items.length
  ? sale.items.map(item => ({ name: item.name, quantity: item.quantity, unit: item.unit || '', amount: item.amount, stockItemId: item.stockItemId || null }))
  : sale.name
    ? [{ name: sale.name, quantity: sale.quantity, unit: sale.unit || '', amount: sale.amount, stockItemId: null }]
    : [])

// Stock images for the line items, so every screen showing the items can
// present the same photo the kitchen put on the stock entry.
const saleItemImages = sales => {
  const ids = [...new Set(sales.flatMap(sale => saleItems(sale).map(item => String(item.stockItemId || '')).filter(Boolean)))]
  if (!ids.length) return {}
  return StockItem.find({ _id: { $in: ids } }).select('imageUrl').lean().then(docs =>
    Object.fromEntries(docs.map(doc => [String(doc._id), doc.imageUrl || ''])))
}

router.get('/sales', authenticate, authorize('OWNER', 'KITCHEN'), cacheHotelResource('sales'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_sales')) return res.status(403).json({ message: 'The owner has not granted you permission to record sales.' })
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const [sales, allTime, todayTotals] = await Promise.all([
    Sale.find({ hotelId: scope }).sort({ createdAt: -1 }).limit(100).populate('recordedBy', 'name').populate('approvedBy', 'name').lean(),
    Sale.aggregate([
      { $match: { hotelId: new mongoose.Types.ObjectId(scope) } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Sale.aggregate([
      { $match: { hotelId: new mongoose.Types.ObjectId(scope), createdAt: { $gte: startOfToday } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ])
  const stockImages = await saleItemImages(sales)
  res.json({
    total: allTime[0]?.total || 0,
    count: allTime[0]?.count || 0,
    todayTotal: todayTotals[0]?.total || 0,
    todayCount: todayTotals[0]?.count || 0,
    sales: sales.map(sale => ({
      _id: sale._id,
      saleId: displaySaleId(sale),
      name: sale.name,
      // Stock item images by id, so image-capable screens can show the same
      // photo the kitchen put on the stock entry.
      stockImages,
      items: saleItems(sale),
      quantity: sale.quantity,
      unit: sale.unit || '',
      amount: sale.amount,
      customerName: sale.customerName || '',
      customerContact: sale.customerContact || '',
      note: sale.note,
      recordedBy: sale.recordedBy?.name || '',
      createdAt: sale.createdAt,
      approved: sale.approved,
      approvedAt: sale.approvedAt,
      approvedByName: sale.approvedBy?.name || '',
      // Change trail for the owner: what the sale looked like before each
      // edit, newest last.
      edits: (sale.edits || []).map(edit => ({
        name: edit.name,
        items: (edit.items || []).map(item => ({ name: item.name, quantity: item.quantity, unit: item.unit || '', amount: item.amount })),
        amount: edit.amount,
        customerName: edit.customerName || '',
        note: edit.note || '',
        editedByName: edit.editedByName || '',
        editedAt: edit.editedAt,
      })),
    })),
  })
}))

router.post('/sales', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_sales')) return res.status(403).json({ message: 'The owner has not granted you permission to record sales.' })
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  // A sale can record several items at once. The older single-item fields
  // (name/quantity/unit/amount) still work and are treated as one item.
  const rawItems = Array.isArray(req.body.items) && req.body.items.length
    ? req.body.items
    : [{ name: req.body.name, quantity: req.body.quantity, unit: req.body.unit, amount: req.body.amount }]
  if (rawItems.length > 50) return res.status(400).json({ message: 'A sale can hold at most 50 items.' })
  const items = []
  for (const [index, raw] of rawItems.entries()) {
    const name = String(raw?.name || '').trim().slice(0, 60)
    const quantity = raw?.quantity === undefined || raw?.quantity === '' ? 1 : Number(raw.quantity)
    const amount = Number(raw?.amount)
    if (!name) return res.status(400).json({ message: `Give item ${index + 1} a name, e.g. Beef plates.` })
    if (!Number.isFinite(quantity) || quantity < 0) return res.status(400).json({ message: `Item ${index + 1}: enter a quantity of zero or more.` })
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: `Item ${index + 1}: enter an amount greater than zero.` })
    items.push({
      name,
      quantity: Math.round(quantity * 100) / 100,
      unit: String(raw?.unit || '').trim().toLowerCase().slice(0, 20),
      amount: Math.round(amount * 100) / 100,
      // Lines picked from the stock search carry the stock they draw down.
      stockItemId: idIsValid(raw?.stockItemId) ? raw.stockItemId : null,
    })
  }
  // The sale's total is the sum of its items, computed here so a tampered
  // client can never record a total that disagrees with the lines.
  const total = Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100
  const customerName = String(req.body.customerName || '').trim().slice(0, 80)
  const customerContact = String(req.body.customerContact || '').trim().slice(0, 60)
  // A record made by someone allowed to approve is trusted straight away;
  // everyone else's waits for the owner's (or an approver's) sign-off.
  const autoApproved = hasPerm(req.user, 'approve_records')
  // Receipt numbers are sequential per hotel: take the highest used number
  // and add one. If two staff record at the same instant the unique index
  // rejects the loser, and it retries with a freshly read number.
  let sale
  for (let attempt = 0; attempt < 5 && !sale; attempt++) {
    const highest = await Sale.findOne({ hotelId: scope }).sort({ saleNumber: -1 }).select('saleNumber')
    try {
      sale = await Sale.create({
        hotelId: scope,
        saleNumber: (highest?.saleNumber || 0) + 1,
        // Short summary for older screens; the full breakdown lives in items.
        name: (items.length > 1 ? `${items[0].name} +${items.length - 1} more` : items[0].name).slice(0, 60),
        items,
        quantity: items.length > 1 ? 1 : items[0].quantity,
        unit: items.length > 1 ? '' : items[0].unit,
        amount: total,
        customerName,
        customerContact,
        note: String(req.body.note || '').trim().slice(0, 200),
        recordedBy: req.user._id,
        approved: autoApproved,
        approvedBy: autoApproved ? req.user._id : null,
        approvedAt: autoApproved ? new Date() : null,
      })
    } catch (error) {
      if (error.code !== 11000) throw error
    }
  }
  if (!sale) return res.status(409).json({ message: 'Could not assign the sale an ID, please try again.' })
  // Best-effort stock deduction: a missing or
  // already-empty stock never blocks a recorded sale, and the $gte guard
  // keeps the count from dipping below zero when records race.
  const stockUsage = new Map()
  for (const item of items) {
    if (!item.stockItemId || !(item.quantity > 0)) continue
    const stockId = String(item.stockItemId)
    stockUsage.set(stockId, (stockUsage.get(stockId) || 0) + item.quantity)
  }
  for (const [stockId, qty] of stockUsage) {
    await StockItem.updateOne(
      { _id: stockId, hotelId: scope, plates: { $gte: qty } },
      { $inc: { plates: -qty, totalUsed: qty } },
    ).catch(() => {})
  }
  await notifyHotel(req.app.get('io'), scope, {
    type: 'new_sale',
    title: `New sale #${displaySaleId(sale)} recorded`,
    body: `${items[0].name} — ${sale.amount} · by ${req.user.name}${sale.approved ? '' : ' · awaiting approval'}`,
    refId: sale._id,
  })
  await checkLowStock(req.app.get('io'), scope, [...stockUsage.keys()])
  broadcastChange(req.app.get('io'), scope, 'sales_changed')
  res.status(201).json({ sale: { ...sale.toObject(), saleId: displaySaleId(sale), items: saleItems(sale), recordedBy: req.user.name } })
}))

router.delete('/sales/:saleId', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_sales')) return res.status(403).json({ message: 'The owner has not granted you permission to record sales.' })
  if (!idIsValid(req.params.saleId)) return res.status(404).json({ message: 'Sale not found.' })
  const sale = await Sale.findOne({ _id: req.params.saleId, hotelId: hotelScope(req) }).select('approved')
  if (!sale) return res.status(404).json({ message: 'Sale not found.' })
  // Approved sales are the books of record — they can no longer be changed.
  if (sale.approved) return res.status(403).json({ message: 'This sale has been approved and can no longer be changed.' })
  await Sale.deleteOne({ _id: sale._id })
  broadcastChange(req.app.get('io'), String(hotelScope(req)), 'sales_changed')
  res.status(204).end()
}))

// A chef can edit their own unapproved sale until it is approved. Every edit
// snapshots the sale as it was BEFORE the change into `edits`, so the owner
// can see "changed from X to this" with who made the change and when.
const saleEditPayload = req => {
  const rawItems = Array.isArray(req.body.items) && req.body.items.length
    ? req.body.items
    : [{ name: req.body.name, quantity: req.body.quantity, unit: req.body.unit, amount: req.body.amount }]
  if (rawItems.length > 50) return { error: 'A sale can hold at most 50 items.' }
  const items = []
  for (const [index, raw] of rawItems.entries()) {
    const name = String(raw?.name || '').trim().slice(0, 60)
    const quantity = raw?.quantity === undefined || raw?.quantity === '' ? 1 : Number(raw.quantity)
    const amount = Number(raw?.amount)
    if (!name) return { error: `Give item ${index + 1} a name, e.g. Beef plates.` }
    if (!Number.isFinite(quantity) || quantity < 0) return { error: `Item ${index + 1}: enter a quantity of zero or more.` }
    if (!Number.isFinite(amount) || amount <= 0) return { error: `Item ${index + 1}: enter an amount greater than zero.` }
    items.push({
      name,
      quantity: Math.round(quantity * 100) / 100,
      unit: String(raw?.unit || '').trim().toLowerCase().slice(0, 20),
      amount: Math.round(amount * 100) / 100,
      stockItemId: idIsValid(raw?.stockItemId) ? raw.stockItemId : null,
    })
  }
  return { items, total: Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100 }
}

router.patch('/sales/:saleId', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_sales')) return res.status(403).json({ message: 'The owner has not granted you permission to record sales.' })
  if (!idIsValid(req.params.saleId)) return res.status(404).json({ message: 'Sale not found.' })
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  const sale = await Sale.findOne({ _id: req.params.saleId, hotelId: scope })
  if (!sale) return res.status(404).json({ message: 'Sale not found.' })
  // Approved sales are the books of record — they can no longer be changed.
  if (sale.approved) return res.status(403).json({ message: 'This sale has been approved and can no longer be changed.' })
  const parsed = saleEditPayload(req)
  if (parsed.error) return res.status(400).json({ message: parsed.error })
  const { items, total } = parsed
  const customerName = String(req.body.customerName || '').trim().slice(0, 80)
  const customerContact = String(req.body.customerContact || '').trim().slice(0, 60)
  const note = String(req.body.note || '').trim().slice(0, 200)
  const sameItems = sale.items?.length === items.length && sale.items.every((item, index) =>
    item.name === items[index].name && item.quantity === items[index].quantity
    && item.unit === items[index].unit && item.amount === items[index].amount)
  const unchanged = sameItems && sale.customerName === customerName && sale.customerContact === customerContact && sale.note === note
  if (unchanged) return res.status(400).json({ message: 'Nothing changed — update the items, customer or note before saving.' })
  // Snapshot the sale as it stands BEFORE applying the edit.
  sale.edits = [...(sale.edits || []), {
    name: sale.name,
    items: saleItems(sale).map(item => ({ name: item.name, quantity: item.quantity, unit: item.unit, amount: item.amount, stockItemId: item.stockItemId })),
    amount: sale.amount,
    customerName: sale.customerName || '',
    note: sale.note || '',
    editedBy: req.user._id,
    editedByName: req.user.name,
    editedAt: new Date(),
  }].slice(-20)
  sale.name = (items.length > 1 ? `${items[0].name} +${items.length - 1} more` : items[0].name).slice(0, 60)
  sale.items = items
  sale.quantity = items.length > 1 ? 1 : items[0].quantity
  sale.unit = items.length > 1 ? '' : items[0].unit
  sale.amount = total
  sale.customerName = customerName
  sale.customerContact = customerContact
  sale.note = note
  await sale.save()
  // Stock follows the corrected quantities: restore what the previous lines
  // drew down, then deduct the new ones. Best-effort, same as when recording.
  const stockDelta = new Map()
  for (const item of sale.edits[sale.edits.length - 1].items || []) {
    const stockId = item.stockItemId && idIsValid(item.stockItemId) ? String(item.stockItemId) : null
    if (stockId && item.quantity > 0) stockDelta.set(stockId, (stockDelta.get(stockId) || 0) + item.quantity)
  }
  for (const item of items) {
    if (item.stockItemId && item.quantity > 0) stockDelta.set(String(item.stockItemId), (stockDelta.get(String(item.stockItemId)) || 0) - item.quantity)
  }
  for (const [stockId, delta] of stockDelta) {
    if (delta > 0) {
      await StockItem.updateOne({ _id: stockId, hotelId: scope }, { $inc: { plates: delta } }).catch(() => {})
    } else if (delta < 0) {
      await StockItem.updateOne({ _id: stockId, hotelId: scope, plates: { $gte: -delta } }, { $inc: { plates: delta } }).catch(() => {})
    }
  }
  if (stockDelta.size) req.app.get('io').to(`hotel:${hotelScope(req)}`).emit('stock_updated')
  res.json({ sale: { ...sale.toObject(), saleId: displaySaleId(sale), items: saleItems(sale), recordedBy: req.user.name } })
}))

// The owner — or staff granted the approval permission — signs a sale off.
// Once approved the sale is locked and can no longer be deleted.
router.post('/sales/:saleId/approve', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (!hasPerm(req.user, 'approve_records')) return res.status(403).json({ message: 'You do not have permission to approve sales.' })
  if (!idIsValid(req.params.saleId)) return res.status(404).json({ message: 'Sale not found.' })
  const sale = await Sale.findOneAndUpdate(
    { _id: req.params.saleId, hotelId: hotelScope(req) },
    { $set: { approved: true, approvedBy: req.user._id, approvedAt: new Date() } },
    { new: true },
  )
  if (!sale) return res.status(404).json({ message: 'Sale not found.' })
  await notifyHotel(req.app.get('io'), String(hotelScope(req)), {
    type: 'sale_approved',
    title: `Sale #${displaySaleId(sale)} approved`,
    body: `Signed off by ${req.user.name}`,
    refId: sale._id,
  })
  broadcastChange(req.app.get('io'), String(hotelScope(req)), 'sales_changed')
  res.json({ sale: { ...sale.toObject(), saleId: displaySaleId(sale), items: saleItems(sale), approvedByName: req.user.name } })
}))

router.get('/staff', authenticate, authorize('OWNER'), cacheHotelResource('staff'), asyncRoute(async (req, res) => {
  const users = await User.find({ hotelId: req.user.hotelId._id, role: 'KITCHEN' }).sort({ createdAt: -1 }).select('+passwordVault').lean()
  res.json({
    users: users.map(user => ({ ...staffUser(user), hasViewablePassword: Boolean(user.passwordVault) })),
    passwordViewable: vaultEnabled(),
  })
}))

// Reveal the stored password of one of the owner's own chef accounts.
// Owners are scoped to KITCHEN accounts in their own hotel only — they can
// never view another owner's or the developer's password. The plaintext is
// decrypted server-side only for authenticated owners and never included in
// any list or login response.
router.get('/staff/:id/password', authenticate, authorize('OWNER'), sensitiveLimiter, asyncRoute(async (req, res) => {
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Chef account not found.' })
  const user = await User.findOne({ _id: req.params.id, hotelId: req.user.hotelId._id, role: 'KITCHEN' }).select('+passwordVault')
  if (!user) return res.status(404).json({ message: 'Chef account not found.' })
  const password = revealPassword(user)
  if (password === null) {
    return res.status(404).json({ message: 'No viewable password is stored for this account yet. Reset the password once — after that you can view the current password anytime.' })
  }
  res.json({ password })
}))

router.post('/staff', authenticate, authorize('OWNER'), asyncRoute(async (req, res) => {
  const { name, email, password } = req.body
  const permissions = req.body.permissions === undefined ? ALL_PERMISSIONS : req.body.permissions
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!String(name || '').trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
      !isStrongPassword(password)) {
    return res.status(400).json({ message: 'Provide a name, valid email, and a password of at least 6 characters with letters and numbers.' })
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
  res.status(204).end()
}))

router.get('/analytics/daily', authenticate, authorize('OWNER'), cacheHotelResource('report', req => `${req.query.from || ''}:${req.query.to || ''}:${req.user.role}`), asyncRoute(async (req, res) => report(req, res)))
router.get('/analytics/reports', authenticate, authorize('OWNER', 'KITCHEN'), cacheHotelResource('report', req => `${req.query.from || ''}:${req.query.to || ''}:${req.user.role}`), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !['view_sales', 'manage_sales', 'manage_expenses'].some(permission => hasPerm(req.user, permission))) {
    return res.status(403).json({ message: 'The owner has not granted you access to sales or expense records.' })
  }
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
  const canViewSales = req.user.role !== 'KITCHEN' || hasPerm(req.user, 'view_sales') || hasPerm(req.user, 'manage_sales')
  const canViewExpenses = req.user.role !== 'KITCHEN' || hasPerm(req.user, 'manage_expenses')
  const filter = { createdAt: { $gte: from, $lte: to } }
  if (scope) filter.hotelId = scope
  const match = scope ? { ...filter, hotelId: new mongoose.Types.ObjectId(scope) } : { ...filter, hotelId: { $exists: true } }
  const [sales, expenses, damages, salesTotals, expenseTotals, salesSeries, expenseSeries] = await Promise.all([
    canViewSales ? Sale.find(filter).sort({ createdAt: -1 }).limit(1000).lean() : Promise.resolve([]),
    canViewExpenses ? HotelExpense.find(filter).sort({ createdAt: -1 }).limit(1000).lean() : Promise.resolve([]),
    canViewExpenses ? DamageRecord.find(filter).sort({ createdAt: -1 }).limit(1000).lean() : Promise.resolve([]),
    canViewSales ? Sale.aggregate([
      { $match: match },
      { $group: { _id: null, totalSalesCount: { $sum: 1 }, totalRevenue: { $sum: '$amount' } } },
    ]) : Promise.resolve([]),
    canViewExpenses ? HotelExpense.aggregate([
      { $match: match },
      { $group: { _id: null, totalExpensesCount: { $sum: 1 }, totalExpenses: { $sum: '$amount' } } },
    ]) : Promise.resolve([]),
    canViewSales ? Sale.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Africa/Kampala' } }, revenue: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]) : Promise.resolve([]),
    canViewExpenses ? HotelExpense.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Africa/Kampala' } }, expenses: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]) : Promise.resolve([]),
  ])
  const dailyTotals = new Map()
  for (const day of salesSeries) dailyTotals.set(day._id, { date: day._id, revenue: day.revenue, expenses: 0 })
  for (const day of expenseSeries) {
    const current = dailyTotals.get(day._id) || { date: day._id, revenue: 0, expenses: 0 }
    current.expenses = day.expenses
    dailyTotals.set(day._id, current)
  }
  const series = [...dailyTotals.values()].sort((a, b) => a.date.localeCompare(b.date)).map(day => ({
    ...day,
    balance: day.revenue - day.expenses,
  }))
  const totalRevenue = salesTotals[0]?.totalRevenue || 0
  const totalExpenses = expenseTotals[0]?.totalExpenses || 0
  // Stock images by id, so every screen showing the sale lines can show
  // the same photo the kitchen put on the stock entry.
  const stockImages = await saleItemImages(sales)
  const saleRecords = sales.map(sale => ({
    ...sale,
    saleId: displaySaleId(sale),
    stockImages,
  }))
  // Damages refer to stock items; photos are fetched in one query so each
  // record can show the item's face.
  const damageStockIds = [...new Set((damages || []).map(damage => String(damage.stockItemId || '')).filter(id => idIsValid(id)))]
  const damageStockImages = damageStockIds.length
    ? Object.fromEntries(await StockItem.find({ _id: { $in: damageStockIds } }).select('imageUrl').then(docs =>
      docs.map(doc => [String(doc._id), doc.imageUrl || ''])))
    : {}
  // Damages are a loss, priced from the stock's unit value at record time.
  const totalDamages = (damages || []).reduce((sum, damage) => sum + (damage.value || 0), 0)
  res.json({
    from: from.toISOString(),
    to: to.toISOString(),
    totalSalesCount: salesTotals[0]?.totalSalesCount || 0,
    totalRevenue,
    totalExpensesCount: expenseTotals[0]?.totalExpensesCount || 0,
    totalExpenses,
    totalDamages,
    damages: (damages || []).map(damage => ({
      _id: damage._id,
      name: damage.name,
      quantity: damage.quantity,
      unit: damage.unit || '',
      value: damage.value,
      note: damage.note || '',
      createdAt: damage.createdAt,
      // The stock item's photo when the damage drew from tracked stock.
      imageUrl: damageStockImages[String(damage.stockItemId || '')] || '',
    })),
    netBalance: canViewSales && canViewExpenses ? totalRevenue - totalExpenses : null,
    netBalanceAfterDamages: canViewSales && canViewExpenses ? totalRevenue - totalExpenses - totalDamages : null,
    canViewSales,
    canViewExpenses,
    series,
    sales: saleRecords,
    expenses,
  })
}

export default router

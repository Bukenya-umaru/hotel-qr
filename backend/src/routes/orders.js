import express from 'express'
import mongoose from 'mongoose'
import { authenticate, authorize, hotelScope } from '../middleware/auth.js'
import { Hotel } from '../models/Hotel.js'
import { DiningTable } from '../models/DiningTable.js'
import { MenuItem } from '../models/MenuItem.js'
import { Order } from '../models/Order.js'
import { StockItem } from '../models/StockItem.js'
import { asyncRoute, guestOrder, idIsValid, safeNumber } from '../utils/http.js'

const router = express.Router()

router.post('/', asyncRoute(async (req, res) => {
  const slug = String(req.body.hotel || '').trim().toLowerCase()
  const tableNumber = String(req.body.tableNumber || '').trim()
  const guestCount = Number(req.body.guestCount)
  const visitId = String(req.body.visitId || '').trim()
  const items = req.body.items
  const notes = String(req.body.notes || '').trim()
  const customerName = String(req.body.customerName || '').trim().slice(0, 80)
  if (!slug || !tableNumber || tableNumber.length > 32) return res.status(400).json({ message: 'Select a valid table.' })
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 100 ||
      !/^[a-z\d-]{16,80}$/i.test(visitId)) {
    return res.status(400).json({ message: 'Provide a valid party size and table visit.' })
  }
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) return res.status(400).json({ message: 'Add between 1 and 50 items to your order.' })
  if (notes.length > 500) return res.status(400).json({ message: 'Order notes must be 500 characters or fewer.' })
  const hotel = await Hotel.findOne({ slug, isActive: true }).select('_id')
  if (!hotel) return res.status(404).json({ message: 'This business could not be found.' })
  const diningTable = await DiningTable.findOne({ hotelId: hotel._id, tableNumber, isActive: true })
  if (!diningTable) return res.status(404).json({ message: 'This table is not available. Please choose another table.' })
  const quantities = new Map()
  for (const item of items) {
    if (!mongoose.isValidObjectId(item.menuItem) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 50) {
      return res.status(400).json({ message: 'One or more order items are invalid.' })
    }
    const id = item.menuItem.toString()
    quantities.set(id, (quantities.get(id) || 0) + item.quantity)
    if (quantities.get(id) > 50) return res.status(400).json({ message: 'An item quantity cannot exceed 50.' })
  }
  const menuItems = await MenuItem.find({
    _id: { $in: [...quantities.keys()] },
    hotelId: hotel._id,
    isAvailable: true,
  }).select('+costPrice')
  if (menuItems.length !== quantities.size) {
    return res.status(409).json({ message: 'A selected item is no longer available. Please refresh the menu.' })
  }
  let table = diningTable
  const existingReservation = table.reservations.find(reservation => reservation.visitId === visitId)
  if (existingReservation && existingReservation.guestCount !== guestCount) {
    return res.status(409).json({ message: 'This table visit already has a different party size. Ask the chef to clear the table before changing seats.' })
  }
  let reservedSeats = false
  if (!existingReservation) {
    table = await DiningTable.findOneAndUpdate({
      _id: diningTable._id,
      isActive: true,
      'reservations.visitId': { $ne: visitId },
      $expr: { $lte: [{ $add: ['$occupiedSeats', guestCount] }, '$capacity'] },
    }, {
      $inc: { occupiedSeats: guestCount },
      $push: { reservations: { visitId, guestCount } },
    }, { new: true })
    if (table) {
      reservedSeats = true
    } else {
      table = await DiningTable.findById(diningTable._id)
      const concurrentReservation = table?.reservations.find(reservation => reservation.visitId === visitId)
      if (concurrentReservation?.guestCount !== guestCount) {
        return res.status(409).json({ message: concurrentReservation
          ? 'This table visit already has a different party size.'
          : 'This table does not have enough available seats. Please choose another table.' })
      }
    }
  }
  const lines = menuItems.map(item => ({
    menuItem: item._id,
    name: item.name,
    price: item.price,
    costPrice: item.costPrice,
    quantity: quantities.get(item._id.toString()),
  }))
  // Dishes linked to a stock deduct their plates as soon as the order is
  // placed. Best-effort: a missing or already-empty stock never blocks a
  // customer order; the count simply cannot go below zero.
  const stockUsage = new Map()
  for (const item of menuItems) {
    if (!item.stockItemId) continue
    const stockId = item.stockItemId.toString()
    stockUsage.set(stockId, (stockUsage.get(stockId) || 0) + quantities.get(item._id.toString()))
  }
  const totalAmount = safeNumber(lines.reduce((sum, item) => sum + item.price * item.quantity, 0))
  const totalCost = safeNumber(lines.reduce((sum, item) => sum + item.costPrice * item.quantity, 0))
  let order
  try {
    order = await Order.create({
      hotelId: hotel._id,
      tableNumber,
      guestCount,
      customerName,
      items: lines,
      totalAmount,
      totalCost,
      totalProfit: safeNumber(totalAmount - totalCost),
      notes,
    })
  } catch (error) {
    if (reservedSeats) {
      await DiningTable.updateOne(
        { _id: table._id, 'reservations.visitId': visitId },
        { $inc: { occupiedSeats: -guestCount }, $pull: { reservations: { visitId } } },
      )
    }
    throw error
  }
  const io = req.app.get('io')
  for (const [stockId, plates] of stockUsage) {
    // $gte guard keeps the count from ever dipping below zero when two
    // orders race; the shorter order still goes through unblocked.
    await StockItem.updateOne(
      { _id: stockId, hotelId: hotel._id, plates: { $gte: plates } },
      { $inc: { plates: -plates, totalUsed: plates } },
    ).catch(() => {})
  }
  io.to(`hotel:${hotel._id}`).emit('new_order', order)
  if (stockUsage.size) io.to(`hotel:${hotel._id}`).emit('stock_updated')
  io.to(`order:${order._id}`).emit('order_status', guestOrder(order))
  io.to(`menu:${hotel._id}`).emit('tables_updated')
  res.status(201).json({
    order: guestOrder(order),
    table: {
      tableNumber: table.tableNumber,
      capacity: table.capacity,
      occupiedSeats: table.occupiedSeats,
    },
  })
}))

router.get('/:id/status', asyncRoute(async (req, res) => {
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Order not found.' })
  const order = await Order.findById(req.params.id)
  if (!order) return res.status(404).json({ message: 'Order not found.' })
  res.json({ order: guestOrder(order) })
}))

router.get('/active', authenticate, authorize('KITCHEN', 'OWNER'), asyncRoute(async (req, res) => {
  const orders = await Order.find({ hotelId: hotelScope(req), status: { $in: ['Pending', 'Preparing', 'Ready'] } })
    .sort({ createdAt: -1 }).limit(200)
  res.json({ orders })
}))

router.patch('/:id/status', authenticate, authorize('KITCHEN', 'OWNER'), asyncRoute(async (req, res) => {
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Order not found.' })
  const order = await Order.findOne({ _id: req.params.id, hotelId: hotelScope(req) })
  if (!order) return res.status(404).json({ message: 'Order not found.' })
  const transitions = { Pending: ['Preparing', 'Cancelled'], Preparing: ['Ready', 'Cancelled'], Ready: ['Served', 'Cancelled'] }
  if (!transitions[order.status]?.includes(req.body.status) ||
      (req.body.status === 'Cancelled' && req.user.role !== 'OWNER')) {
    return res.status(400).json({ message: 'This order status transition is not allowed.' })
  }
  order.status = req.body.status
  await order.save()
  const io = req.app.get('io')
  io.to(`order:${order._id}`).emit('order_status', guestOrder(order))
  io.to(`hotel:${order.hotelId}`).emit('order_updated', order)
  res.json({ order })
}))

export default router

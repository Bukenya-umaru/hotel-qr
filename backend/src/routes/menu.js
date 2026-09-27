import express from 'express'
import { DiningTable } from '../models/DiningTable.js'
import { Hotel } from '../models/Hotel.js'
import { MenuItem } from '../models/MenuItem.js'
import { asyncRoute, safeMenuItem } from '../utils/http.js'

const router = express.Router()

router.get('/', asyncRoute(async (req, res) => {
  const slug = String(req.query.hotel || '').trim().toLowerCase()
  let hotel
  if (slug) {
    hotel = await Hotel.findOne({ slug, isActive: true }).select('name slug currency')
  } else {
    hotel = await Hotel.findOne({ isActive: true }).sort({ createdAt: 1 }).select('name slug currency')
  }
  if (!hotel) return res.status(404).json({ message: 'The business is not available yet.' })
  const [items, tables] = await Promise.all([
    MenuItem.find({ hotelId: hotel._id, isAvailable: true }).sort({ category: 1, name: 1 }),
    DiningTable.find({ hotelId: hotel._id, isActive: true }).sort({ tableNumber: 1 })
      .select('tableNumber capacity occupiedSeats'),
  ])
  res.json({
    hotel,
    items: items.map(safeMenuItem),
    tables: tables.map(table => ({
      _id: table._id,
      tableNumber: table.tableNumber,
      capacity: table.capacity,
      occupiedSeats: table.occupiedSeats,
      availableSeats: Math.max(0, table.capacity - table.occupiedSeats),
    })),
  })
}))

export default router

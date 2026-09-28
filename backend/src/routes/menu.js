import express from 'express'
import { DiningTable } from '../models/DiningTable.js'
import { Hotel } from '../models/Hotel.js'
import { MenuCategory } from '../models/MenuCategory.js'
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
  const [items, tables, categories] = await Promise.all([
    MenuItem.find({ hotelId: hotel._id, isAvailable: true }).sort({ category: 1, name: 1 }),
    DiningTable.find({ hotelId: hotel._id, isActive: true }).sort({ tableNumber: 1 })
      .select('tableNumber capacity occupiedSeats'),
    MenuCategory.find({ hotelId: hotel._id }).sort({ name: 1 }).select('name'),
  ])
  // Customers must see every category the kitchen created, even ones without any
  // menu items yet. Categories that exist only on items (legacy data) are merged
  // in so nothing disappears from the customer view.
  const seen = new Set(categories.map(category => category.name.toLowerCase()))
  const legacyNames = [...new Set(items.map(item => item.category))]
    .filter(name => { const key = name.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true })
  const categoryNames = [...categories.map(category => category.name), ...legacyNames]
    .sort((left, right) => left.localeCompare(right))
  res.json({
    hotel,
    items: items.map(safeMenuItem),
    categories: categoryNames,
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

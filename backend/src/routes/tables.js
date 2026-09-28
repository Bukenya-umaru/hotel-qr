import express from 'express'
import mongoose from 'mongoose'
import { authenticate, authorize, hotelScope } from '../middleware/auth.js'
import { Hotel } from '../models/Hotel.js'
import { DiningTable } from '../models/DiningTable.js'
import { asyncRoute, idIsValid } from '../utils/http.js'

const router = express.Router()

// Capabilities granted by the owner; a chef with no stored permissions
// keeps full access (legacy accounts).
const hasPerm = (user, key) => user.role !== 'KITCHEN' || !user.permissions || user.permissions.includes(key)

const publicTable = table => ({
  _id: table._id,
  tableNumber: table.tableNumber,
  capacity: table.capacity,
  occupiedSeats: table.occupiedSeats,
  availableSeats: Math.max(0, table.capacity - table.occupiedSeats),
})

const announce = (io, hotelId) => {
  io.to(`menu:${hotelId}`).emit('tables_updated')
  io.to(`hotel:${hotelId}`).emit('tables_updated')
}

const findHotel = async slug => Hotel.findOne({ slug, isActive: true }).select('_id')

const parseVisit = req => {
  const slug = String(req.body.hotel || '').trim().toLowerCase()
  const tableNumber = String(req.body.tableNumber || '').trim()
  const visitId = String(req.body.visitId || '').trim()
  if (!slug || !tableNumber || tableNumber.length > 32) return null
  if (!/^[a-z\d-]{16,80}$/i.test(visitId)) return null
  return { slug, tableNumber, visitId }
}

// ---------------------------------------------------------------------------
// Public guest endpoints — no login required
// ---------------------------------------------------------------------------

// A guest checks in here the moment they pick a table, so the chef can see
// the party on that table before any food is ordered.
router.post('/check-in', asyncRoute(async (req, res) => {
  const visit = parseVisit(req)
  const guestCount = Number(req.body.guestCount)
  if (!visit) return res.status(400).json({ message: 'Select a valid table.' })
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 100) {
    return res.status(400).json({ message: 'Provide a valid party size.' })
  }
  const hotel = await findHotel(visit.slug)
  if (!hotel) return res.status(404).json({ message: 'This business could not be found.' })
  const table = await DiningTable.findOne({ hotelId: hotel._id, tableNumber: visit.tableNumber, isActive: true })
  if (!table) return res.status(404).json({ message: 'This table is not available. Please choose another table.' })

  const existing = table.reservations.find(reservation => reservation.visitId === visit.visitId)
  if (existing) {
    if (existing.guestCount !== guestCount) {
      return res.status(409).json({ message: 'This table visit already has a different party size. Release your seats first before changing them.' })
    }
    return res.json({ table: publicTable(table), reservation: { guestCount: existing.guestCount } })
  }
  const updated = await DiningTable.findOneAndUpdate({
    _id: table._id,
    isActive: true,
    'reservations.visitId': { $ne: visit.visitId },
    $expr: { $lte: [{ $add: ['$occupiedSeats', guestCount] }, '$capacity'] },
  }, {
    $inc: { occupiedSeats: guestCount },
    $push: { reservations: { visitId: visit.visitId, guestCount, source: 'GUEST' } },
  }, { new: true })
  if (!updated) return res.status(409).json({ message: 'This table does not have enough free seats. Please choose another table.' })
  announce(req.app.get('io'), hotel._id)
  res.status(201).json({ table: publicTable(updated), reservation: { guestCount } })
}))

// Guest changes their party size while seated (checked in, not yet ordered).
router.patch('/check-in', asyncRoute(async (req, res) => {
  const visit = parseVisit(req)
  const guestCount = Number(req.body.guestCount)
  if (!visit) return res.status(400).json({ message: 'Select a valid table.' })
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 100) {
    return res.status(400).json({ message: 'Provide a valid party size.' })
  }
  const hotel = await findHotel(visit.slug)
  if (!hotel) return res.status(404).json({ message: 'This business could not be found.' })
  const table = await DiningTable.findOne({ hotelId: hotel._id, tableNumber: visit.tableNumber, isActive: true })
  if (!table) return res.status(404).json({ message: 'This table is not available. Please choose another table.' })
  const existing = table.reservations.find(reservation => reservation.visitId === visit.visitId)
  if (!existing) return res.status(404).json({ message: 'No check-in found for this table visit. Check in first.' })
  if (existing.source === 'CHEF') {
    return res.status(409).json({ message: 'The chef seated this party. Ask the chef to change the number of people.' })
  }
  const delta = guestCount - existing.guestCount
  let updated = table
  if (delta !== 0) {
    updated = await DiningTable.findOneAndUpdate({
      _id: table._id,
      'reservations.visitId': visit.visitId,
      $expr: delta > 0
        ? { $lte: [{ $add: ['$occupiedSeats', delta] }, '$capacity'] }
        : { $gte: [{ $add: ['$occupiedSeats', delta] }, 0] },
    }, {
      $inc: { occupiedSeats: delta },
      $set: { 'reservations.$[entry].guestCount': guestCount },
    }, {
      new: true,
      arrayFilters: [{ 'entry.visitId': visit.visitId }],
    })
    if (!updated) return res.status(409).json({ message: delta > 0
      ? 'This table does not have enough free seats for the larger group.'
      : 'Unable to release the seats for this visit.' })
  }
  announce(req.app.get('io'), hotel._id)
  res.json({ table: publicTable(updated), reservation: { guestCount } })
}))

// Guest leaves: releases their seats so new customers can take the table.
router.delete('/check-in', asyncRoute(async (req, res) => {
  const visit = parseVisit(req)
  if (!visit) return res.status(400).json({ message: 'Select a valid table.' })
  const hotel = await findHotel(visit.slug)
  if (!hotel) return res.status(404).json({ message: 'This business could not be found.' })
  const table = await DiningTable.findOne({
    hotelId: hotel._id,
    tableNumber: visit.tableNumber,
    'reservations.visitId': visit.visitId,
  })
  if (!table) return res.status(404).json({ message: 'No check-in found for this table visit.' })
  const reservation = table.reservations.find(entry => entry.visitId === visit.visitId)
  if (reservation.source === 'CHEF' && req.body.force !== true) {
    return res.status(409).json({ message: 'The chef seated this party. Only the chef can release these seats.' })
  }
  const updated = await DiningTable.findOneAndUpdate(
    { _id: table._id, 'reservations.visitId': visit.visitId },
    { $inc: { occupiedSeats: -reservation.guestCount }, $pull: { reservations: { visitId: visit.visitId } } },
    { new: true },
  )
  announce(req.app.get('io'), hotel._id)
  res.json({ table: publicTable(updated) })
}))

// ---------------------------------------------------------------------------
// Chef endpoints — OWNER / KITCHEN, scoped to their business
// ---------------------------------------------------------------------------

// The chef seats walk-in customers at a table.
router.post('/:id/seat', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_tables')) return res.status(403).json({ message: 'You do not have permission to manage tables.' })
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Table not found.' })
  const guestCount = Number(req.body.guestCount)
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 100) {
    return res.status(400).json({ message: 'Provide the number of people to seat, from 1 to 100.' })
  }
  const updated = await DiningTable.findOneAndUpdate({
    _id: req.params.id,
    hotelId: hotelScope(req),
    isActive: true,
    $expr: { $lte: [{ $add: ['$occupiedSeats', guestCount] }, '$capacity'] },
  }, {
    $inc: { occupiedSeats: guestCount },
    $push: { reservations: { visitId: `chef-${new mongoose.Types.ObjectId()}`, guestCount, source: 'CHEF' } },
  }, { new: true })
  if (!updated) return res.status(409).json({ message: 'This table does not have enough free seats for that party.' })
  announce(req.app.get('io'), updated.hotelId)
  res.status(201).json({ table: updated })
}))

// One party finished eating: the chef sets those chairs back to zero people.
router.patch('/:id/parties/:visitId/release', authenticate, authorize('OWNER', 'KITCHEN'), asyncRoute(async (req, res) => {
  if (req.user.role === 'KITCHEN' && !hasPerm(req.user, 'manage_tables')) return res.status(403).json({ message: 'You do not have permission to manage tables.' })
  if (!idIsValid(req.params.id) || !/^[a-z\d-]{1,90}$/i.test(req.params.visitId)) {
    return res.status(404).json({ message: 'Table party not found.' })
  }
  const table = await DiningTable.findOne({ _id: req.params.id, hotelId: hotelScope(req), 'reservations.visitId': req.params.visitId })
  if (!table) return res.status(404).json({ message: 'Table party not found.' })
  const reservation = table.reservations.find(entry => entry.visitId === req.params.visitId)
  const updated = await DiningTable.findOneAndUpdate(
    { _id: table._id, 'reservations.visitId': req.params.visitId },
    { $inc: { occupiedSeats: -reservation.guestCount }, $pull: { reservations: { visitId: req.params.visitId } } },
    { new: true },
  )
  announce(req.app.get('io'), updated.hotelId)
  res.json({ table: updated })
}))

export default router

import express from 'express'
import mongoose from 'mongoose'
import { authenticate, hotelScope } from '../middleware/auth.js'
import { Notification } from '../models/Notification.js'
import { asyncRoute } from '../utils/http.js'

const router = express.Router()

router.get('/', authenticate, asyncRoute(async (req, res) => {
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  const [items, unreadCount] = await Promise.all([
    Notification.find({
      hotelId: scope,
      readBy: { $ne: req.user._id },
    }).sort({ createdAt: -1 }).limit(20).lean(),
    Notification.countDocuments({ hotelId: scope, readBy: { $ne: req.user._id } }),
  ])
  res.json({
    notifications: items.map(item => ({
      _id: item._id,
      type: item.type,
      title: item.title,
      body: item.body,
      refId: item.refId,
      createdAt: item.createdAt,
    })),
    unread: unreadCount,
  })
}))

router.patch('/:id/read', authenticate, asyncRoute(async (req, res) => {
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })
  if (!req.params.id || !mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Notification not found.' })
  await Notification.updateOne(
    { _id: req.params.id, hotelId: scope, readBy: { $ne: req.user._id } },
    { $addToSet: { readBy: req.user._id } },
  )
  const unread = await Notification.countDocuments({ hotelId: scope, readBy: { $ne: req.user._id } })
  res.json({ unread })
}))

router.patch('/read-all', authenticate, asyncRoute(async (req, res) => {
  const scope = hotelScope(req)
  if (!scope || !mongoose.isValidObjectId(scope)) return res.status(400).json({ message: 'This account is not linked to the business.' })

  await Notification.updateMany(
    { hotelId: scope, readBy: { $ne: req.user._id } },
    { $addToSet: { readBy: req.user._id } },
  )
  const unread = await Notification.countDocuments({ hotelId: scope, readBy: { $ne: req.user._id } })
  res.json({ unread })
}))

export default router

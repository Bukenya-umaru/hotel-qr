import bcrypt from 'bcryptjs'
import express from 'express'
import mongoose from 'mongoose'
import { authenticate, authorize, publicUser } from '../middleware/auth.js'
import { sensitiveLimiter } from '../middleware/rateLimit.js'
import { cacheResponse } from '../utils/cache.js'
import { Hotel } from '../models/Hotel.js'
import { User } from '../models/User.js'
import { asyncRoute, idIsValid, safeSupport } from '../utils/http.js'
import { revealPassword, storePassword, vaultEnabled } from '../utils/passwordVault.js'
import { isStrongPassword, PASSWORD_RULE_MESSAGE } from '../utils/passwordPolicy.js'
import { ALL_PERMISSIONS, validPermissions } from '../utils/permissions.js'
import { recordSecurityEvent } from '../utils/securityLog.js'
import { SecurityEvent } from '../models/SecurityEvent.js'
import { developerUserBody, validate } from '../validation/schemas.js'

const router = express.Router()
router.use(authenticate, authorize('DEVELOPER'))

router.get('/support', asyncRoute(async (_req, res) => {
  const hotel = await Hotel.findOne({ isActive: true }).select('support')
  res.json({ support: safeSupport(hotel?.support), businessConfigured: Boolean(hotel) })
}))

router.patch('/support', asyncRoute(async (req, res) => {
  const business = await Hotel.findOne({ isActive: true }).select('_id')
  if (!business) return res.status(409).json({ message: 'Initialize the business owner setup before updating support details.' })
  const input = req.body.support && typeof req.body.support === 'object' ? req.body.support : req.body
  const limits = { phone: 40, whatsapp: 40, email: 120, hours: 200, message: 400 }
  const updates = {}
  for (const field of Object.keys(limits)) {
    if (input[field] === undefined) continue
    updates[`support.${field}`] = String(input[field] ?? '').trim().slice(0, limits[field])
  }
  if (!Object.keys(updates).length) return res.status(400).json({ message: 'Provide a phone number, WhatsApp number, email, opening hours, or a help message to save.' })
  const hotel = await Hotel.findByIdAndUpdate(business._id, { $set: updates }, { new: true, runValidators: true }).select('support')
  res.json({ support: safeSupport(hotel.support) })
}))

router.post('/users', validate(developerUserBody), asyncRoute(async (req, res) => {
  const { name, email, password, role } = req.body
  const permissions = req.body.permissions === undefined ? undefined : req.body.permissions
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!String(name || '').trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
      !isStrongPassword(password)) {
    return res.status(400).json({ message: 'Provide a name, valid email, and a password of at least 6 characters with letters and numbers.' })
  }
  if (await User.exists({ email: normalizedEmail })) {
    return res.status(409).json({ message: 'An account with that email already exists.' })
  }
  if (role === 'KITCHEN' && permissions !== undefined && !validPermissions(permissions)) {
    return res.status(400).json({ message: 'One or more permissions are not supported.' })
  }
  let business = await Hotel.findOne({ isActive: true }).select('_id name slug city')
  if (!business) {
    if (role !== 'OWNER') {
      return res.status(409).json({ message: 'Create the business owner account before adding chef accounts.' })
    }
    business = await Hotel.findOne().sort({ createdAt: 1 })
    if (business) {
      business.isActive = true
      await business.save()
    } else {
      try {
        business = await Hotel.create({
          name: 'WAGE BITES',
          slug: 'wage-bites',
          city: '',
          tableCount: 24,
          currency: 'UGX',
          taxRate: 0,
          isActive: true,
        })
      } catch (error) {
        if (error.code !== 11000) throw error
        business = await Hotel.findOne({ isActive: true }).select('_id name slug city')
        if (!business) throw error
      }
    }
  }
  if (role === 'KITCHEN' && !(await User.exists({ hotelId: business._id, role: 'OWNER', isActive: true }))) {
    return res.status(409).json({ message: 'Create an active business owner account before adding chef accounts.' })
  }
  try {
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 12),
      role,
      hotelId: business._id,
      permissions: role === 'KITCHEN' ? permissions ?? ALL_PERMISSIONS : undefined,
    })
    storePassword(user, String(password))
    await user.save()
    recordSecurityEvent({ type: 'account_created', severity: 'low', detail: `Created a ${role === 'OWNER' ? 'business owner' : 'chef'} account`, email: normalizedEmail, actorId: req.user._id }, req)
    res.status(201).json({
      user: publicUser(user),
      business: { _id: business._id, name: business.name, slug: business.slug, city: business.city },
    })
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account with that email already exists.' })
    throw error
  }
}))

router.get('/security', asyncRoute(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 60, 1), 200)
  const type = String(req.query.type || '')
  const filter = SECURITY_LOG_TYPES.includes(type) ? { type } : {}
  const [events, summary] = await Promise.all([
    SecurityEvent.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
    SecurityEvent.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
  ])
  res.json({
    events,
    summary: summary.map(entry => ({ type: entry._id, count: entry.count })),
  })
}))

router.get('/users', asyncRoute(async (_req, res) => {
  const business = await Hotel.findOne({ isActive: true }).select('_id')
  const users = business
    ? await User.find({ hotelId: business._id, role: { $in: ['OWNER', 'KITCHEN'] } }).sort({ createdAt: -1 }).select('+passwordVault').lean()
    : []
  res.json({
    users: users.map(user => ({ ...publicUser(user), hasViewablePassword: revealPassword(user) !== null })),
    passwordViewable: vaultEnabled(),
  })
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

router.get('/users/:id/password', sensitiveLimiter, asyncRoute(async (req, res) => {
  if (!idIsValid(req.params.id)) return res.status(404).json({ message: 'Account not found.' })
  const business = await Hotel.findOne({ isActive: true }).select('_id')
  if (!business) return res.status(404).json({ message: 'The business could not be found.' })
  const user = await User.findOne({ _id: req.params.id, hotelId: business._id, role: { $in: ['OWNER', 'KITCHEN'] } }).select('+passwordVault')
  if (!user) return res.status(404).json({ message: 'Account not found.' })
  const password = revealPassword(user)
  if (password === null) {
    const explanation = user.passwordVault
      ? 'A stored password exists for this account, but it was encrypted with an earlier vault key and cannot be decrypted anymore. Reset the password once — after that you can view the current password anytime.'
      : 'No viewable password is stored for this account yet. Reset the password once — after that you can view the current password anytime.'
    return res.status(404).json({ message: explanation })
  }
  recordSecurityEvent({ type: 'password_revealed', severity: 'high', detail: `Revealed the ${user.role === 'OWNER' ? 'owner' : 'chef'} password of ${user.email}`, email: user.email, actorId: req.user._id }, req)
  res.json({ password })
}))

const SECURITY_LOG_TYPES = ['login_failed', 'password_change_failed', 'login_bruteforce', 'account_bruteforce', 'rate_limited', 'token_rejected', 'access_denied', 'password_revealed', 'account_created']

router.get('/overview', cacheResponse(() => 'v1:overview'), asyncRoute(async (_req, res) => {
  const business = await Hotel.findOne({ isActive: true }).select('name slug city tableCount currency taxRate')
  const businessFilter = business ? { hotelId: business._id } : { hotelId: null }
  const userCount = await User.countDocuments({ ...businessFilter, role: { $in: ['OWNER', 'KITCHEN'] }, isActive: true })
  res.json({
    business,
    businessCount: business ? 1 : 0,
    userCount,
    databaseStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
  })
}))

export default router

import bcrypt from 'bcryptjs'
import express from 'express'
import { authenticate, cookieOptions, COOKIE_NAME, issueToken, publicUser } from '../middleware/auth.js'
import { accountLimiter, loginLimiter, sensitiveLimiter } from '../middleware/rateLimit.js'
import { User } from '../models/User.js'
import { asyncRoute } from '../utils/http.js'
import { changePasswordBody, loginBody, validate } from '../validation/schemas.js'
import { storePassword } from '../utils/passwordVault.js'
import { recordSecurityEvent } from '../utils/securityLog.js'
import { isStrongPassword, PASSWORD_RULE_MESSAGE } from '../utils/passwordPolicy.js'

const router = express.Router()

router.post('/login', accountLimiter, loginLimiter, validate(loginBody), asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' })
  const user = await User.findOne({ email }).select('+password').populate('hotelId', 'name slug currency taxRate isActive')
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.password))) {
    const attemptedEmail = email
    recordSecurityEvent({ type: 'login_failed', detail: user && !user.isActive ? 'Attempt against a deactivated account' : 'Invalid credentials', email: attemptedEmail }, req)
    return res.status(401).json({ message: 'Invalid email or password.' })
  }
  if (user.role !== 'DEVELOPER' && (!user.hotelId || !user.hotelId.isActive)) {
    recordSecurityEvent({ type: 'access_denied', severity: 'high', detail: 'Sign-in against a deactivated business', email }, req)
    return res.status(403).json({ message: 'This business is not active.' })
  }
  res.cookie(COOKIE_NAME, issueToken(user), cookieOptions())
  res.json({ user: publicUser(user) })
}))

router.get('/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }))

router.patch('/change-password', authenticate, sensitiveLimiter, validate(changePasswordBody), asyncRoute(async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '')
  const newPassword = String(req.body.newPassword || '')
  if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Provide your current password and a new password.' })
  if (!isStrongPassword(newPassword)) return res.status(400).json({ message: PASSWORD_RULE_MESSAGE })
  if (newPassword === currentPassword) return res.status(400).json({ message: 'Choose a password different from your current one.' })
  const user = await User.findById(req.user._id).select('+password')
  if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
    recordSecurityEvent({ type: 'password_change_failed', severity: 'high', detail: 'Current password did not match', email: user?.email || req.user.email, actorId: req.user._id }, req)
    return res.status(401).json({ message: 'Your current password is incorrect.' })
  }
  user.password = await bcrypt.hash(newPassword, 12)
  storePassword(user, newPassword)
  await user.save()
  res.cookie(COOKIE_NAME, issueToken(user), cookieOptions())
  res.json({ message: 'Password updated successfully.', user: publicUser(user) })
}))

router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined })
  res.status(204).end()
})

export default router

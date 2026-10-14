import express from 'express'
import { cacheResponse } from '../utils/cache.js'
import { Hotel } from '../models/Hotel.js'
import { asyncRoute, safeSupport } from '../utils/http.js'

// Public read of the Help & support contact details. The sign-in form shows
// them so a staff member or developer who cannot get into their account can
// still call the number saved in the Help & support section — and the login
// form always reflects any change made there, because it is read live.
const router = express.Router()

router.get('/', cacheResponse(() => 'v1:support'), asyncRoute(async (_req, res) => {
  const hotel = await Hotel.findOne({ isActive: true }).select('support')
  res.json({ support: safeSupport(hotel?.support) })
}))

export default router

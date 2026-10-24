import express from 'express'
import { cacheResponse } from '../utils/cache.js'
import { Hotel } from '../models/Hotel.js'
import { asyncRoute, safeSupport } from '../utils/http.js'

const router = express.Router()

router.get('/', cacheResponse(() => 'v1:support'), asyncRoute(async (_req, res) => {
  const hotel = await Hotel.findOne({ isActive: true }).select('support')
  res.json({ support: safeSupport(hotel?.support) })
}))

export default router

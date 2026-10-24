import Redis from 'ioredis'
import mongoose from 'mongoose'

const ENABLED = process.env.CACHE_ENABLED !== 'false'
const TTL_SECONDS = Math.max(1, Number(process.env.CACHE_TTL_SECONDS) || 60)
const memory = new Map()
let redis = null
let redisErrorLogged = false

if (ENABLED && process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  })
  redis.on('error', error => {
    if (!redisErrorLogged) {
      console.warn(`Redis cache unavailable (${error.message}); serving uncached responses.`)
      redisErrorLogged = true
    }
  })
}

const logOnce = message => {
  if (!redisErrorLogged) {
    console.warn(`Redis cache error (${message}); serving uncached responses.`)
    redisErrorLogged = true
  }
}

export function hotelKey(hotelId, resource) {
  return `v1:hotel:${hotelId}:${resource}`
}

export async function cacheGet(key) {
  if (!ENABLED || !key) return null
  if (redis) {
    try {
      return await redis.get(key)
    } catch (error) {
      logOnce(error.message)
    }
  }
  const entry = memory.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    memory.delete(key)
    return null
  }
  return entry.value
}

export function cacheSet(key, payload) {
  if (!ENABLED || !key) return
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload)
  if (redis) {
    redis.set(key, raw, 'EX', TTL_SECONDS).catch(error => logOnce(error.message))
    return
  }
  memory.set(key, { value: raw, expiresAt: Date.now() + TTL_SECONDS * 1000 })
}

export async function cacheClose() {
  if (redis) {
    try {
      await redis.quit()
    } catch (error) {
      redis.disconnect()
    }
    redis = null
  }
}

export async function cachePurgeHotel(hotelId) {
  if (!ENABLED || !hotelId) return
  const prefix = `v1:hotel:${hotelId}:`
  if (redis) {
    try {
      const keys = []
      for await (const batch of redis.scanStream({ match: `${prefix}*`, count: 200 })) keys.push(...batch)
      if (keys.length) await redis.unlink(keys)
      return
    } catch (error) {
      logOnce(error.message)
      return
    }
  }
  for (const key of [...memory.keys()]) if (key.startsWith(prefix)) memory.delete(key)
}

export async function cachePurgeAll() {
  if (!ENABLED) return
  if (redis) {
    try {
      const keys = []
      for await (const batch of redis.scanStream({ match: 'v1:*', count: 200 })) keys.push(...batch)
      if (keys.length) await redis.unlink(keys)
      return
    } catch (error) {
      logOnce(error.message)
      return
    }
  }
  memory.clear()
}

export function cacheResponse(keyOf) {
  return async (req, res, next) => {
    if (!ENABLED) return next()
    let key = null
    try {
      key = keyOf(req)
    } catch (error) {
      key = null
    }
    if (!key) return next()
    try {
      const raw = await cacheGet(key)
      if (raw) {
        res.set('X-Cache', 'HIT')
        return res.type('application/json').send(raw)
      }
      const originalJson = res.json.bind(res)
      res.json = payload => {
        res.json = originalJson
        if (res.statusCode < 400) {
          res.set('X-Cache', 'MISS')
          cacheSet(key, payload)
        }
        return originalJson(payload)
      }
      return next()
    } catch (error) {
      logOnce(error.message)
      return next()
    }
  }
}

export function cacheHotelResource(resource, variantOf = () => '') {
  return cacheResponse(req => {
    const scope = req.user?.hotelId?._id || req.user?.hotelId || null
    if (!scope || !mongoose.isValidObjectId(scope)) return null
    const variant = typeof variantOf === 'function' ? variantOf(req) : variantOf
    return hotelKey(scope, [resource, variant].filter(Boolean).join(':'))
  })
}

export function attachCachePurge(schema, { purgeAll = false } = {}) {
  const purgeNow = async function (doc, next) {
    try {
      if (purgeAll) {
        await cachePurgeAll()
      } else {
        const hotelId = doc?.hotelId?._id || doc?.hotelId || this?._conditions?.hotelId
        if (hotelId) await cachePurgeHotel(hotelId)
      }
    } catch (error) {
      console.warn(`Cache purge failed (${error.message})`)
    }
    next()
  }
  for (const event of ['save', 'findOneAndUpdate', 'deleteMany', 'updateMany']) {
    schema.post(event, purgeNow)
  }
  schema.post('deleteOne', { document: true, query: false }, purgeNow)
  schema.post('deleteOne', { document: false, query: true }, purgeNow)
}
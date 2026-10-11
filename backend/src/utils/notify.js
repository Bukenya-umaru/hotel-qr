import { Notification } from '../models/Notification.js'
import { StockItem } from '../models/StockItem.js'

// Broadcasts a data-changed event to the whole business room. Screens that
// graph sales or expenses listen to these and re-fetch instantly, so a new
// record appears on the dashboard without a page refresh.
export function broadcastChange(io, hotelId, event) {
  if (!io || !hotelId) return
  io.to(`hotel:${hotelId}`).emit(event)
}

// Creates a notification and pushes it live to every signed-in device of the
// business's staff watching the hotel room. Never throws into the route — a
// notification failure must not fail the record being saved.
export async function notifyHotel(io, hotelId, { type, title, body = '', refId = null }) {
  if (!io || !hotelId) return
  try {
    const notification = await Notification.create({
      hotelId,
      type,
      title: String(title).slice(0, 80),
      body: String(body).slice(0, 160),
      refId: refId || null,
    })
    io.to(`hotel:${hotelId}`).emit('notification', {
      _id: String(notification._id),
      hotelId: String(hotelId),
      type,
      title: notification.title,
      body: notification.body,
      refId: refId ? String(refId) : null,
      createdAt: notification.createdAt,
    })
  } catch (error) {
    console.error(`Notification failed: ${error.message}`)
  }
}

// Stock is called low below this many units.
export const LOW_STOCK_LIMIT = 5

// Human name of a count unit — 'other' uses its custom name.
export const noun = stock => stock.unit === 'kg' ? 'kg'
  : stock.unit === 'items' ? 'items'
  : stock.unit === 'cups' ? 'cups'
  : stock.unit === 'other' && stock.customUnit ? stock.customUnit
  : 'plates'

// Alerts when names in `stockIds` have dipped to LOW_STOCK_LIMIT or below.
// Reads the current count after deduction and skips names already alerted
// recently (12h) so a busy service doesn't spam the bell.
export async function checkLowStock(io, hotelId, stockIds = []) {
  if (!io || !hotelId || !stockIds.length) return
  try {
    const items = await StockItem.find({
      hotelId,
      _id: { $in: stockIds },
      plates: { $lte: LOW_STOCK_LIMIT },
    }).select('name plates unit customUnit')
    for (const item of items) {
      const recently = await Notification.exists({
        hotelId,
        type: 'low_stock',
        refId: item._id,
        createdAt: { $gte: new Date(Date.now() - 1000 * 60 * 60 * 12) },
      })
      if (recently) continue
      await notifyHotel(io, hotelId, {
        type: 'low_stock',
        title: `Stock running low — ${item.name}`,
        body: `Only ${item.plates} ${noun(item)} left`,
        refId: item._id,
      })
    }
  } catch (error) {
    console.error(`Low stock check failed: ${error.message}`)
  }
}


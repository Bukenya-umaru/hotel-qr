export const asyncRoute = handler => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next)

export const safeNumber = value => Math.round(value * 100) / 100
export const idIsValid = id => /^[a-f\d]{24}$/i.test(String(id || ''))

export const safeMenuItem = item => ({
  _id: item._id,
  name: item.name,
  category: item.category,
  description: item.description,
  price: item.price,
  isAvailable: item.isAvailable,
  imageUrl: item.imageUrl,
})

export const guestOrder = order => ({
  _id: order._id,
  tableNumber: order.tableNumber,
  guestCount: order.guestCount || 1,
  items: order.items.map(({ name, price, quantity }) => ({ name, price, quantity })),
  totalAmount: order.totalAmount,
  status: order.status,
  notes: order.notes,
  createdAt: order.createdAt,
})

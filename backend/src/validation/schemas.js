import { z } from 'zod'

export const validate = schema => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {})
  if (!result.success) return res.status(400).json({ message: 'The submitted data is invalid.' })
  next()
}

const text = max => z.string().max(max)
const hexId = z.string().regex(/^[a-f\d]{24}$/i)
const amount = z.coerce.number().finite().min(0).max(1e9)
const quantity = z.coerce.number().finite().min(0).max(1e6)

export const loginBody = z.object({
  email: text(254),
  password: text(1024),
})
export const changePasswordBody = z.object({
  currentPassword: text(1024),
  newPassword: text(1024),
})

const saleItem = z.object({
  name: text(200),
  quantity: quantity.optional(),
  amount: amount.optional(),
  unit: text(80).optional(),
  stockItemId: hexId.optional(),
})

export const saleBody = z.object({
  items: z.array(saleItem).max(50).optional(),
  name: text(200).optional(),
  quantity: quantity.optional(),
  amount: amount.optional(),
  unit: text(80).optional(),
  customerName: text(200).optional(),
  customerContact: text(120).optional(),
  note: text(300).optional(),
})

export const expenseBody = z.object({
  amount: amount.optional(),
  note: text(300).optional(),
  categoryId: hexId.optional(),
  categoryName: text(200).optional(),
})

export const damageBody = z.object({
  name: text(200),
  quantity: z.coerce.number().finite().min(0).max(1e6).optional(),
  unit: text(80).optional(),
  note: text(300).optional(),
  stockItemId: hexId.optional(),
  value: amount.optional(),
})

export const menuCategoryBody = z.object({
  name: text(200),
  foodType: text(200).optional(),
})

export const expenseCategoryBody = z.object({
  name: text(200),
})

export const menuBody = z.object({
  name: text(200),
  category: text(200),
  description: text(600).optional(),
  price: amount.optional(),
  costPrice: amount.optional(),
})

export const staffBody = z.object({
  name: text(200),
  email: text(320),
  password: text(200),
  permissions: z.array(text(60)).max(20).optional(),
})

export const developerUserBody = z.object({
  name: text(200),
  email: text(320),
  password: text(200),
  role: z.enum(['OWNER', 'KITCHEN']),
  permissions: z.array(text(60)).max(20).optional(),
})

import { z } from 'zod'

// Request-body validation with Zod, mounted before the route handlers on the
// unauthenticated auth surfaces and the main write endpoints. The handlers
// keep their own friendly, field-specific messages — this layer exists to
// stop malformed payloads (wrong types, oversized strings, non-finite
// numbers, injected objects/arrays) before any logic touches them.
//
// Deliberately permissive: unknown keys are ignored — the request body is
// never rewritten, so handlers see exactly what they received before. Only
// hard invariants are enforced here; validations that produce user-facing
// messages (password policy, duplicate names, per-field specifics) stay in
// the handlers.
//
// A rejected payload gets the same JSON the global error handler returns for
// invalid data, so the frontend needs no new handling.
export const validate = schema => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {})
  if (!result.success) return res.status(400).json({ message: 'The submitted data is invalid.' })
  next()
}

// Handlers trim and cap these strings themselves; the caps here only reject
// absurdly oversized payloads (e.g. 10 MB note fields).
const text = max => z.string().max(max)
const hexId = z.string().regex(/^[a-f\d]{24}$/i)
// Numeric fields arrive as JSON numbers or strings from the web forms;
// coercion matches how the handlers read them with Number() afterwards.
const amount = z.coerce.number().finite().min(0).max(1e9)
// The >0 requirement — sale lines, expenses, damages by value — stays in the
// handler so its precise message ('Enter an amount greater than zero.') is
// preserved.
const quantity = z.coerce.number().finite().min(0).max(1e6)

// — Auth (the only unauthenticated bodies) —
export const loginBody = z.object({
  email: text(254),
  password: text(1024),
})
export const changePasswordBody = z.object({
  currentPassword: text(1024),
  newPassword: text(1024),
})

// — Owner writes —
const saleItem = z.object({
  name: text(200),
  quantity: quantity.optional(),
  amount: amount.optional(),
  unit: text(80).optional(),
  stockItemId: hexId.optional(),
})

// A sale is items[] (new) or the legacy single-item fields. Both stay
// optional here: whether the combination is complete is the handler's job
// (it answers with precise messages like 'Give item 1 a name.').
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
  // Only used for damages not linked to stock; the handler enforces that.
  value: amount.optional(),
})

export const menuCategoryBody = z.object({
  name: text(200),
  foodType: text(200).optional(),
})

export const expenseCategoryBody = z.object({
  name: text(200),
})

// Multipart via multer, so fields arrive as strings — coercion handles that.
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

// — Developer writes —
// The developer creates business accounts directly: an OWNER (full access,
// no permissions list) or a KITCHEN chef (optional permission list).
export const developerUserBody = z.object({
  name: text(200),
  email: text(320),
  password: text(200),
  role: z.enum(['OWNER', 'KITCHEN']),
  permissions: z.array(text(60)).max(20).optional(),
})

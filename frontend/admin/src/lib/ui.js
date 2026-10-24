import {
  Boxes, CircleHelp, LayoutDashboard, Rows3, ShieldAlert, ShoppingCart, TrendingUp, Users, Utensils,
} from 'lucide-react'

export const money = (value, currency = 'UGX') => new Intl.NumberFormat('en-UG', {
  style: 'currency',
  currency,
  maximumFractionDigits: 0,
}).format(value || 0)

export const today = new Intl.DateTimeFormat('en-UG', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
}).format(new Date())

export const cx = (...classes) => classes.filter(Boolean).join(' ')

export const PASSWORD_RULE = 'At least 6 characters, including letters and numbers'
export const isStrongPassword = password =>
  typeof password === 'string' && password.length >= 6 && /[a-zA-Z]/.test(password) && /\d/.test(password)

export const passwordStrength = password => {
  if (!password) return 0
  let score = 0
  if (password.length >= 6) score += 1
  if (/[a-zA-Z]/.test(password) && /\d/.test(password)) score += 1
  if (password.length >= 12) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password) && /[^a-zA-Z0-9]/.test(password)) score += 1
  return score
}

export const STRENGTH_STEPS = [
  { label: 'Weak', color: '#ef4444', width: '25%' },
  { label: 'Fair', color: '#fb923c', width: '50%' },
  { label: 'Strong', color: '#22c55e', width: '75%' },
  { label: 'Excellent', color: '#16a34a', width: '100%' },
]

export const PERMISSIONS = [
  { key: 'view_sales', label: 'View sales' },
  { key: 'manage_stock', label: 'Manage stock' },
  { key: 'edit_business_stock', label: 'Edit all stock entries until approved' },
  { key: 'edit_approved_stock', label: 'Edit stock details even after approval' },
  { key: 'manage_expenses', label: 'Manage expenses' },
  { key: 'manage_sales', label: 'Record sales' },
  { key: 'edit_records', label: 'Edit expenses & damages until approved' },
  { key: 'approve_records', label: 'Approve sales, stock & expenses' },
]

export const UNIT_OPTIONS = [
  { key: 'plates', label: 'Plates' },
  { key: 'items', label: 'Items' },
  { key: 'cups', label: 'Cups' },
  { key: 'kg', label: 'KG' },
  { key: 'other', label: 'Other' },
]
export const unitDisplay = (unit, customUnit = '') => unit === 'kg' ? 'kg'
  : unit === 'items' ? 'items'
  : unit === 'cups' ? 'cups'
  : unit === 'other' ? (customUnit || 'units')
  : 'plates'

export const grantedPermissions = user => {
  if (!user || user.role !== 'KITCHEN' || !user.permissions) return PERMISSIONS.map(permission => permission.key)
  return user.permissions
}

export const hasPermission = (user, key) => grantedPermissions(user).includes(key)

export const navItems = {
  OWNER: [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Categories', icon: Rows3, children: [{ label: 'Food type' }, { label: 'Expenses' }] },
    { label: 'Stock', icon: Boxes },
    { label: 'Purchases', icon: ShoppingCart, children: [{ label: 'Record Sale', target: 'Make sale' }, { label: 'Sales' }, { label: 'Expenses', target: 'Purchase expenses' }, { label: 'Damage', target: 'Purchase damages' }] },
    { label: 'Chefs', icon: Users },
    { label: 'Reports', icon: TrendingUp },
  ],
  KITCHEN: [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Categories', icon: Rows3, children: [{ label: 'Food type' }, { label: 'Expenses' }] },
    { label: 'Stock', icon: Boxes },
    { label: 'Purchases', icon: ShoppingCart, children: [{ label: 'Record Sale', target: 'Make sale' }, { label: 'Sales' }, { label: 'Expenses', target: 'Purchase expenses' }, { label: 'Damage', target: 'Purchase damages' }] },
    { label: 'Reports', icon: TrendingUp },
  ],
  DEVELOPER: [
    { label: 'Platform overview', icon: LayoutDashboard },
    { label: 'Security', icon: ShieldAlert },
    { label: 'Accounts', icon: Users },
    { label: 'Help & support', icon: CircleHelp },
  ],
}

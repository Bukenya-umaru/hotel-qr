import {
  Boxes, ChefHat, CircleHelp, LayoutDashboard, Rows3, ShoppingBag, TrendingUp, Users, Utensils,
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

// Minimum password strength: at least 8 characters with both letters and
// numbers. Shared by every form that sets or resets a password.
export const PASSWORD_RULE = 'At least 8 characters, including letters and numbers'
export const isStrongPassword = password =>
  typeof password === 'string' && password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password)

// 0–4 strength score for the live meter shown under password fields.
// 0 = empty, 1 = weak, 2 = fair, 3 = strong, 4 = excellent.
export const passwordStrength = password => {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score += 1
  if (/[a-zA-Z]/.test(password) && /\d/.test(password)) score += 1
  if (password.length >= 12) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password) && /[^a-zA-Z0-9]/.test(password)) score += 1
  return score
}

export const STRENGTH_STEPS = [
  { label: 'Weak', color: '#d9534f', width: '25%' },
  { label: 'Fair', color: '#d88340', width: '50%' },
  { label: 'Strong', color: '#5a9e52', width: '75%' },
  { label: 'Excellent', color: '#3f8f3a', width: '100%' },
]

export const orderCode = order => order.id?.replace('SS-', '') || String(order._id || '').slice(-6).toUpperCase()

export const orderTime = order => order.time || (order.createdAt
  ? new Date(order.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  : 'Just now')

// Capabilities the owner can grant a chef. A chef with no stored
// permissions keeps full access, matching how existing accounts behave.
export const PERMISSIONS = [
  { key: 'view_sales', label: 'View sales' },
  { key: 'manage_menu', label: 'Manage menu' },
  { key: 'manage_tables', label: 'Manage tables' },
  { key: 'manage_stock', label: 'Manage stock' },
  { key: 'manage_expenses', label: 'Manage expenses' },
]

export const grantedPermissions = user => {
  if (!user || user.role !== 'KITCHEN' || !user.permissions) return PERMISSIONS.map(permission => permission.key)
  return user.permissions
}

export const hasPermission = (user, key) => grantedPermissions(user).includes(key)

export const navItems = {
  OWNER: [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Orders', icon: ShoppingBag },
    { label: 'Categories', icon: Rows3, children: [{ label: 'Food type' }, { label: 'Expenses' }] },
    { label: 'Menu', icon: Utensils },
    { label: 'Stock', icon: Boxes },
    { label: 'Tables', icon: ChefHat },
    { label: 'Chefs', icon: Users },
    { label: 'Reports', icon: TrendingUp },
    { label: 'Help & support', icon: CircleHelp },
  ],
  KITCHEN: [
    { label: 'Chef orders', icon: ChefHat },
    { label: 'Categories', icon: Rows3, children: [{ label: 'Food type' }, { label: 'Expenses' }] },
    { label: 'Menu', icon: Utensils },
    { label: 'Stock', icon: Boxes },
    { label: 'Tables', icon: ChefHat },
  ],
  DEVELOPER: [
    { label: 'Platform overview', icon: LayoutDashboard },
    { label: 'Orders', icon: ShoppingBag },
    { label: 'Accounts', icon: Users },
    { label: 'Help & support', icon: CircleHelp },
  ],
}

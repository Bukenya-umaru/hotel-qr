import {
  ChefHat, CircleHelp, LayoutDashboard, ShoppingBag, TrendingUp, Users, Utensils,
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
    { label: 'Menu', icon: Utensils },
    { label: 'Tables', icon: ChefHat },
    { label: 'Chefs', icon: Users },
    { label: 'Reports', icon: TrendingUp },
    { label: 'Help & support', icon: CircleHelp },
  ],
  KITCHEN: [
    { label: 'Chef orders', icon: ChefHat },
    { label: 'Menu', icon: Utensils },
    { label: 'Tables', icon: ChefHat },
  ],
  DEVELOPER: [
    { label: 'Platform overview', icon: LayoutDashboard },
    { label: 'Orders', icon: ShoppingBag },
    { label: 'Accounts', icon: Users },
    { label: 'Help & support', icon: CircleHelp },
  ],
}

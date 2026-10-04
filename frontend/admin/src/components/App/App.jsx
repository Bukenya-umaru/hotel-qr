import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Check, ChefHat, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, Clock3, Coffee, Command, CreditCard, Download,
  Eye, EyeOff, Filter, Globe2, Hotel, LayoutDashboard, Leaf, LogOut, Menu, MoreHorizontal,
  Package, Plus, Search, Settings2, ShieldCheck, ShoppingBag, SlidersHorizontal,
  Sparkles, TrendingUp, Users, Utensils, Wallet, X,
} from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts'
import { API_BASE_URL, api } from '../../lib/api.js'
import { money, today, cx, orderCode, orderTime, navItems, hasPermission } from '../../lib/ui.js'
import { AccessCard } from '../AccessCard/AccessCard.jsx'
import { KitchenBoard } from '../KitchenBoard/KitchenBoard.jsx'
import { MenuPage } from '../MenuPage/MenuPage.jsx'
import { OrdersTable } from '../OrdersTable/OrdersTable.jsx'
import { Reports } from '../Reports/Reports.jsx'
import { AccountsPage } from '../AccountsPage/AccountsPage.jsx'
import { DeveloperDashboard } from '../DeveloperDashboard/DeveloperDashboard.jsx'
import { Overview } from '../Overview/Overview.jsx'
import { Sidebar } from '../Sidebar/Sidebar.jsx'
import { Brand } from '../Brand/Brand.jsx'
import { Header } from '../Header/Header.jsx'
import { LoginModal } from '../LoginModal/LoginModal.jsx'
import { AccountModal } from '../AccountModal/AccountModal.jsx'
import { MenuItemModal } from '../MenuItemModal/MenuItemModal.jsx'
import { ResetPasswordModal } from '../ResetPasswordModal/ResetPasswordModal.jsx'
import { ViewPasswordModal } from '../ViewPasswordModal/ViewPasswordModal.jsx'
import { AccountEditModal } from '../AccountEditModal/AccountEditModal.jsx'
import { ChangePasswordModal } from '../ChangePasswordModal/ChangePasswordModal.jsx'
import { TablesPage } from '../TablesPage/TablesPage.jsx'
import { StockPage } from '../StockPage/StockPage.jsx'
import { CategoriesPage } from '../CategoriesPage/CategoriesPage.jsx'
import { PurchasePage } from '../PurchasePage/PurchasePage.jsx'
import { SupportPage } from '../SupportPage/SupportPage.jsx'
import { SearchModal } from '../SearchModal/SearchModal.jsx'

export default function App() {
  const [user, setUser] = useState(null)
  const role = user?.role || 'OWNER'
  const [page, setPage] = useState(role === 'DEVELOPER' ? 'Platform overview' : role === 'KITCHEN' ? 'Chef orders' : 'Overview')
  const [orders, setOrders] = useState([])
  const [menu, setMenu] = useState([])
  const [menuCategories, setMenuCategories] = useState([])
  const [users, setUsers] = useState([])
  const [analytics, setAnalytics] = useState({
    totalOrdersCount: 0,
    totalRevenue: 0,
    netProfit: 0,
    series: [],
    weekRevenue: 0,
    weekProfit: 0,
    weekOrders: 0,
    isActual: false,
  })
  const [platformOverview, setPlatformOverview] = useState({
    businessCount: 0,
    userCount: 0,
    activeOrdersCount: 0,
    databaseStatus: 'Disconnected',
    passwordViewable: false,
  })
  const [modal, setModal] = useState('')
  const [editingMenu, setEditingMenu] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [resettingUser, setResettingUser] = useState(null)
  const [viewingUser, setViewingUser] = useState(null)
  const [toast, setToast] = useState('')
  const [apiError, setApiError] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  // Mobile drawer accordion state: sections with children collapse, and at
  // most one of them is expanded at a time.
  const [openMobileGroups, setOpenMobileGroups] = useState(() => new Set())
  const [notifications, setNotifications] = useState([])
  const [searchOpen, setSearchOpen] = useState(false)
  const hotelName = user?.hotel?.name || (role === 'DEVELOPER' ? 'WAGA BITS support' : 'Your business')

  useEffect(() => {
    api('/api/auth/me').then(data => { setUser(data.user); if (data.user.role) setPage(data.user.role === 'DEVELOPER' ? 'Platform overview' : data.user.role === 'KITCHEN' ? 'Chef orders' : 'Overview') }).catch(() => {})
  }, [])
  useEffect(() => {
    if (user && user.role !== 'DEVELOPER') {
      api('/api/orders/active').then(data => setOrders(data.orders)).catch(err => setApiError(err.message))
      api('/api/owner/menu').then(data => setMenu(data.items)).catch(err => setApiError(err.message))
      api('/api/owner/categories').then(data => setMenuCategories(data.categories)).catch(() => {})
    }
    if (user && ['OWNER', 'DEVELOPER'].includes(user.role)) {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 6)
      const from = start.toISOString().slice(0, 10)
      const to = end.toISOString().slice(0, 10)
      Promise.all([
        api('/api/owner/analytics/daily'),
        api(`/api/owner/analytics/reports?from=${from}&to=${to}`),
      ]).then(([daily, weekly]) => setAnalytics({
        ...daily,
        series: weekly.series,
        weekRevenue: weekly.totalRevenue,
        weekProfit: weekly.netProfit,
        weekOrders: weekly.totalOrdersCount,
        reportOrders: weekly.orders,
        isActual: true,
      })).catch(err => setApiError(err.message))
    }
    if (user?.role === 'OWNER') {
      api('/api/owner/staff').then(data => setUsers(data.users)).catch(err => setApiError(err.message))
    }
    if (user?.role === 'DEVELOPER') {
      api('/api/developer/users').then(data => {
        setUsers(data.users)
        setPlatformOverview(previous => ({ ...previous, passwordViewable: Boolean(data.passwordViewable) }))
      }).catch(err => setApiError(err.message))
      api('/api/developer/orders').then(data => setOrders(data.orders)).catch(err => setApiError(err.message))
      api('/api/developer/overview').then(data => setPlatformOverview(data)).catch(err => setApiError(err.message))
    }
  }, [user])
  useEffect(() => { setPage(role === 'DEVELOPER' ? 'Platform overview' : role === 'KITCHEN' ? 'Chef orders' : 'Overview') }, [role])
  useEffect(() => {
    if (!user) return undefined
    const socket = io(API_BASE_URL || undefined, { withCredentials: true })
    const businessId = user.role === 'DEVELOPER' ? platformOverview.business?._id : user.hotelId
    if (businessId) socket.emit('join_hotel', businessId)
    if (user.hotel?.slug) socket.emit('join_menu', user.hotel.slug)
    const refreshSupportOverview = () => {
      if (user.role !== 'DEVELOPER') return
      api('/api/developer/overview').then(data => {
        setPlatformOverview(data)
      }).catch(err => setApiError(err.message))
    }
    socket.on('new_order', order => {
      setOrders(previous => [order, ...previous])
      if (user.role === 'KITCHEN') playNewOrderChime()
      pushNotification({ type: 'new_order', order })
      refreshSupportOverview()
    })
    socket.on('order_status', update => setOrders(previous => previous.map(order => (order._id || order.id) === update._id ? { ...order, ...update } : order)))
    socket.on('order_updated', update => {
      setOrders(previous => previous.map(order => (order._id || order.id) === update._id ? { ...order, ...update } : order))
      pushNotification({ type: 'order_updated', order: update })
      refreshSupportOverview()
    })
    socket.on('tables_updated', payload => {
      pushNotification({ type: 'tables_updated', table: payload?.table })
    })
    socket.on('menu_updated', () => {
      if (user.role === 'DEVELOPER') return
      api('/api/owner/menu').then(data => setMenu(data.items)).catch(() => {})
      api('/api/owner/categories').then(data => setMenuCategories(data.categories)).catch(() => {})
    })
    return () => socket.disconnect()
  }, [user, platformOverview.business?._id])
  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  // Live notification feed for the bell dropdown; newest first, capped.
  const pushNotification = notification => setNotifications(previous => [{ ...notification, id: `${notification.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString(), read: false }, ...previous].slice(0, 50))
  const unreadCount = notifications.filter(notification => !notification.read).length
  const markAllRead = () => setNotifications(previous => previous.map(entry => ({ ...entry, read: true })))
  const clearNotifications = () => setNotifications([])
  const openNotification = notification => {
    setNotifications(previous => previous.map(entry => entry.id === notification.id ? { ...entry, read: true } : entry))
    if (notification.type === 'tables_updated') setPage('Tables')
    else setPage(role === 'KITCHEN' ? 'Chef orders' : 'Orders')
  }

  const currentNav = (navItems[role] || navItems.OWNER).filter(item => {
    if (role !== 'KITCHEN') return true
    if (item.label === 'Menu' || item.label === 'Categories') return hasPermission(user, 'manage_menu')
    if (item.label === 'Tables') return hasPermission(user, 'manage_tables')
    if (item.label === 'Stock') return hasPermission(user, 'manage_stock')
    if (item.label === 'Expenses') return hasPermission(user, 'manage_expenses')
    if (item.label === 'Purchase') return hasPermission(user, 'manage_sales')
    return true
  })
  // Single-open accordion: expanding a section hides the subsections of any
  // other section, and the section owning the current page opens itself.
  // Children may carry their own target page (Purchase > Expenses vs the
  // Categories subsection with the same label).
  useEffect(() => {
    const active = currentNav.find(item => item.children?.some(child => (child.target || child.label) === page))
    if (active) setOpenMobileGroups(previous => previous.has(active.label) && previous.size === 1 ? previous : new Set([active.label]))
  }, [page, currentNav])
  const toggleMobileGroup = label => setOpenMobileGroups(previous => previous.has(label) ? new Set() : new Set([label]))
  const canManageMenu = hasPermission(user, 'manage_menu')
  const canManageTables = hasPermission(user, 'manage_tables')
  const canManageStock = role === 'OWNER' || hasPermission(user, 'manage_stock')
  const canViewSales = hasPermission(user, 'view_sales')
  // Managed sections plus any category already in use on dishes — old
  // categories always stay visible and selectable for new menu items.
  const managedCategoryNames = menuCategories.map(category => category.name)
  const allMenuCategories = [...new Set([...managedCategoryNames, ...menu.map(item => item.category).filter(Boolean)])]
    .sort((left, right) => left.localeCompare(right))
  const advanceOrder = async order => {
    const next = { Pending: 'Preparing', Preparing: 'Ready', Ready: 'Served' }[order.status]
    if (!next) return
    if (user) {
      try {
        const data = await api(`/api/orders/${order._id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) })
        setOrders(previous => previous.map(entry => entry._id === order._id ? { ...entry, ...data.order } : entry))
      } catch (err) { setToast(err.message) }
    } else setOrders(previous => previous.map(entry => entry.id === order.id ? { ...entry, status: next } : entry))
  }
  const playNewOrderChime = () => {
    if (!window.AudioContext) return
    const audio = new window.AudioContext()
    const oscillator = audio.createOscillator()
    const volume = audio.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, audio.currentTime)
    oscillator.frequency.setValueAtTime(1175, audio.currentTime + 0.13)
    volume.gain.setValueAtTime(0.12, audio.currentTime)
    volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.38)
    oscillator.connect(volume)
    volume.connect(audio.destination)
    oscillator.start()
    oscillator.stop(audio.currentTime + 0.38)
    oscillator.onended = () => audio.close()
  }
  const login = async (email, password) => {
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    setUser(data.user)
    setModal('')
    setToast(`Welcome back, ${data.user.name.split(' ')[0]}`)
  }
  const logout = async () => {
    try { await api('/api/auth/logout', { method: 'POST' }) } catch (err) { setToast(err.message) }
    setUser(null)
  }
  const changeOwnPassword = async ({ currentPassword, newPassword }) => {
    await api('/api/auth/change-password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) })
    setModal('')
    setToast('Your password has been updated')
  }
  const createAccount = async form => {
    if (!user || user.role !== 'OWNER') throw new Error('Sign in as the business owner to create a chef account.')
    const data = await api('/api/owner/staff', { method: 'POST', body: JSON.stringify(form) })
    setUsers(previous => [data.user, ...previous])
    setModal('')
    setToast('Chef account created successfully')
  }
  const loadReportRange = async (from, to) => {
    if (!user) return
    try {
      const report = await api(`/api/owner/analytics/reports?from=${from}&to=${to}`)
      setAnalytics(previous => ({
        ...previous,
        series: report.series,
        weekRevenue: report.totalRevenue,
        weekProfit: report.netProfit,
        weekOrders: report.totalOrdersCount,
        reportOrders: report.orders,
        isActual: true,
      }))
    } catch (err) { setToast(err.message) }
  }
  const ensureCategory = async (name, foodType = '') => {
    const data = await api('/api/owner/categories', { method: 'POST', body: JSON.stringify({ name, foodType }) })
    setMenuCategories(previous => previous.some(category => category.name.toLowerCase() === data.category.name.toLowerCase())
      ? previous
      : [...previous, data.category].sort((left, right) => left.name.localeCompare(right.name)))
    return data.category
  }
  const renameCategory = async (oldName, name, foodType) => {
    const entry = menuCategories.find(category => category.name === oldName)
    if (!entry) throw new Error('That section is not a managed category.')
    const data = await api(`/api/owner/categories/${entry._id}`, {
      method: 'PATCH',
      body: JSON.stringify(foodType === undefined ? { name } : { name, foodType }),
    })
    setMenuCategories(previous => previous.map(category => category._id === (data.category._id || entry._id) ? { ...category, name: data.category.name, foodType: data.category.foodType ?? category.foodType } : category))
    setMenu(previous => previous.map(item => item.category === oldName ? { ...item, category: data.category.name } : item))
  }
  const deleteCategory = async name => {
    const entry = menuCategories.find(category => category.name === name)
    if (!entry) throw new Error('That section is not a managed category.')
    await api(`/api/owner/categories/${entry._id}`, { method: 'DELETE' })
    setMenuCategories(previous => previous.filter(category => category._id !== entry._id))
  }
  const createMenuItem = async form => {
    if (!user || !['OWNER', 'KITCHEN'].includes(user.role)) throw new Error('Sign in as the business owner or chef to manage the menu.')
    const data = editingMenu
      ? await api(`/api/owner/menu/${editingMenu._id}`, { method: 'PATCH', body: form })
      : await api('/api/owner/menu', { method: 'POST', body: form })
    setMenu(previous => editingMenu
      ? previous.map(entry => entry._id === editingMenu._id ? { ...entry, ...data.item } : entry)
      : [data.item, ...previous])
    setEditingMenu(null)
    setModal('')
    setToast(editingMenu ? 'Menu item updated' : 'Menu item added')
  }
  const deleteMenuItem = async item => {
    if (!window.confirm(`Remove ${item.name} from the menu?`)) return
    if (!user || !['OWNER', 'KITCHEN'].includes(user.role)) return
    try { await api(`/api/owner/menu/${item._id}`, { method: 'DELETE' }) } catch (err) { setToast(err.message); return }
    setMenu(previous => previous.filter(entry => entry._id !== item._id && entry.id !== item.id))
    setToast('Menu item removed')
  }
  const resetUserPassword = async password => {
    if (!user || user.role !== 'DEVELOPER') throw new Error('Sign in as a developer to manage accounts.')
    await api(`/api/developer/users/${resettingUser._id}`, { method: 'PATCH', body: JSON.stringify({ password }) })
    setResettingUser(null)
    setModal('')
    setToast('Password reset successfully')
  }
  const updateAccount = async details => {
    if (!user || !editingUser) return
    if (user.role === 'OWNER' && editingUser.role === 'KITCHEN') {
      try {
        const data = await api(`/api/owner/staff/${editingUser._id}`, { method: 'PATCH', body: JSON.stringify(details) })
        setUsers(previous => previous.map(entry => entry._id === editingUser._id ? { ...entry, ...data.user } : entry))
        setToast('Chef account updated')
      } catch (err) { setToast(err.message); return }
    } else {
      if (user.role !== 'DEVELOPER') throw new Error('Log in as a developer to manage accounts.')
      try {
        const data = await api(`/api/developer/users/${editingUser._id}`, { method: 'PATCH', body: JSON.stringify(details) })
        setUsers(previous => previous.map(entry =>
          (editingUser._id ? entry._id === editingUser._id : entry.id === editingUser.id)
            ? { ...entry, ...data.user }
            : entry,
        ))
        setToast('Account updated')
      } catch (err) { setToast(err.message); return }
    }
    setEditingUser(null)
    setModal('')
  }
  const toggleMenuItem = async item => {
    const available = !(item.isAvailable ?? item.available)
    if (user && ['OWNER', 'KITCHEN'].includes(user.role)) {
      try {
        const data = await api(`/api/owner/menu/${item._id}`, { method: 'PATCH', body: JSON.stringify({ isAvailable: available }) })
        setMenu(previous => previous.map(entry => entry._id === item._id ? { ...entry, ...data.item, available: data.item.isAvailable } : entry))
        return
      } catch (err) { setToast(err.message); return }
    }
  }
  const toggleUser = async account => {
    const active = account.isActive === false
    if (!user || !['DEVELOPER', 'OWNER'].includes(user.role)) return
    const endpoint = user.role === 'OWNER' ? `/api/owner/staff/${account._id}` : `/api/developer/users/${account._id}`
    try { await api(endpoint, { method: 'PATCH', body: JSON.stringify({ isActive: active }) }) } catch (err) { setToast(err.message); return }
    setUsers(previous => previous.map(entry => entry._id === account._id ? { ...entry, isActive: active } : entry))
    setToast(active ? 'Account reactivated' : 'Account deactivated')
  }

  let content
  if (!user) content = <AccessCard onLogin={() => setModal('login')} />
  else if (role === 'KITCHEN' && page === 'Chef orders') content = <KitchenBoard orders={orders} onAdvance={advanceOrder} hotelName={hotelName} chefName={user?.name?.split(' ')[0] || ''} canViewSales={canViewSales} />
  else if (page === 'Menu') content = <MenuPage menu={menu} role={role} manageable={canManageMenu} onAdd={() => { setEditingMenu(null); setModal('menu') }} onToggle={toggleMenuItem} onEdit={item => { setEditingMenu(item); setModal('menu') }} onDelete={deleteMenuItem} categories={allMenuCategories} />
  else if (page === 'Tables' && ['OWNER', 'KITCHEN'].includes(role)) content = <TablesPage user={user} canManage={canManageTables} />
  else if (page === 'Food type') content = <CategoriesPage initialView="foodtype" />
  else if (page === 'Expenses') content = <CategoriesPage initialView="expenses" />
  else if (page === 'Make sale' && ['OWNER', 'KITCHEN'].includes(role)) content = <PurchasePage initialView="make-sale" canManageExpenses={hasPermission(user, 'manage_expenses')} />
  else if (page === 'Sales' && ['OWNER', 'KITCHEN'].includes(role)) content = <PurchasePage initialView="sales" canManageExpenses={hasPermission(user, 'manage_expenses')} />
  else if (page === 'Purchase expenses' && ['OWNER', 'KITCHEN'].includes(role)) content = <PurchasePage initialView="expenses" canManageExpenses={hasPermission(user, 'manage_expenses')} />
  else if (page === 'Stock' && ['OWNER', 'KITCHEN'].includes(role)) content = <StockPage user={user} canManage={canManageStock} foodTypes={managedCategoryNames} />
  else if (page === 'Help & support' && ['OWNER', 'DEVELOPER'].includes(role)) content = <SupportPage role={role} />
  else if (page === 'Orders') content = <OrdersTable orders={orders} onAdvance={role === 'KITCHEN' || role === 'OWNER' ? advanceOrder : undefined} />
  else if (page === 'Reports') content = <Reports orders={orders} analytics={analytics} currency="UGX" onRange={loadReportRange} />
  else if (page === 'Accounts' || page === 'Chefs') content = <AccountsPage users={users} role={role} passwordViewable={platformOverview.passwordViewable} onCreate={() => setModal('account')} onToggle={toggleUser} onReset={account => { setResettingUser(account); setModal('reset') }} onEdit={account => { setEditingUser(account); setModal('edit-account') }} onView={account => { setViewingUser(account); setModal('view-password') }} />
  else if (role === 'DEVELOPER') content = <DeveloperDashboard users={users} orders={orders} onNavigate={setPage} overview={platformOverview} />
  else content = <Overview orders={orders} menu={menu} hotelName={hotelName} onNavigate={setPage} analytics={analytics} currency="UGX" />

  return <div className="min-h-screen bg-[#f7f7f4]">
    <Sidebar role={role} page={page} setPage={setPage} user={user} onLogin={() => setModal('login')} onLogout={logout} onChangePassword={() => setModal('change-password')} hotelName={hotelName} items={currentNav} />
    {mobileNav && <div className="fixed inset-0 z-30 bg-[#1f291d]/30 lg:hidden" onMouseDown={e => { if (e.target === e.currentTarget) setMobileNav(false) }}><div className="flex h-full max-h-[100dvh] w-[min(270px,85vw)] flex-col overflow-y-auto bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between px-2 py-2"><Brand /><button onClick={() => setMobileNav(false)} aria-label="Close navigation" className="grid size-9 place-items-center rounded-lg hover:bg-[#f7f8f5]"><X size={18} /></button></div><div className="mt-5 rounded-xl border border-[#eceee8] p-3"><p className="truncate text-[11px] font-semibold">{hotelName}</p><p className="mt-1 text-[10px] text-[#999d94]">{user?.name || 'WAGA BITS'}</p></div><p className="mb-2 mt-6 px-2 text-[10px] font-bold uppercase tracking-[1.3px] text-[#a3a79d]">{role === 'DEVELOPER' ? 'Developer support' : role === 'KITCHEN' ? 'Chef portal' : 'Owner portal'}</p><nav className="space-y-1">{currentNav.map(item => item.children
              ? <div key={item.label}><button onClick={() => toggleMobileGroup(item.label)} className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[12px] font-semibold transition', item.children.some(child => child.label === page) ? 'bg-[#fff1e6] text-[#a34b16]' : 'text-[#70776d] hover:bg-[#f7f8f5] hover:text-[#394337]')}><item.icon size={17} /><span className="flex-1">{item.label}</span><ChevronDown size={14} className={cx('shrink-0 text-[#a5a99f] transition-transform', openMobileGroups.has(item.label) ? '' : '-rotate-90')} /></button>{openMobileGroups.has(item.label) && <div className="ml-[26px] border-l border-[#eaece6] pl-3">{item.children.map(child => <button key={child.label} onClick={() => { setPage(child.target || child.label); setMobileNav(false) }} className={cx('flex w-full items-center rounded-lg px-3 py-2.5 text-left text-[12px]', page === (child.target || child.label) ? 'bg-[#fff1e6] text-[#a34b16]' : 'text-[#70776d]')}>{child.label}</button>)}</div>}</div>
              : <button key={item.label} onClick={() => { setPage(item.label); setMobileNav(false) }} className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[12px]', page === item.label ? 'bg-[#fff1e6] text-[#a34b16]' : 'text-[#70776d]')}><item.icon size={17} />{item.label}</button>)}</nav><div className="mt-auto space-y-1 pt-5">{user ? <button onClick={() => { setMobileNav(false); logout() }} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-[12px] text-[#70776d] hover:bg-[#f7f8f5]"><LogOut size={16} />Sign out</button> : <button onClick={() => { setMobileNav(false); setModal('login') }} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-[12px] text-[#70776d] hover:bg-[#f7f8f5]"><ShieldCheck size={16} />Sign in</button>}</div></div></div>}
    <div className="min-h-screen min-w-0 lg:pl-[250px]"><div className="flex items-center border-b border-[#eaece6] bg-[#f7f7f4]/90 px-3 sm:px-4 lg:hidden"><button onClick={() => setMobileNav(true)} className="mr-2 grid size-10 shrink-0 place-items-center text-[#687061]" aria-label="Open navigation"><Menu size={19} /></button><Brand /></div>    <Header role={role} page={page} onLogin={() => setModal('login')} user={user} hotelName={hotelName} titleOverride={page === 'Purchase expenses' ? 'Expenses' : role === 'OWNER' && page === 'Overview' ? `Good morning, ${user?.name?.split(' ')[0] || ''}` : undefined} notifications={notifications} unreadCount={unreadCount} onMarkAllRead={markAllRead} onClearNotifications={clearNotifications} onOpenNotification={openNotification} onNavigate={setPage} menu={menu} orders={orders} />
    {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} onNavigate={setPage} menu={menu} orders={orders} role={role} />}<main className="mx-auto min-w-0 max-w-[1420px] px-3 py-4 sm:px-6 sm:py-6 lg:px-9 lg:py-7">{apiError && user && <div className="mb-4 flex items-center justify-between rounded-lg bg-[#fbf1df] px-3 py-2.5 text-[10px] text-[#8c6b35]"><span className="min-w-0 break-words">{apiError}</span><button onClick={() => setApiError('')} className="ml-2 shrink-0"><X size={14} /></button></div>}{content}</main></div>
    {modal === 'login' && <LoginModal onClose={() => setModal('')} onLogin={login} />}
    {modal === 'account' && role === 'OWNER' && <AccountModal onClose={() => setModal('')} onSubmit={createAccount} />}
    {modal === 'menu' && <MenuItemModal role={role} categories={allMenuCategories} onClose={() => { setModal(''); setEditingMenu(null) }} onSubmit={createMenuItem} initial={editingMenu} />}
    {modal === 'reset' && resettingUser && <ResetPasswordModal account={resettingUser} onClose={() => { setModal(''); setResettingUser(null) }} onSubmit={resetUserPassword} />}
    {modal === 'view-password' && viewingUser && <ViewPasswordModal account={viewingUser} onClose={() => { setModal(''); setViewingUser(null) }} />}
    {modal === 'edit-account' && editingUser && <AccountEditModal account={editingUser} viewerRole={role} onClose={() => { setModal(''); setEditingUser(null) }} onSubmit={updateAccount} />}
    {modal === 'change-password' && <ChangePasswordModal onClose={() => setModal('')} onSubmit={changeOwnPassword} />}
    {toast && <div className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-3 right-3 z-[60] flex items-center justify-center gap-2 rounded-xl bg-[#283426] px-4 py-3 text-center text-[11px] font-medium text-white shadow-lg sm:bottom-5 sm:left-auto sm:right-5"><Check className="shrink-0 text-[#f1c49e]" size={15} />{toast}</div>}
  </div>
}

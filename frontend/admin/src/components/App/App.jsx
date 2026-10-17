import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import { Check, ChevronDown, LogOut, Menu, ShieldCheck, X } from 'lucide-react'
import { api, API_BASE_URL } from '../../lib/api.js'
import { cx, navItems, hasPermission } from '../../lib/ui.js'
import { applyTheme, readTheme, toggleTheme } from '../../lib/theme.js'
import { Reports } from '../Reports/Reports.jsx'
import { AccountsPage } from '../AccountsPage/AccountsPage.jsx'
import { DeveloperDashboard } from '../DeveloperDashboard/DeveloperDashboard.jsx'
import { Overview } from '../Overview/Overview.jsx'
import { Sidebar } from '../Sidebar/Sidebar.jsx'
import { Brand } from '../Brand/Brand.jsx'
import { Header } from '../Header/Header.jsx'
import { LoginPage } from '../LoginPage/LoginPage.jsx'
import { AccountModal } from '../AccountModal/AccountModal.jsx'
import { ResetPasswordModal } from '../ResetPasswordModal/ResetPasswordModal.jsx'
import { ViewPasswordModal } from '../ViewPasswordModal/ViewPasswordModal.jsx'
import { AccountEditModal } from '../AccountEditModal/AccountEditModal.jsx'
import { ChangePasswordModal } from '../ChangePasswordModal/ChangePasswordModal.jsx'
import { StockPage } from '../StockPage/StockPage.jsx'
import { CategoriesPage } from '../CategoriesPage/CategoriesPage.jsx'
import { PurchasePage } from '../PurchasePage/PurchasePage.jsx'
import { SupportPage } from '../SupportPage/SupportPage.jsx'
import { SecurityPage } from '../SecurityPage/SecurityPage.jsx'
import { ActionProgress } from '../ActionProgress/ActionProgress.jsx'

const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export default function App() {
  const [user, setUser] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const [sessionCheckAttempt, setSessionCheckAttempt] = useState(0)
  const role = user?.role || 'OWNER'
  const [page, setPage] = useState(role === 'DEVELOPER' ? 'Platform overview' : 'Overview')
  const [users, setUsers] = useState([])
  const [analytics, setAnalytics] = useState({
    totalSalesCount: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    netBalance: 0,
    sales: [],
    expenses: [],
    series: [],
    isActual: false,
  })
  const [platformOverview, setPlatformOverview] = useState({
    businessCount: 0,
    userCount: 0,
    databaseStatus: 'Disconnected',
    passwordViewable: false,
  })
  const [modal, setModal] = useState('')
  const [editingUser, setEditingUser] = useState(null)
  const [resettingUser, setResettingUser] = useState(null)
  const [viewingUser, setViewingUser] = useState(null)
  const [passwordLoadingId, setPasswordLoadingId] = useState('')
  const [toast, setToast] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const [apiError, setApiError] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [theme, setTheme] = useState(readTheme)
  const flipTheme = () => setTheme(toggleTheme(theme))
  // One shared live socket for real-time notifications; 'live' is the node the
  // bell-listeners attach to. A toast pops while the dropdown is closed.
  const [live, setLive] = useState(null)
  const [notificationToast, setNotificationToast] = useState(null)
  // The dashboard's selected range, kept in App so the live re-fetch below
  // and the Overview's filter stay in sync. Defaults to the current date.
  const [reportRange, setReportRange] = useState(() => {
    const today = new Date()
    return { from: dateKey(today), to: dateKey(today) }
  })
  // Mobile drawer accordion state: sections with children collapse, and at
  // most one of them is expanded at a time.
  const [openMobileGroups, setOpenMobileGroups] = useState(() => new Set())
  const hotelName = user?.hotel?.name || (role === 'DEVELOPER' ? 'WAGA BITES support' : 'Your business')

  useEffect(() => { applyTheme(theme) }, [])
  useEffect(() => {
    let active = true
    setSessionLoading(true)
    setSessionError('')
    api('/api/auth/me')
      .then(data => {
        if (!active) return
        setUser(data.user)
        if (data.user.role) setPage(data.user.role === 'DEVELOPER' ? 'Platform overview' : 'Overview')
      })
      .catch(error => {
        if (!active) return
        if (error.status === 401) {
          setUser(null)
          return
        }
        setSessionError(error.message)
      })
      .finally(() => { if (active) setSessionLoading(false) })
    return () => { active = false }
  }, [sessionCheckAttempt])
  useEffect(() => {
    if (user && ['OWNER', 'KITCHEN'].includes(user.role)) {
      const today = new Date()
      const from = dateKey(today)
      const to = dateKey(today)
      api(`/api/owner/analytics/reports?from=${from}&to=${to}`)
        .then(data => setAnalytics({ ...data, isActual: true }))
        .catch(err => setApiError(err.message))
    }
    if (user?.role === 'OWNER') {
      api('/api/owner/staff').then(data => {
        setUsers(data.users)
        setPlatformOverview(previous => ({ ...previous, passwordViewable: Boolean(data.passwordViewable) }))
      }).catch(err => setApiError(err.message))
    }
    if (user?.role === 'DEVELOPER') {
      api('/api/developer/users').then(data => {
        setUsers(data.users)
        setPlatformOverview(previous => ({ ...previous, passwordViewable: Boolean(data.passwordViewable) }))
      }).catch(err => setApiError(err.message))
      api('/api/developer/overview').then(data => setPlatformOverview(data)).catch(err => setApiError(err.message))
    }
  }, [user])
  useEffect(() => { setPage(role === 'DEVELOPER' ? 'Platform overview' : 'Overview') }, [role])
  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [toast])
  useEffect(() => {
    if (!notificationToast) return undefined
    const timeout = window.setTimeout(() => setNotificationToast(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [notificationToast])

  // Connect on sign-in, disconnect cleanly on sign-out. Registered inside the
  // effect so reconnects re-run the join_hotel handshake.
  useEffect(() => {
    if (!user) return undefined
    const socket = io(API_BASE_URL || undefined, { withCredentials: true, reconnectionDelayMax: 5000 })
    socket.on('connect', () => {
      socket.emit('join_hotel', user.hotelId)
      setLive(socket)
    })
    return () => { socket.disconnect(); setLive(null) }
  }, [user])

  // Toast on new pushes — the dropdown itself re-fetches via its own listener.
  // socket.io-client sockets use .on/.off, not DOM addEventListener.
  useEffect(() => {
    if (!live || !user) return undefined

    // Any record that shapes the dashboard graphs (sales or expenses) triggers
    // an instant re-fetch of the visible date range.
    const evts = ['sales_changed', 'expenses_changed']
    for (const evt of evts) live.on(evt, refreshLiveRange)
    return () => { for (const evt of evts) live.off(evt, refreshLiveRange) }
  }, [live, user, reportRange])

  useEffect(() => {
    if (!live || !user) return undefined
    const onNotification = payload => {
      if (!payload) return
      setNotificationToast(payload)
      try {
        // Small ping; audio may be blocked until first interaction.
        const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==')
        audio.volume = 0.25
        audio.play().catch(() => {})
      } catch { /* audio is optional */ }
    }
    live.on('notification', onNotification)
    return () => live.off('notification', onNotification)
  }, [live, user])

  const currentNav = useMemo(() => (navItems[role] || navItems.OWNER).flatMap(item => {
    if (role !== 'KITCHEN') return [item]
    if (item.label === 'Stock' && !hasPermission(user, 'manage_stock')) return []
    if (item.label === 'Categories') {
      const children = item.children.filter(child => child.label !== 'Expenses' || hasPermission(user, 'manage_expenses'))
      return [{ ...item, children }]
    }
    if (item.label !== 'Purchases') return [item]
    const children = item.children.filter(child => {
      const target = child.target || child.label
      if (target === 'Make sale') return hasPermission(user, 'manage_sales')
      if (target === 'Sales') return hasPermission(user, 'view_sales')
      if (target === 'Purchase expenses') return hasPermission(user, 'manage_expenses')
      if (target === 'Purchase damages') return hasPermission(user, 'manage_expenses')
      return true
    })
    return children.length ? [{ ...item, children }] : []
  }), [role, user])
  // Single-open accordion: expanding a section hides the subsections of any
  // other section, and the section owning the current page opens itself.
  // Children may carry their own target page (Purchases > Expenses vs the
  // Categories subsection with the same label).
  useEffect(() => {
    const active = currentNav.find(item => item.children?.some(child => (child.target || child.label) === page))
    if (active) setOpenMobileGroups(previous => previous.has(active.label) && previous.size === 1 ? previous : new Set([active.label]))
  }, [page, currentNav])
  const toggleMobileGroup = label => setOpenMobileGroups(previous => previous.has(label) ? new Set() : new Set([label]))
  const canManageStock = role === 'OWNER' || hasPermission(user, 'manage_stock')
  const login = async (email, password) => {
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    setUser(data.user)
    setModal('')
    setToast(`Welcome back, ${data.user.name.split(' ')[0]}`)
  }
  const logout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await api('/api/auth/logout', { method: 'POST' })
      setUser(null)
    } catch (err) {
      setToast(err.message)
    } finally {
      setLoggingOut(false)
    }
  }
  const changeOwnPassword = async ({ currentPassword, newPassword }) => {
    await api('/api/auth/change-password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) })
    setModal('')
    setToast('Your password has been updated')
  }
  const createAccount = async form => {
    if (!user || !['OWNER', 'DEVELOPER'].includes(user.role)) throw new Error('Sign in as the developer or business owner to create an account.')
    // The developer creates owner or chef accounts directly from the
    // support dashboard; the owner creates their own chefs.
    const endpoint = user.role === 'DEVELOPER' ? '/api/developer/users' : '/api/owner/staff'
    const data = await api(endpoint, { method: 'POST', body: JSON.stringify(form) })
    setUsers(previous => [data.user, ...previous])
    if (user.role === 'DEVELOPER' && data.business) {
      setPlatformOverview(previous => ({
        ...previous,
        business: data.business,
        businessCount: 1,
        userCount: Number(previous.userCount || 0) + 1,
      }))
    }
    setModal('')
    setToast(form.role === 'OWNER' && user.role === 'DEVELOPER' ? 'Business owner account created' : 'Chef account created successfully')
  }
  const loadReportRange = async (from, to) => {
    if (!user) return
    try {
      const report = await api(`/api/owner/analytics/reports?from=${from}&to=${to}`)
      setAnalytics({ ...report, isActual: true })
      setReportRange({ from, to })
    } catch (err) { setToast(err.message) }
  }
  // Live dashboards: sales/expense mutations broadcast these events, so the
  // visible period re-fetches instantly — no page refresh needed.
  const refreshLiveRange = () => {
    if (!user || !['OWNER', 'KITCHEN'].includes(user.role)) return
    api(`/api/owner/analytics/reports?from=${reportRange.from}&to=${reportRange.to}`)
      .then(data => setAnalytics({ ...data, isActual: true }))
      .catch(() => { /* transient; next event or navigation retries */ })
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
      } catch (err) { setToast(err.message); throw err }
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
      } catch (err) { setToast(err.message); throw err }
    }
    setEditingUser(null)
    setModal('')
  }
  const toggleUser = async account => {
    const active = account.isActive === false
    if (!user || !['DEVELOPER', 'OWNER'].includes(user.role)) return
    const endpoint = user.role === 'OWNER' ? `/api/owner/staff/${account._id}` : `/api/developer/users/${account._id}`
    try { await api(endpoint, { method: 'PATCH', body: JSON.stringify({ isActive: active }) }) } catch (err) { setToast(err.message); return }
    setUsers(previous => previous.map(entry => entry._id === account._id ? { ...entry, isActive: active } : entry))
    setToast(active ? 'Account reactivated' : 'Account deactivated')
  }

  if (sessionLoading) return <main className="flex min-h-screen items-center justify-center bg-[#eeeeed] px-4"><p role="status" className="text-[13px] text-[#85817e]">Checking your session…</p></main>
  if (sessionError) return <main className="flex min-h-screen items-center justify-center bg-[#eeeeed] px-4"><section className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm"><p role="alert" className="text-[13px] text-[#77726e]">Unable to check your saved session: {sessionError}</p><button disabled={sessionLoading} onClick={() => { setSessionError(''); setSessionLoading(true); setSessionCheckAttempt(attempt => attempt + 1) }} className="mt-5 rounded-full bg-[#a93216] px-5 py-2.5 text-[13px] font-medium text-white disabled:cursor-wait disabled:opacity-60">{sessionLoading ? <ActionProgress>Checking session…</ActionProgress> : 'Try again'}</button></section></main>
  if (!user) return <LoginPage onLogin={login} />

  let content
  if (page === 'Food type') content = <CategoriesPage initialView="foodtype" />
  else if (page === 'Expenses') content = <CategoriesPage initialView="expenses" />
  else if (page === 'Make sale' && ['OWNER', 'KITCHEN'].includes(role)) content = <PurchasePage hotelId={user?.hotelId} initialView="make-sale" canManageExpenses={hasPermission(user, 'manage_expenses')} canApprove={hasPermission(user, 'approve_records')} />
  else if (page === 'Sales' && ['OWNER', 'KITCHEN'].includes(role)) content = <PurchasePage hotelId={user?.hotelId} initialView="sales" canManageExpenses={hasPermission(user, 'manage_expenses')} canApprove={hasPermission(user, 'approve_records')} />
  else if (page === 'Purchase expenses' && ['OWNER', 'KITCHEN'].includes(role)) content = <PurchasePage hotelId={user?.hotelId} initialView="expenses" canManageExpenses={hasPermission(user, 'manage_expenses')} canApprove={hasPermission(user, 'approve_records')} />
  else if (page === 'Purchase damages' && ['OWNER', 'KITCHEN'].includes(role)) content = <PurchasePage hotelId={user?.hotelId} initialView="damages" canManageExpenses={hasPermission(user, 'manage_expenses')} canApprove={hasPermission(user, 'approve_records')} />
  else if (page === 'Stock' && ['OWNER', 'KITCHEN'].includes(role)) content = <StockPage user={user} canManage={canManageStock} />
  else if (page === 'Help & support' && role === 'DEVELOPER') content = <SupportPage />
  else if (page === 'Security' && role === 'DEVELOPER') content = <SecurityPage />
  else if (page === 'Reports') content = <Reports analytics={analytics} currency="UGX" onRange={loadReportRange} hotelName={hotelName} reportRange={reportRange} />
  else if (page === 'Accounts' || page === 'Chefs') content = <AccountsPage users={users} role={role} passwordViewable={platformOverview.passwordViewable} passwordLoadingId={passwordLoadingId} onCreate={() => setModal('account')} onToggle={toggleUser} onReset={account => { setResettingUser(account); setModal('reset') }} onEdit={account => { setEditingUser(account); setModal('edit-account') }} onView={account => { setViewingUser(account); setPasswordLoadingId(String(account._id)); setModal('view-password') }} />
  else if (role === 'DEVELOPER') content = <DeveloperDashboard users={users} onNavigate={setPage} overview={platformOverview} />
  else content = <Overview hotelName={hotelName} onNavigate={setPage} analytics={analytics} currency="UGX" onRange={loadReportRange} reportRange={reportRange} />

  return <div className="min-h-screen bg-[#fbf8f6]">
    <Sidebar role={role} page={page} setPage={setPage} user={user} onLogin={() => setModal('login')} onLogout={logout} loggingOut={loggingOut} onChangePassword={() => setModal('change-password')} hotelName={hotelName} items={currentNav} />
    {mobileNav && <div className="fixed inset-0 z-30 bg-[#0f172a]/30 lg:hidden" onMouseDown={e => { if (e.target === e.currentTarget) setMobileNav(false) }}><div className="flex h-full max-h-[100dvh] w-[min(270px,85vw)] flex-col overflow-y-auto bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between px-2 py-2"><Brand /><button onClick={() => setMobileNav(false)} aria-label="Close navigation" className="grid size-9 place-items-center rounded-lg hover:bg-[#f8fafc]"><X size={18} /></button></div><div className="mt-5 rounded-xl border border-[#e7ebf0] p-3"><p className="truncate text-[11px] font-semibold">{hotelName}</p><p className="mt-1 text-[10px] text-[#94a3b8]">{user?.name || 'WAGA BITES'}</p></div><p className="mb-2 mt-6 px-2 text-[10px] font-bold uppercase tracking-[1.3px] text-[#94a3b8]">{role === 'DEVELOPER' ? 'Developer support' : role === 'KITCHEN' ? 'Chef portal' : 'Owner portal'}</p><nav className="space-y-1">{currentNav.map(item => item.children
              ? <div key={item.label}><button onClick={() => toggleMobileGroup(item.label)} className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[12px] font-semibold transition', item.children.some(child => (child.target || child.label) === page) ? 'bg-[#fff4ec] text-[#ea580c]' : 'text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1e293b]')}><item.icon size={17} /><span className="flex-1">{item.label}</span><ChevronDown size={14} className={cx('shrink-0 text-[#94a3b8] transition-transform', openMobileGroups.has(item.label) ? '' : '-rotate-90')} /></button>{openMobileGroups.has(item.label) && <div className="ml-[26px] border-l border-[#e7ebf0] pl-3">{item.children.map(child => <button key={child.label} onClick={() => { setPage(child.target || child.label); setMobileNav(false) }} className={cx('flex w-full items-center rounded-lg px-3 py-2.5 text-left text-[12px]', page === (child.target || child.label) ? 'bg-[#fff4ec] text-[#ea580c]' : 'text-[#64748b]')}>{child.label}</button>)}</div>}</div>
              : <button key={item.label} onClick={() => { setPage(item.label); setMobileNav(false) }} className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[12px]', page === item.label ? 'bg-[#fff4ec] text-[#ea580c]' : 'text-[#64748b]')}><item.icon size={17} />{item.label === 'Overview' ? 'Dashboard' : item.label}</button>)}</nav><div className="mt-auto space-y-1 pt-5">{user ? <button disabled={loggingOut} onClick={async () => { await logout(); setMobileNav(false) }} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-[12px] text-[#64748b] hover:bg-[#f8fafc] disabled:cursor-wait disabled:opacity-60">{loggingOut ? <ActionProgress>Signing out…</ActionProgress> : <><LogOut size={16} />Sign out</>}</button> : <button onClick={() => { setMobileNav(false); setModal('login') }} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-[12px] text-[#64748b] hover:bg-[#f8fafc]"><ShieldCheck size={16} />Sign in</button>}</div></div></div>}
    <div className="min-h-screen min-w-0 lg:pl-[210px]"><div className="flex items-center border-b border-[#eee4df] bg-white px-3 sm:px-4 lg:hidden"><button onClick={() => setMobileNav(true)} className="mr-2 grid size-10 shrink-0 place-items-center text-[#786d67]" aria-label="Open navigation"><Menu size={19} /></button><Brand /></div>    <Header role={role} page={page} onLogin={() => setModal('login')} user={user} hotelName={hotelName} titleOverride={page === 'Purchase expenses' ? 'Expenses' : page === 'Purchase damages' ? 'Damage' : undefined} onNavigate={setPage} live={live} theme={theme} onToggleTheme={flipTheme} />
    <main className="mx-auto min-w-0 max-w-[1200px] px-3 py-3 sm:px-5 sm:py-4 lg:px-6 lg:py-5">{apiError && user && <div className="mb-4 flex items-center justify-between rounded-lg bg-[#fff7e8] px-3 py-2.5 text-[10px] text-[#a85f18]"><span className="min-w-0 break-words">{apiError}</span><button onClick={() => setApiError('')} className="ml-2 shrink-0"><X size={14} /></button></div>}{content}</main></div>
    {modal === 'account' && ['OWNER', 'DEVELOPER'].includes(role) && <AccountModal viewerRole={role} businessConfigured={Boolean(platformOverview.business)} onClose={() => setModal('')} onSubmit={createAccount} />}
    {modal === 'reset' && resettingUser && <ResetPasswordModal account={resettingUser} onClose={() => { setModal(''); setResettingUser(null) }} onSubmit={resetUserPassword} />}
    {modal === 'view-password' && viewingUser && <ViewPasswordModal account={viewingUser} endpoint={role === 'DEVELOPER' ? `/api/developer/users/${viewingUser._id}/password` : `/api/owner/staff/${viewingUser._id}/password`} onLoaded={() => setPasswordLoadingId('')} onClose={() => { setModal(''); setViewingUser(null); setPasswordLoadingId('') }} />}
    {modal === 'edit-account' && editingUser && <AccountEditModal account={editingUser} viewerRole={role} onClose={() => { setModal(''); setEditingUser(null) }} onSubmit={updateAccount} />}
    {modal === 'change-password' && <ChangePasswordModal onClose={() => setModal('')} onSubmit={changeOwnPassword} />}
    {toast && <div className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-3 right-3 z-[60] flex items-center justify-center gap-2 rounded-xl bg-[#0f172a] px-4 py-3 text-center text-[11px] font-medium text-white shadow-lg sm:bottom-5 sm:left-auto sm:right-5"><Check className="shrink-0 text-[#fdba74]" size={15} />{toast}</div>}
    {notificationToast && <div className="fixed right-3 top-16 z-[60] flex max-w-[330px] items-start gap-2.5 rounded-xl border border-[#f6c9ba] bg-white px-3.5 py-3 shadow-[0_12px_40px_rgba(53,42,36,.18)] sm:right-5"><span className="pulse-dot mt-0.5 size-2 shrink-0 rounded-full bg-[#e7654b]" /><span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-[#292421]">{notificationToast.title}</span><span className="mt-0.5 block truncate text-[9px] text-[#8d817b]">{notificationToast.body}</span></span><button onClick={() => setNotificationToast(null)} aria-label="Dismiss notification toast" className="shrink-0 text-[#c9bcb5] hover:text-[#d95c43]"><X size={13} /></button></div>}
  </div>
}

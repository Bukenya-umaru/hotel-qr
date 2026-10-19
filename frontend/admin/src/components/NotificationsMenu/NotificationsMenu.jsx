import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bell, ShoppingBag, Receipt, CircleCheck, Package, RefreshCw, X,
} from 'lucide-react'
import { api } from '../../lib/api.js'
import { cx } from '../../lib/ui.js'
import { ActionProgress } from '../ActionProgress/ActionProgress.jsx'

const ICONS = {
  new_sale: { icon: ShoppingBag, bg: 'bg-[#fff0ea]', color: 'text-[#e7654b]' },
  new_expense: { icon: Receipt, bg: 'bg-[#fdf1cf]', color: 'text-[#c4901c]' },
  sale_approved: { icon: CircleCheck, bg: 'bg-[#eaf7ef]', color: 'text-[#55a978]' },
  expense_approved: { icon: CircleCheck, bg: 'bg-[#eaf7ef]', color: 'text-[#55a978]' },
  stock_confirmed: { icon: Package, bg: 'bg-[#eef4fd]', color: 'text-[#4a7ded]' },
  stock_pending: { icon: Package, bg: 'bg-[#f3effd]', color: 'text-[#8465d6]' },
  stock_updated: { icon: Package, bg: 'bg-[#fff4ec]', color: 'text-[#ea580c]' },
  low_stock: { icon: Package, bg: 'bg-[#fdeaea]', color: 'text-[#d9534b]' },
}
const DEFAULT_ICON = { icon: Bell, bg: 'bg-[#fbf5f2]', color: 'text-[#8d817b]' }

const ageOf = value => {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function NotificationsMenu({ hotelId, live }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState('')
  const [freshIds, setFreshIds] = useState(() => new Set())
  const panelRef = useRef(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api('/api/notifications')
      setItems(data.notifications || [])
      setUnread(data.unread || 0)
    } catch { /* the bell keeps its last list if a refresh fails */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Live push: the backend emits 'notification' to the hotel room. socket.io
  // sockets use .on/.off (not DOM addEventListener). Re-fetch keeps read-state
  // honest across devices; the flash marks the new rows.
  useEffect(() => {
    if (!live?.on) return undefined
    const onNotification = payload => {
      setFreshIds(previous => {
        const next = new Set(previous)
        if (payload?._id) next.add(String(payload._id))
        return next
      })
      load()
    }
    live.on('notification', onNotification)
    return () => live.off('notification', onNotification)
  }, [live, load])

  useEffect(() => {
    if (!open) return undefined
    const close = event => { if (!panelRef.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const markOne = async id => {
    setBusy(id)
    try {
      const data = await api(`/api/notifications/${id}/read`, { method: 'PATCH' })
      setItems(previous => previous.filter(item => String(item._id) !== String(id)))
      setUnread(data.unread || 0)
    } catch { /* keep the row; user can retry */ } finally {
      setBusy('')
    }
  }
  const markAll = async () => {
    setBusy('all')
    // Optimistic update: clear the list immediately for a snappier feel
    const previousItems = items
    const previousUnread = unread
    setItems([])
    setUnread(0)
    setFreshIds(new Set())

    try {
      await api('/api/notifications/read-all', { method: 'PATCH' })
    } catch {
      // If the request fails, restore the previous state and refresh to be sure
      setItems(previousItems)
      setUnread(previousUnread)
      load()
    } finally {
      setBusy('')
    }
  }

  return <div ref={panelRef} className="relative">
    <button onClick={() => setOpen(previous => !previous)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} className="relative grid size-9 shrink-0 place-items-center rounded-[8px] border border-[#eee4df] bg-white text-[#786d67] transition hover:bg-[#fff7f4]">
      <Bell size={16} />
      {unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-[16px] place-items-center rounded-full bg-[#e7654b] px-1 text-[8px] font-bold leading-[14px] text-white">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <div className="absolute right-0 top-11 z-50 w-[320px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-[#f0e8e4] bg-white shadow-[0_12px_40px_rgba(53,42,36,.14)]">
      <div className="flex items-center justify-between border-b border-[#f1eae6] px-4 py-3">
        <div><p className="text-[12px] font-bold text-[#292421]">Notifications</p><p className="mt-0.5 text-[9px] text-[#938780]">{unread ? `${unread} unread` : 'You are all caught up'}</p></div>
        <div className="flex items-center gap-1">
          <button onClick={load} disabled={loading} aria-label={loading ? 'Refreshing notifications' : 'Refresh notifications'} title={loading ? 'Refreshing notifications…' : 'Refresh notifications'} className="grid size-7 place-items-center rounded-md text-[#8d817b] transition hover:bg-[#fbf5f2] hover:text-[#d95c43] disabled:cursor-wait disabled:opacity-50">{loading ? <ActionProgress><span className="sr-only">Refreshing notifications…</span></ActionProgress> : <RefreshCw size={13} />}</button>
          {unread > 0 && <button onClick={markAll} disabled={busy === 'all'} className="rounded-md px-2 py-1 text-[9px] font-semibold text-[#d95c43] transition hover:bg-[#fff7f4] disabled:opacity-50">{busy === 'all' ? <ActionProgress>Marking read…</ActionProgress> : 'Mark all read'}</button>}
        </div>
      </div>
      <div className="max-h-[340px] space-y-1 overflow-y-auto p-2">
        {items.length === 0 && <p className="py-10 text-center text-[10px] text-[#a19690]">Sales, expenses, approvals and stock alerts will appear here as they happen.</p>}
        {items.map(item => {
          const meta = ICONS[item.type] || DEFAULT_ICON
          const Icon = meta.icon
          const fresh = freshIds.has(String(item._id))
          return <div key={item._id} className={cx('group flex items-start gap-2.5 rounded-lg border p-2.5 transition', fresh ? 'border-[#f6c9ba] bg-[#fff8f5]' : 'border-transparent hover:bg-[#fbf8f6]')}>
            <span className={cx('mt-0.5 grid size-7 shrink-0 place-items-center rounded-full', meta.bg, meta.color)}><Icon size={14} /></span>
            <div className="min-w-0 flex-1"><p className="text-[11px] font-semibold leading-4 text-[#292421]">{item.title}</p>{item.body && <p className="mt-0.5 truncate text-[9px] text-[#8d817b]">{item.body}</p>}<p className="mt-1 text-[8px] text-[#a19690]">{ageOf(item.createdAt)}</p></div>
            <button onClick={() => markOne(item._id)} disabled={busy === String(item._id)} aria-label={busy === String(item._id) ? 'Marking notification as read' : 'Dismiss notification'} className={cx('grid size-5 shrink-0 place-items-center rounded-full text-[#c9bcb5] transition hover:bg-[#fdece5] hover:text-[#d95c43]', busy === String(item._id) && 'opacity-40')}>{busy === String(item._id) ? <ActionProgress><span className="sr-only">Marking notification as read…</span></ActionProgress> : <X size={11} />}</button>
          </div>
        })}
      </div>
      <div className="border-t border-[#f1eae6] bg-[#fbf8f6] px-4 py-2 text-center text-[8px] text-[#a19690]">Live · updates arrive instantly while the dashboard is open</div>
    </div>}
  </div>
}

import { useEffect, useRef, useState } from 'react'
import { Bell, Check, CheckCheck, Clock3, Users, Utensils, X } from 'lucide-react'
import { cx, orderCode, orderTime } from '../../lib/ui.js'

const ICONS = {
  new_order: { icon: Utensils, tone: 'bg-[#fff1e6] text-[#c65d1b]' },
  order_updated: { icon: Check, tone: 'bg-[#eaf0f6] text-[#54799c]' },
  tables_updated: { icon: Users, tone: 'bg-[#fbf1df] text-[#ac7a24]' },
}

const MESSAGES = {
  new_order: 'New order received',
  order_updated: 'Order status changed',
  tables_updated: 'Table seating changed',
}

// Describes a single notification from the payload emitted by the backend.
const describe = notification => {
  const order = notification.order
  if (notification.type === 'new_order' && order) {
    return `#${orderCode(order)} · Table ${order.tableNumber} · ${money0(order.totalAmount ?? order.total)}`
  }
  if (notification.type === 'order_updated' && order) {
    return `#${orderCode(order)} is now ${order.status}`
  }
  if (notification.type === 'tables_updated') {
    return notification.table ? `Table ${notification.table.tableNumber}: ${notification.table.occupiedSeats}/${notification.table.capacity} seats` : 'Seating was updated'
  }
  return ''
}

const money0 = value => `UGX ${Number(value || 0).toLocaleString('en-UG', { maximumFractionDigits: 0 })}`

export function NotificationsMenu({ notifications, unreadCount, onOpen, onMarkAllRead, onClear }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  // Close the dropdown when clicking outside of it or pressing Escape.
  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = event => {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = event => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return <div ref={containerRef} className="relative">
    <button onClick={() => setOpen(previous => !previous)} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={open}
      className={cx('relative grid size-9 place-items-center rounded-xl border bg-white transition',
        open ? 'border-[#dca875] bg-[#fff6ef] text-[#a34b16]' : 'border-[#e7e9e3] text-[#767e71] hover:bg-[#f8f9f6]',
        unreadCount && 'border-[#f0cfae] text-[#b5571d]')}>
      <Bell size={16} />
      {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid min-w-[16px] place-items-center rounded-full bg-[#c65d1b] px-1 text-[8px] font-bold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </button>
    {open && <div className="absolute right-0 top-11 z-40 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-[#eceee8] bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-[#f0f1ed] px-4 py-3">
        <div><p className="text-[12px] font-bold">Notifications</p><p className="mt-0.5 text-[9px] text-[#9b9f96]">{unreadCount ? `${unreadCount} unread` : 'All caught up'}</p></div>
        <div className="flex items-center gap-1">
          {notifications.length > 0 && <>
            <button onClick={onMarkAllRead} title="Mark all as read" className="grid size-7 place-items-center rounded-lg text-[#72786d] hover:bg-[#f5f6f2]"><CheckCheck size={14} /></button>
            <button onClick={onClear} title="Clear all" className="grid size-7 place-items-center rounded-lg text-[#72786d] hover:bg-[#f5f6f2]"><X size={14} /></button>
          </>}
          <button onClick={() => setOpen(false)} aria-label="Close notifications" className="grid size-7 place-items-center rounded-lg text-[#72786d] hover:bg-[#f5f6f2]"><X size={14} /></button>
        </div>
      </div>
      <div className="max-h-[min(60vh,420px)] overflow-y-auto">
        {notifications.length === 0 ? <div className="px-4 py-10 text-center"><Bell className="mx-auto text-[#c8ccc2]" size={22} /><p className="mt-2.5 text-[11px] font-semibold text-[#555e51]">No notifications yet</p><p className="mt-1 text-[9px] text-[#9b9f96]">New orders and table updates appear here live.</p></div> :
          notifications.map(notification => {
            const { icon: Icon, tone } = ICONS[notification.type] || ICONS.tables_updated
            return <button key={notification.id} onClick={() => { onOpen?.(notification); setOpen(false) }}
              className={cx('flex w-full items-start gap-2.5 border-b border-[#f4f4f1] px-4 py-3 text-left last:border-0 hover:bg-[#fafbf8]', !notification.read && 'bg-[#fff9f2]')}>
              <span className={cx('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg', tone)}><Icon size={14} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <b className="truncate text-[11px] font-bold text-[#293128]">{MESSAGES[notification.type] || 'Update'}</b>
                  {!notification.read && <i className="size-1.5 shrink-0 rounded-full bg-[#c65d1b]" />}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-[#858b81]">{describe(notification)}</span>
                <span className="mt-0.5 flex items-center gap-1 text-[9px] text-[#a6aa9f]"><Clock3 size={9} />{orderTime({ createdAt: notification.at })}</span>
              </span>
            </button>
          })}
      </div>
    </div>}
  </div>
}

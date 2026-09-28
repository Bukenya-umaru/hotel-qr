import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { io } from 'socket.io-client'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, CalendarDays, Check, ChefHat, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, Clock3, Coffee, Command, CreditCard, Download,
  Eye, EyeOff, Filter, Globe2, Hotel, LayoutDashboard, Leaf, LogOut, Menu, MoreHorizontal,
  Package, Plus, Printer, QrCode, Search, Settings2, ShieldCheck, ShoppingBag, SlidersHorizontal,
  Sparkles, TrendingUp, Users, Utensils, Wallet, X,
} from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts'
import { api } from '../../lib/api.js'
import { money, today, cx, orderCode, orderTime, navItems } from '../../lib/ui.js'

export function KitchenBoard({ orders, onAdvance, chefName = '', canViewSales = true }) {
  const groups = ['Pending', 'Preparing', 'Ready']
  const [printOrder, setPrintOrder] = useState(null)
  const [selectedDay, setSelectedDay] = useState(() => {
    const date = new Date()
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  })
  const [daySales, setDaySales] = useState({ totalRevenue: 0, totalOrdersCount: 0, netProfit: 0 })
  const [salesLoading, setSalesLoading] = useState(false)
  const [salesError, setSalesError] = useState('')
  const [now, setNow] = useState(new Date())
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // Keep the greeting and date in step with the clock
  // (morning → afternoon → evening).
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  const todayISO = () => {
    const date = new Date()
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  const loadDaySales = async day => {
    setSalesLoading(true)
    try {
      const data = await api(`/api/owner/analytics/reports?from=${day}&to=${day}`)
      setDaySales({
        totalRevenue: data.totalRevenue,
        totalOrdersCount: data.totalOrdersCount,
        netProfit: data.netProfit,
      })
      setSalesError('')
    } catch (err) {
      setSalesError(err.message)
    } finally {
      setSalesLoading(false)
    }
  }

  useEffect(() => { if (canViewSales) loadDaySales(selectedDay) }, [selectedDay, canViewSales])
  // Live refresh: once a ticket is served the day's totals climb again.
  useEffect(() => {
    if (canViewSales && selectedDay === todayISO()) loadDaySales(selectedDay)
  }, [orders, canViewSales])

  // Render the selected ticket into the print-only area, then open the
  // browser's print dialog; the ticket disappears again once printing ends.
  useEffect(() => {
    if (!printOrder) return undefined
    const finish = () => setPrintOrder(null)
    window.addEventListener('afterprint', finish)
    const timer = window.setTimeout(() => window.print(), 60)
    return () => {
      window.removeEventListener('afterprint', finish)
      window.clearTimeout(timer)
    }
  }, [printOrder])

  return <div className="space-y-5">
    <section className="rounded-2xl border border-[#eceee8] bg-white p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0"><div className="flex items-baseline gap-x-2"><h1 className="font-display text-[16px] font-bold tracking-[-.6px] text-[#293128] sm:text-[20px]">{greeting}{chefName ? `, ${chefName}` : ''}</h1><span className="hidden shrink-0 text-[10px] text-[#8d9389] min-[480px]:inline">{now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</span></div><p className="mt-0.5 text-[10px] text-[#8d9389] min-[480px]:text-[11px]">{orders.length} {orders.length === 1 ? 'ticket' : 'tickets'} across the kitchen, updated live.</p></div>
      {canViewSales && <div className="flex shrink-0 flex-wrap items-center gap-1.5 min-[480px]:gap-2">
        <button onClick={() => setSelectedDay(todayISO())} className="whitespace-nowrap rounded-lg border border-[#eceee8] px-2 py-1.5 text-[9px] font-semibold text-[#737a70] hover:bg-[#f7f8f5] min-[480px]:px-2.5 min-[480px]:text-[10px]">Today</button>
        <label className="flex items-center gap-1.5 rounded-lg border border-[#e6e9e1] bg-[#fbfcf9] px-2 py-1.5"><CalendarDays size={13} className="shrink-0 text-[#bd6424]" /><input type="date" value={selectedDay} max={todayISO()} onChange={event => setSelectedDay(event.target.value)} className="bg-transparent text-[9px] font-medium text-[#293128] outline-none min-[480px]:text-[10px]" /></label>
      </div>}
    </div>
    {canViewSales && <>
    <div className="mt-3 grid grid-cols-3 gap-2 min-[480px]:gap-3">
      <div className="min-w-0 rounded-xl bg-[#f7f8f5] px-2 py-2 min-[480px]:px-3 min-[480px]:py-2.5"><p className="text-[8px] font-semibold uppercase tracking-[.8px] text-[#9ba194] min-[480px]:text-[9px]">Revenue</p><p className="mt-0.5 truncate text-[11px] font-bold text-[#293128] min-[480px]:text-[14px]">{salesLoading ? '…' : money(daySales.totalRevenue)}</p></div>
      <div className="min-w-0 rounded-xl bg-[#f7f8f5] px-2 py-2 min-[480px]:px-3 min-[480px]:py-2.5"><p className="text-[8px] font-semibold uppercase tracking-[.8px] text-[#9ba194] min-[480px]:text-[9px]">Orders</p><p className="mt-0.5 truncate text-[11px] font-bold text-[#293128] min-[480px]:text-[14px]">{salesLoading ? '…' : daySales.totalOrdersCount}</p></div>
      <div className="min-w-0 rounded-xl bg-[#f7f8f5] px-2 py-2 min-[480px]:px-3 min-[480px]:py-2.5"><p className="text-[8px] font-semibold uppercase tracking-[.8px] text-[#9ba194] min-[480px]:text-[9px]">Avg ticket</p><p className="mt-0.5 truncate text-[11px] font-bold text-[#293128] min-[480px]:text-[14px]">{salesLoading ? '…' : money(daySales.totalOrdersCount ? daySales.totalRevenue / daySales.totalOrdersCount : 0)}</p></div>
    </div>
    {salesError && <p className="mt-2 text-[9px] text-[#a44f3d]">{salesError}</p>}
    </>}
  </section>
    <span className="flex items-center gap-2 text-[10px] text-[#7d8578]"><i className="pulse-dot size-2 rounded-full bg-[#bd6424]" />Connected · orders play a chime</span>
    <div className="grid grid-cols-3 gap-2 min-[480px]:gap-3 sm:gap-4">{groups.map(status => {
      const list = orders.filter(order => order.status === status)
      return <section key={status} className="min-w-0 rounded-2xl border border-[#eceee8] bg-[#f1f2ee] p-2 min-[480px]:p-3 sm:p-3.5"><div className="mb-2 flex items-center justify-between min-[480px]:mb-3"><div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 min-[480px]:gap-2"><span className={cx('size-2 rounded-full', status === 'Pending' ? 'bg-[#d5a345]' : status === 'Preparing' ? 'bg-[#7192b0]' : 'bg-[#bd641f]')} /><h2 className="whitespace-nowrap text-[10px] font-bold min-[480px]:text-[12px]">{status}</h2><span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[9px] text-[#83897e]">{list.length}</span></div><MoreHorizontal size={16} className="hidden shrink-0 text-[#a1a59c] min-[480px]:block" /></div>
        <div className="space-y-2 min-[480px]:space-y-3">{list.map(order => <article key={order._id || order.id} className="@container flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#e9ebe5] bg-white p-2 shadow-[0_2px_6px_rgba(38,48,33,.025)] min-[480px]:p-3 sm:p-3.5"><div className="flex shrink-0 items-start justify-between gap-1"><div className="min-w-0"><p className="truncate text-[10px] font-bold min-[480px]:text-[11px]">#{orderCode(order)}</p><p className="mt-0.5 break-words text-[8px] leading-[13px] text-[#989e93] min-[480px]:mt-1 min-[480px]:text-[9px]">{order.customerName ? `${order.customerName} · ` : ''}Table {order.tableNumber || order.table} · {order.guestCount || 1} {(order.guestCount || 1) === 1 ? 'guest' : 'guests'} · {orderTime(order)}</p></div><button onClick={() => setPrintOrder(order)} aria-label={`Print ticket ${orderCode(order)}`} title="Print this ticket" className="text-[#a2a69d] hover:text-[#555e51]"><Printer size={13} /></button></div><div className="my-2 space-y-1.5 border-y border-dashed border-[#ebede7] py-2 min-[480px]:my-3 min-[480px]:space-y-2 min-[480px]:py-3">{(order.items || []).map((item, index) => {
          const amount = item.quantity || item.qty || 1
          return <div key={index} className="flex min-w-0 justify-between gap-1.5 text-[9px] min-[480px]:gap-2 min-[480px]:text-[10px]"><span className="min-w-0 break-words text-[#555e51]">{item.name}<b className="ml-1 whitespace-nowrap text-[8px] text-[#bd6424] min-[480px]:ml-1.5 min-[480px]:text-[9px]">×{amount}</b></span>{typeof item.price === 'number' && <b className="shrink-0 whitespace-nowrap text-[#737a6e]">{money(item.price * amount)}</b>}</div>
        })}{order.notes && <p className="break-words rounded-lg bg-[#fbf5e8] px-1.5 py-1 text-[8px] text-[#92764a] min-[480px]:px-2 min-[480px]:py-1.5 min-[480px]:text-[9px]">Note: {order.notes}</p>}</div><div className="flex shrink-0 flex-col gap-1 min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:items-center min-[480px]:justify-between min-[480px]:gap-2"><span className="min-w-0 break-words text-[8px] font-semibold leading-[13px] min-[480px]:text-[10px] min-[480px]:leading-normal">{(order.items || []).reduce((total, item) => total + (item.quantity || item.qty || 1), 0)} items · {money(order.totalAmount ?? order.total)}</span><button onClick={() => onAdvance(order)} className="w-fit max-w-full shrink-0 self-center whitespace-nowrap [text-size-adjust:none] [-webkit-text-size-adjust:none] text-[7px] font-semibold leading-[12px] text-white rounded-md bg-[#c65d1b] px-1.5 py-1 hover:bg-[#a34b16] min-[480px]:self-auto min-[480px]:rounded-lg min-[480px]:px-3 min-[480px]:py-1.5 min-[480px]:text-[9px] min-[480px]:leading-normal"><span className="min-[480px]:hidden">{status === 'Pending' ? 'Start' : status === 'Preparing' ? 'Ready' : 'Serve'}</span><span className="hidden min-[480px]:inline">{status === 'Pending' ? 'Start order' : status === 'Preparing' ? 'Mark ready' : 'Mark served'}</span> <ArrowRight size={11} className="ml-1 hidden min-[480px]:inline" /></button></div></article>)}
        {!list.length && <div className="rounded-xl border border-dashed border-[#dfe3d9] px-2 py-6 text-center text-[9px] text-[#a0a59a] min-[480px]:px-3 min-[480px]:py-8 min-[480px]:text-[10px]">Nothing in this queue</div>}</div>
      </section>
    })}</div>
    {printOrder && createPortal(<div id="print-area"><PrintableTicket order={printOrder} hotelName={hotelName} /></div>, document.body)
    }</div>
}

function PrintableTicket({ order, hotelName }) {
  const items = order.items || []
  const count = items.reduce((total, item) => total + (item.quantity || item.qty || 1), 0)
  return <div className="print-ticket">
    <p className="print-hotel">{hotelName || 'Your business'}</p>
    <p className="print-ticket-brand">Kitchen ticket</p>
    <h1>#{orderCode(order)} · Table {order.tableNumber || order.table}</h1>
    {order.customerName && <p className="print-guest">Guest: {order.customerName}</p>}
    <p className="print-ticket-meta">{order.guestCount || 1} {(order.guestCount || 1) === 1 ? 'guest' : 'guests'} · {orderTime(order)} · {order.status}</p>
    <table><tbody>
      {items.map((item, index) => {
        const amount = item.quantity || item.qty || 1
        return <tr key={index}><td className="print-item">{item.name} ×{amount}</td><td className="print-line">{typeof item.price === 'number' ? money(item.price * amount) : ''}</td></tr>
      })}
    </tbody></table>
    {order.notes && <p className="print-note">Note: {order.notes}</p>}
    <p className="print-total">{count} {count === 1 ? 'item' : 'items'} · {money(order.totalAmount ?? order.total)}</p>
  </div>
}

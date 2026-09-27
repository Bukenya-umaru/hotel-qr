import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { io } from 'socket.io-client'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Check, ChefHat, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, Clock3, Coffee, Command, CreditCard, Download,
  Eye, EyeOff, Filter, Globe2, Hotel, LayoutDashboard, Leaf, LogOut, Menu, MoreHorizontal,
  Package, Plus, Printer, QrCode, Search, Settings2, ShieldCheck, ShoppingBag, SlidersHorizontal,
  Sparkles, TrendingUp, Users, Utensils, Wallet, X,
} from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts'
import { api } from '../../lib/api.js'
import { money, today, cx, orderCode, orderTime, navItems } from '../../lib/ui.js'

export function KitchenBoard({ orders, onAdvance }) {
  const groups = ['Pending', 'Preparing', 'Ready']
  const [printOrder, setPrintOrder] = useState(null)

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
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[12px] text-[#8d9389]">Tickets from across the restaurant, updated live.</p><span className="flex items-center gap-2 text-[10px] text-[#7d8578]"><i className="pulse-dot size-2 rounded-full bg-[#bd6424]" />Connected · orders play a chime</span></div>
    <div className="grid gap-4 xl:grid-cols-3">{groups.map(status => {
      const list = orders.filter(order => order.status === status)
      return <section key={status} className="rounded-2xl border border-[#eceee8] bg-[#f1f2ee] p-3.5"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className={cx('size-2 rounded-full', status === 'Pending' ? 'bg-[#d5a345]' : status === 'Preparing' ? 'bg-[#7192b0]' : 'bg-[#bd641f]')} /><h2 className="text-[12px] font-bold">{status}</h2><span className="rounded-md bg-white px-1.5 py-0.5 text-[9px] text-[#83897e]">{list.length}</span></div><MoreHorizontal size={16} className="text-[#a1a59c]" /></div>
        <div className="space-y-3">{list.map(order => <article key={order._id || order.id} className="rounded-xl border border-[#e9ebe5] bg-white p-3.5 shadow-[0_2px_6px_rgba(38,48,33,.025)]"><div className="flex items-start justify-between"><div><p className="text-[11px] font-bold">#{orderCode(order)}</p><p className="mt-1 text-[9px] text-[#989e93]">{order.customerName ? `${order.customerName} · ` : ''}Table {order.tableNumber || order.table} · {order.guestCount || 1} {(order.guestCount || 1) === 1 ? 'guest' : 'guests'} · {orderTime(order)}</p></div><button onClick={() => setPrintOrder(order)} aria-label={`Print ticket ${orderCode(order)}`} title="Print this ticket" className="text-[#a2a69d] hover:text-[#555e51]"><Printer size={15} /></button></div><div className="my-3 space-y-2 border-y border-dashed border-[#ebede7] py-3">{(order.items || []).map((item, index) => {
          const amount = item.quantity || item.qty || 1
          return <div key={index} className="flex min-w-0 justify-between gap-2 text-[10px]"><span className="min-w-0 break-words text-[#555e51]">{item.name}<b className="ml-1.5 whitespace-nowrap text-[9px] text-[#bd6424]">×{amount}</b></span>{typeof item.price === 'number' && <b className="shrink-0 whitespace-nowrap text-[#737a6e]">{money(item.price * amount)}</b>}</div>
        })}</div>{order.notes && <p className="mb-3 break-words rounded-lg bg-[#fbf5e8] px-2 py-1.5 text-[9px] text-[#92764a]">Note: {order.notes}</p>}<div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] font-semibold">{(order.items || []).reduce((total, item) => total + (item.quantity || item.qty || 1), 0)} items · {money(order.totalAmount ?? order.total)}</span><button onClick={() => onAdvance(order)} className="rounded-lg bg-[#c65d1b] px-3 py-1.5 text-[9px] font-semibold text-white hover:bg-[#a34b16]">{status === 'Pending' ? 'Start order' : status === 'Preparing' ? 'Mark ready' : 'Mark served'} <ArrowRight size={11} className="ml-1 inline" /></button></div></article>)}
        {!list.length && <div className="rounded-xl border border-dashed border-[#dfe3d9] px-3 py-8 text-center text-[10px] text-[#a0a59a]">Nothing in this queue</div>}</div>
      </section>
    })}</div>
    {printOrder && createPortal(<div id="print-area"><PrintableTicket order={printOrder} /></div>, document.body)
    }</div>
}

function PrintableTicket({ order }) {
  const items = order.items || []
  const count = items.reduce((total, item) => total + (item.quantity || item.qty || 1), 0)
  return <div className="print-ticket">
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

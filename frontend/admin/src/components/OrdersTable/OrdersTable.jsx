import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Check, ChefHat, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, Clock3, Coffee, Command, CreditCard, Download,
  Eye, EyeOff, Filter, Globe2, Hotel, LayoutDashboard, Leaf, LogOut, Menu, MoreHorizontal,
  Package, Plus, QrCode, Search, Settings2, ShieldCheck, ShoppingBag, SlidersHorizontal,
  Sparkles, TrendingUp, Users, Utensils, Wallet, X,
} from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts'
import { api } from '../../lib/api.js'
import { money, today, cx, orderCode, orderTime, navItems } from '../../lib/ui.js'
import { Badge } from '../Badge/Badge.jsx'
import { StatusBadge } from '../StatusBadge/StatusBadge.jsx'

export function OrdersTable({ orders, compact = false, onViewAll, onAdvance }) {
  const visible = compact ? orders.slice(0, 4) : orders
  return <section className="overflow-hidden rounded-2xl border border-[#e7ebf0] bg-white">
    <div className="flex items-center justify-between border-b border-[#f1f5f9] px-4 py-4 sm:px-5"><div><h2 className="font-display text-[14px] font-bold">{compact ? 'Recent orders' : 'Live order queue'}</h2><p className="mt-1 text-[10px] text-[#94a3b8]">{compact ? 'Your latest guest orders' : 'Orders update in real time'}</p></div>{compact ? <button onClick={onViewAll} className="text-[10px] font-semibold text-[#ea580c] hover:underline">View all <ArrowRight size={11} className="ml-1 inline" /></button> : <Badge><i className="pulse-dot size-1.5 rounded-full bg-[#f97316]" />Live</Badge>}</div>
    <div className="divide-y divide-[#f1f4f9] md:hidden">{visible.length ? visible.map(order => <article key={order._id || order.id} className="p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><p className="text-[11px] font-semibold text-[#1e293b]">#{orderCode(order)} · Table {order.tableNumber || order.table}</p><p className="mt-0.5 truncate text-[9px] text-[#94a3b8]">{order.customerName || order.guest || 'Guest'} · {orderTime(order)}</p></div>
        <div className="flex shrink-0 items-center gap-1.5"><StatusBadge status={order.status} />{onAdvance && !['Served', 'Cancelled'].includes(order.status) && <button onClick={() => onAdvance(order)} title="Advance order status" className="grid size-6 place-items-center rounded-md border border-[#e7ebf0] text-[#64748b] hover:bg-[#fff6ee]"><ArrowRight size={12} /></button>}</div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-dashed border-[#f1f5f9] pt-2"><p className="text-[10px] text-[#94a3b8]">{(order.items || []).length} {(order.items || []).length === 1 ? 'item' : 'items'}</p><b className="text-[11px] font-semibold">{money(order.totalAmount ?? order.total)}</b></div>
    </article>) : <p className="px-4 py-10 text-center text-[11px] text-[#94a3b8]">No orders yet. New guest orders will appear here.</p>}</div>
    <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[610px] text-left"><thead><tr className="border-b border-[#f1f5f9] text-[9px] font-semibold uppercase tracking-[.8px] text-[#94a3b8]"><th className="px-5 py-3">Order</th><th className="px-4 py-3">Guest / table</th><th className="px-4 py-3">Items</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Status</th><th className="px-5 py-3 text-right">Time</th></tr></thead><tbody>{visible.length ? visible.map(order => <tr key={order._id || order.id} className="border-b border-[#f1f4f9] last:border-0 hover:bg-[#f8fafc]"><td className="px-5 py-3.5 text-[11px] font-semibold text-[#1e293b]">#{orderCode(order)}</td><td className="px-4 py-3.5"><p className="text-[11px] font-medium">{order.customerName || order.guest || 'Guest'}</p><p className="mt-0.5 text-[9px] text-[#94a3b8]">Table {order.tableNumber || order.table}</p></td><td className="px-4 py-3.5 text-[10px] text-[#94a3b8]">{(order.items || []).length} items</td><td className="px-4 py-3.5 text-[11px] font-semibold">{money(order.totalAmount ?? order.total)}</td><td className="px-4 py-3.5"><div className="flex items-center gap-2"><StatusBadge status={order.status} />{onAdvance && !['Served', 'Cancelled'].includes(order.status) && <button onClick={() => onAdvance(order)} title="Advance order status" className="grid size-6 place-items-center rounded-md border border-[#e7ebf0] text-[#64748b] hover:bg-[#fff6ee]"><ArrowRight size={12} /></button>}</div></td><td className="px-5 py-3.5 text-right text-[10px] text-[#94a3b8]">{orderTime(order)}</td></tr>) : <tr><td className="px-5 py-10 text-center text-[11px] text-[#94a3b8]" colSpan="6">No orders yet. New guest orders will appear here.</td></tr>}</tbody></table></div>
    {compact && <div className="flex justify-between border-t border-[#f1f5f9] px-5 py-3 text-[10px] text-[#94a3b8]"><span>Showing {visible.length} of {orders.length} orders</span><span className="flex items-center gap-3"><button aria-label="Previous page"><ChevronLeft size={14} /></button><b className="font-medium text-[#64748b]">1</b><button aria-label="Next page"><ChevronRight size={14} /></button></span></div>}
  </section>
}

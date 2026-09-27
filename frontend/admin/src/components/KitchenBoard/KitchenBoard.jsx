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

export function KitchenBoard({ orders, onAdvance }) {
  const groups = ['Pending', 'Preparing', 'Ready']
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[12px] text-[#8d9389]">Tickets from across the restaurant, updated live.</p><span className="flex items-center gap-2 text-[10px] text-[#7d8578]"><i className="pulse-dot size-2 rounded-full bg-[#bd6424]" />Connected · orders play a chime</span></div>
    <div className="grid gap-4 xl:grid-cols-3">{groups.map(status => {
      const list = orders.filter(order => order.status === status)
      return <section key={status} className="rounded-2xl border border-[#eceee8] bg-[#f1f2ee] p-3.5"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className={cx('size-2 rounded-full', status === 'Pending' ? 'bg-[#d5a345]' : status === 'Preparing' ? 'bg-[#7192b0]' : 'bg-[#bd641f]')} /><h2 className="text-[12px] font-bold">{status}</h2><span className="rounded-md bg-white px-1.5 py-0.5 text-[9px] text-[#83897e]">{list.length}</span></div><MoreHorizontal size={16} className="text-[#a1a59c]" /></div>
        <div className="space-y-3">{list.map(order => <article key={order._id || order.id} className="rounded-xl border border-[#e9ebe5] bg-white p-3.5 shadow-[0_2px_6px_rgba(38,48,33,.025)]"><div className="flex items-start justify-between"><div><p className="text-[11px] font-bold">#{orderCode(order)}</p><p className="mt-1 text-[9px] text-[#989e93]">Table {order.tableNumber || order.table} · {order.guestCount || 1} {(order.guestCount || 1) === 1 ? 'guest' : 'guests'} · {orderTime(order)}</p></div><button className="text-[#a2a69d]"><MoreHorizontal size={15} /></button></div><div className="my-3 space-y-2 border-y border-dashed border-[#ebede7] py-3">{(order.items || []).map((item, index) => <div key={index} className="flex min-w-0 justify-between gap-2 text-[10px]"><span className="min-w-0 break-words text-[#555e51]">{item.name}</span><b className="shrink-0 text-[#737a6e]">×{item.quantity || item.qty || 1}</b></div>)}</div>{order.notes && <p className="mb-3 break-words rounded-lg bg-[#fbf5e8] px-2 py-1.5 text-[9px] text-[#92764a]">Note: {order.notes}</p>}<div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] font-semibold">{money(order.totalAmount ?? order.total)}</span><button onClick={() => onAdvance(order)} className="rounded-lg bg-[#c65d1b] px-3 py-1.5 text-[9px] font-semibold text-white hover:bg-[#a34b16]">{status === 'Pending' ? 'Start order' : status === 'Preparing' ? 'Mark ready' : 'Mark served'} <ArrowRight size={11} className="ml-1 inline" /></button></div></article>)}
        {!list.length && <div className="rounded-xl border border-dashed border-[#dfe3d9] px-3 py-8 text-center text-[10px] text-[#a0a59a]">Nothing in this queue</div>}</div>
      </section>
    })}</div>
  </div>
}

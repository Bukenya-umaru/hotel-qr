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
import { MetricCard } from '../MetricCard/MetricCard.jsx'
import { OrdersTable } from '../OrdersTable/OrdersTable.jsx'

export function Reports({ orders, analytics, currency, onRange }) {
  const dateText = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const initialRange = () => {
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - 6)
    return { from: dateText(from), to: dateText(to) }
  }
  const [range, setRange] = useState(initialRange)
  const setPreset = preset => {
    const to = new Date()
    const from = new Date(to)
    if (preset === 'Daily') from.setHours(0, 0, 0, 0)
    if (preset === 'Monthly') from.setDate(1)
    if (preset === 'Yearly') from.setMonth(0, 1)
    const nextRange = { from: dateText(from), to: dateText(to) }
    setRange(nextRange)
    onRange(nextRange.from, nextRange.to)
  }
  const series = analytics.series?.length ? analytics.series.map(day => ({
    day: day.day || new Date(`${day.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
    revenue: day.revenue,
    profit: day.profit,
  })) : []
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[12px] text-[#8d9389]">See how your business is performing over time.</p>
      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        {['Daily', 'Monthly', 'Yearly'].map(preset => <button key={preset} onClick={() => setPreset(preset)} className="rounded-lg border border-[#eceee8] bg-white px-3 py-2 text-[10px] font-semibold text-[#767e71] hover:border-[#d08445]">{preset} sales</button>)}
      </div>
      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-end">
        <label className="min-w-0 text-[9px] font-semibold text-[#858b81]">From<input type="date" value={range.from} max={range.to} onChange={event => setRange({ ...range, from: event.target.value })} className="mt-1 block w-full min-w-0 rounded-lg border border-[#e8eae3] bg-white px-2 py-2 text-[10px] text-[#687061] sm:mt-0 sm:inline-block sm:ml-2 sm:w-auto" /></label>
        <label className="min-w-0 text-[9px] font-semibold text-[#858b81]">To<input type="date" value={range.to} min={range.from} max={dateText(new Date())} onChange={event => setRange({ ...range, to: event.target.value })} className="mt-1 block w-full min-w-0 rounded-lg border border-[#e8eae3] bg-white px-2 py-2 text-[10px] text-[#687061] sm:mt-0 sm:inline-block sm:ml-2 sm:w-auto" /></label>
        <button onClick={() => onRange(range.from, range.to)} className="col-span-2 rounded-lg bg-[#c65d1b] px-3 py-2 text-[10px] font-semibold text-white sm:col-span-1">Apply</button>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2.5 min-[420px]:gap-3 lg:grid-cols-3">
      <MetricCard title="Gross revenue" value={money(analytics.weekRevenue, currency)} change={!analytics.isActual && '12.8%'} icon={CreditCard} detail="Selected period" />
      <MetricCard title="Net profit" value={money(analytics.weekProfit, currency)} change={!analytics.isActual && '9.3%'} icon={TrendingUp} detail={`${analytics.weekRevenue ? (analytics.weekProfit / analytics.weekRevenue * 100).toFixed(1) : '0.0'}% profit margin`} inverse />
      <MetricCard title="Orders completed" value={analytics.weekOrders} change={!analytics.isActual && '6.4%'} icon={Package} detail="Selected period" />
    </div>
    <section className="rounded-2xl border border-[#eceee8] bg-white p-4 sm:p-5">
      <div><h2 className="font-display text-[14px] font-bold">Sales performance</h2><p className="mt-1 text-[10px] text-[#999e94]">Revenue compared to gross profit</p></div>
      <div className="mt-6 h-[220px] sm:h-[290px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={series} barGap={5} margin={{ left: -15, right: 5 }}><CartesianGrid vertical={false} stroke="#eff0ec" strokeDasharray="3 5" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#a0a49b', fontSize: 10 }} dy={8} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#a0a49b', fontSize: 9 }} tickFormatter={value => `UGX ${value / 1000}k`} /><Tooltip contentStyle={{ border: '1px solid #eceee8', borderRadius: 10, fontSize: 11 }} formatter={value => money(value, currency)} /><Bar dataKey="revenue" fill="#ba5b1c" radius={[5, 5, 0, 0]} /><Bar dataKey="profit" fill="#f5ddc8" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
    </section>
    <OrdersTable orders={analytics.reportOrders || orders} compact={false} />
  </div>
}

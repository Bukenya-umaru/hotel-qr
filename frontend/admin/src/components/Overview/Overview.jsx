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


export function Overview({ orders, hotelName, onNavigate, analytics, currency }) {
  const [period, setPeriod] = useState('This week')
  const chartData = analytics.series?.length ? analytics.series.map(day => ({
    day: day.day || new Date(`${day.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
    revenue: day.revenue,
    profit: day.profit,
  })) : []
  const averageOrder = analytics.totalOrdersCount ? analytics.totalRevenue / analytics.totalOrdersCount : 0
  const profitMargin = analytics.totalRevenue ? (analytics.netProfit / analytics.totalRevenue) * 100 : 0
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[12px] text-[#94a3b8]">Here’s what’s happening at {hotelName} today.</p></div><button className="flex items-center gap-2 rounded-lg border border-[#e7ebf0] bg-white px-3 py-2 text-[11px] font-semibold text-[#64748b]"><Download size={14} />Export report</button></div>
    <div className="grid grid-cols-2 gap-2.5 min-[420px]:gap-3 xl:grid-cols-4 xl:gap-4">
      <MetricCard title="Today's revenue" value={money(analytics.totalRevenue, currency)} change={!analytics.isActual && '12.8%'} icon={Wallet} detail={analytics.isActual ? 'From orders placed today' : 'Today’s total sales'} />
      <MetricCard title="Net profit" value={money(analytics.netProfit, currency)} change={!analytics.isActual && '8.2%'} icon={TrendingUp} detail={`${profitMargin.toFixed(1)}% profit margin`} inverse />
      <MetricCard title="Orders today" value={analytics.totalOrdersCount} change={!analytics.isActual && '6.4%'} icon={ShoppingBag} detail={`Average order ${money(averageOrder, currency)}`} />
      <MetricCard title="Avg. preparation" value="14 min" icon={Clock3} detail="2 min faster than last week" />
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
      <section className="rounded-2xl border border-[#e7ebf0] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-[14px] font-bold">Revenue & profit</h2><p className="mt-1 text-[10px] text-[#94a3b8]">A look at your restaurant’s performance</p></div><select value={period} onChange={e => setPeriod(e.target.value)} className="rounded-lg border border-[#e7ebf0] bg-white px-2.5 py-1.5 text-[10px] text-[#64748b] outline-none"><option>This week</option><option>This month</option><option>This year</option></select></div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px]"><span className="flex items-center gap-1.5 text-[#64748b]"><i className="size-2 rounded-sm bg-[#f97316]" />Revenue</span><span className="flex items-center gap-1.5 text-[#64748b]"><i className="size-2 rounded-sm bg-[#fed7aa]" />Profit</span><span className="w-full break-words font-semibold text-[#1e293b] sm:ml-auto sm:w-auto">{money(analytics.weekRevenue ?? 17320, currency)} <span className="ml-1 font-normal text-[#94a3b8]">total revenue</span></span></div>
        <div className="mt-3 h-[190px] w-full sm:h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
              <defs><linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb923c" stopOpacity={0.18} /><stop offset="90%" stopColor="#fb923c" stopOpacity={0} /></linearGradient><linearGradient id="profit" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fed7aa" stopOpacity={0.4} /><stop offset="90%" stopColor="#fed7aa" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="3 5" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} dy={8} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={v => `$${v / 1000}k`} /><Tooltip contentStyle={{ border: '1px solid #e7ebf0', borderRadius: 10, fontSize: 11, boxShadow: '0 4px 16px #0f172a10' }} formatter={value => money(value)} /><Area type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2.5} fill="url(#revenue)" /><Area type="monotone" dataKey="profit" stroke="#fed7aa" strokeWidth={2} fill="url(#profit)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="rounded-2xl border border-[#e7ebf0] bg-white p-4 sm:p-5">
        <div><h2 className="font-display text-[14px] font-bold">Popular dishes</h2><p className="mt-1 text-[10px] text-[#94a3b8]">Top sellers this week</p></div>
        <p className="mt-4 flex h-[120px] items-center justify-center rounded-xl border border-dashed border-[#dbe1ea] text-center text-[10px] text-[#94a3b8] sm:h-[150px]">Dish reports are coming soon.</p>
      </section>
    </div>
    <OrdersTable orders={orders.slice(0, 4)} compact onViewAll={() => onNavigate('Orders')} />
  </div>
}

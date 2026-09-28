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

export function Overview({ orders, menu, hotelName, onNavigate, analytics, currency }) {
  const [period, setPeriod] = useState('This week')
  const chartData = analytics.series?.length ? analytics.series.map(day => ({
    day: day.day || new Date(`${day.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
    revenue: day.revenue,
    profit: day.profit,
  })) : []
  const averageOrder = analytics.totalOrdersCount ? analytics.totalRevenue / analytics.totalOrdersCount : 0
  const profitMargin = analytics.totalRevenue ? (analytics.netProfit / analytics.totalRevenue) * 100 : 0
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[12px] text-[#8d9389]">Here’s what’s happening at {hotelName} today.</p></div><button className="flex items-center gap-2 rounded-lg border border-[#e8eae3] bg-white px-3 py-2 text-[11px] font-semibold text-[#60685c]"><Download size={14} />Export report</button></div>
    <div className="grid grid-cols-2 gap-2.5 min-[420px]:gap-3 xl:grid-cols-4 xl:gap-4">
      <MetricCard title="Today's revenue" value={money(analytics.totalRevenue, currency)} change={!analytics.isActual && '12.8%'} icon={Wallet} detail={analytics.isActual ? 'From orders placed today' : 'Today’s total sales'} />
      <MetricCard title="Net profit" value={money(analytics.netProfit, currency)} change={!analytics.isActual && '8.2%'} icon={TrendingUp} detail={`${profitMargin.toFixed(1)}% profit margin`} inverse />
      <MetricCard title="Orders today" value={analytics.totalOrdersCount} change={!analytics.isActual && '6.4%'} icon={ShoppingBag} detail={`Average order ${money(averageOrder, currency)}`} />
      <MetricCard title="Avg. preparation" value="14 min" icon={Clock3} detail="2 min faster than last week" />
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
      <section className="rounded-2xl border border-[#eceee8] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-[14px] font-bold">Revenue & profit</h2><p className="mt-1 text-[10px] text-[#999e94]">A look at your restaurant’s performance</p></div><select value={period} onChange={e => setPeriod(e.target.value)} className="rounded-lg border border-[#eceee8] bg-white px-2.5 py-1.5 text-[10px] text-[#656d60] outline-none"><option>This week</option><option>This month</option><option>This year</option></select></div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px]"><span className="flex items-center gap-1.5 text-[#6c7467]"><i className="size-2 rounded-sm bg-[#bb5a1d]" />Revenue</span><span className="flex items-center gap-1.5 text-[#6c7467]"><i className="size-2 rounded-sm bg-[#f5ddc8]" />Profit</span><span className="w-full break-words font-semibold text-[#414a3e] sm:ml-auto sm:w-auto">{money(analytics.weekRevenue ?? 17320, currency)} <span className="ml-1 font-normal text-[#a0a49b]">total revenue</span></span></div>
        <div className="mt-3 h-[190px] w-full sm:h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
              <defs><linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d77c35" stopOpacity={0.18} /><stop offset="90%" stopColor="#d77c35" stopOpacity={0} /></linearGradient><linearGradient id="profit" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f5ddc8" stopOpacity={0.4} /><stop offset="90%" stopColor="#f5ddc8" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="#eff0ec" strokeDasharray="3 5" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#a0a49b', fontSize: 10 }} dy={8} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#a0a49b', fontSize: 9 }} tickFormatter={v => `$${v / 1000}k`} /><Tooltip contentStyle={{ border: '1px solid #eceee8', borderRadius: 10, fontSize: 11, boxShadow: '0 4px 16px #24301c10' }} formatter={value => money(value)} /><Area type="monotone" dataKey="revenue" stroke="#bb5a1d" strokeWidth={2.5} fill="url(#revenue)" /><Area type="monotone" dataKey="profit" stroke="#e9bc97" strokeWidth={2} fill="url(#profit)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="rounded-2xl border border-[#eceee8] bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between"><div><h2 className="font-display text-[14px] font-bold">Popular dishes</h2><p className="mt-1 text-[10px] text-[#999e94]">Top sellers this week</p></div><button onClick={() => onNavigate('Menu')} className="text-[10px] font-semibold text-[#b5571d] hover:underline">Full menu <ArrowRight size={11} className="ml-1 inline" /></button></div>
        <div className="mt-4 space-y-[17px]">{menu.slice(0, 4).map((item, i) => <div className="flex items-center gap-3" key={item.id}><div className={cx('grid size-10 shrink-0 place-items-center rounded-xl text-[19px]', item.color || 'bg-[#f0efe9]')}>{item.emoji || '🍽️'}</div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-[#41483e]">{item.name}</p><p className="mt-0.5 text-[10px] text-[#a0a49b]">{[42, 36, 28, 22][i]} orders</p></div><div className="text-right"><p className="text-[11px] font-semibold">{money([777, 648, 336, 187][i])}</p><p className="mt-0.5 text-[9px] text-[#9da297]">revenue</p></div></div>)}</div>
      </section>
    </div>
    <OrdersTable orders={orders.slice(0, 4)} compact onViewAll={() => onNavigate('Orders')} />
  </div>
}

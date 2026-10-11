import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight, CalendarDays, ChartNoAxesCombined, ChevronDown, MoreHorizontal, Receipt,
  ShoppingBag, SlidersHorizontal, TrendingUp, Wallet, UsersRound, Download,
} from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { money } from '../../lib/ui.js'
import { MetricCard } from '../MetricCard/MetricCard.jsx'

const formatDay = value => new Date(`${value}T12:00:00`).toLocaleDateString('en-UG', { weekday: 'short' })
const businessDay = value => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(value))
const isToday = value => businessDay(value) === businessDay(new Date())
const formatTime = value => new Date(value).toLocaleTimeString('en-UG', { hour: 'numeric', minute: '2-digit' })

// Heptagon gauge: axes from the centre to each of the 7 corners, a full
// heptagon in pale peach, and the covered fraction filled in orange.
const SIDES = 7
const point = (angle, radius) => `${100 + radius * Math.cos(angle - Math.PI / 2)},${70 + radius * Math.sin(angle - Math.PI / 2)}`
const polygon = radius => Array.from({ length: SIDES }, (_, index) => point(index * 2 * Math.PI / SIDES, radius)).join(' ')

// Dashboard periods, matching the image's date dropdown + Filter pair.
// 'today' narrows to the current business day; the others widen the window.
const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: '7', label: 'Last 7 days' },
  { key: 'month', label: 'This month' },
  { key: '30', label: 'Last 30 days' },
]
const periodDates = key => {
  const end = new Date()
  const start = new Date()
  if (key === 'today') { /* start === end */ }
  else if (key === '7') start.setDate(start.getDate() - 6)
  else if (key === '30') start.setDate(start.getDate() - 29)
  else if (key === 'month') start.setDate(1)
  const day = value => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(value)
  return { from: day(start), to: day(end) }
}

export function Overview({ hotelName, onNavigate, analytics, currency, onRange }) {
  const sales = analytics.sales || []
  const expenses = analytics.expenses || []
  const canViewSales = analytics.canViewSales !== false
  const canViewExpenses = analytics.canViewExpenses !== false
  const todaySales = sales.filter(sale => isToday(sale.createdAt))
  const todayExpenses = expenses.filter(expense => isToday(expense.createdAt))
  const salesToday = todaySales.reduce((sum, sale) => sum + Number(sale.amount || 0), 0)
  const expensesToday = todayExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  const balanceToday = canViewSales && canViewExpenses ? salesToday - expensesToday : null
  const salesThisWeek = Number(analytics.totalSalesCount || 0)
  const series = (analytics.series || []).map(day => ({
    day: formatDay(day.date),
    sales: day.revenue || 0,
    expenses: day.expenses || 0,
  }))
  const recentSales = sales.slice(0, 3)
  const recentExpenses = expenses.slice(0, 3)
  // Share of each recorded sales day that covered its expenses. The demo
  // image's heptagon is mostly filled, so real data maps naturally here.
  const positiveDays = (analytics.series || []).filter(day => (day.revenue || 0) >= (day.expenses || 0)).length
  const coverage = (analytics.series || []).length
    ? Math.max(0, Math.min(1, positiveDays / (analytics.series || []).length))
    : 0.7
  const reportDate = new Intl.DateTimeFormat('en-UG', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())

  // Date filter state, shared by the date button and the Filter chip (both
  // open the same option menu, as in the reference). The first render keeps
  // the range the dashboard already loaded; later changes re-fetch.
  const [periodKey, setPeriodKey] = useState('7')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const onRangeRef = useRef(onRange)
  onRangeRef.current = onRange
  const firstRender = useRef(true)
  useEffect(() => {
    // Skip the initial mount: App already loaded this week's range.
    if (firstRender.current) { firstRender.current = false; return }
    const { from, to } = periodDates(periodKey)
    onRangeRef.current?.(from, to)
  }, [periodKey])
  useEffect(() => {
    if (!menuOpen) return undefined
    const close = event => { if (!menuRef.current?.contains(event.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-[26px] font-bold tracking-[-1px] text-[#292421]">My Dashboard</h2>
        <p className="mt-0.5 text-[10px] text-[#938780]">Sales, expenses, and stock activity at {hotelName}.</p>
        <div className="mt-3 flex items-center gap-4 border-b border-[#e8ded9]">
          <span className="relative -mb-px border-b-2 border-[#e7654b] px-2.5 pb-1.5 text-[11px] font-semibold text-[#d95c43]">Overview</span>
          <button onClick={() => onNavigate('Sales')} className="relative -mb-px border-b-2 border-transparent px-2.5 pb-1.5 text-[11px] text-[#655a54] transition hover:border-[#e8ded9] hover:text-[#d95c43]">Sales</button>
          <button onClick={() => onNavigate('Purchase expenses')} className="relative -mb-px border-b-2 border-transparent px-2.5 pb-1.5 text-[11px] text-[#655a54] transition hover:border-[#e8ded9] hover:text-[#d95c43]">Expenses</button>
        </div>
      </div>
      <div ref={menuRef} className="relative mb-1 flex items-center gap-2">
        <button onClick={() => setMenuOpen(previous => !previous)} aria-haspopup="listbox" aria-expanded={menuOpen} className="inline-flex items-center gap-2 rounded-md border border-[#eadfd9] bg-white px-3 py-2 text-[10px] text-[#655a54] transition hover:border-[#e7654b]">
          <CalendarDays size={14} className="text-[#8d817b]" />{reportDate}<ChevronDown size={13} className={menuOpen ? 'text-[#d95c43]' : 'text-[#8d817b]'} />
        </button>
        <button onClick={() => setMenuOpen(previous => !previous)} aria-haspopup="listbox" aria-expanded={menuOpen} className="inline-flex items-center gap-2 rounded-md border border-[#eadfd9] bg-white px-3 py-2 text-[10px] font-medium text-[#655a54] transition hover:border-[#e7654b]">
          <SlidersHorizontal size={14} className={periodKey === 'today' ? 'text-[#d95c43]' : 'text-[#8d817b]'} />Filter
        </button>
        {menuOpen && <div role="listbox" className="absolute right-0 top-full z-40 mt-2 w-[190px] overflow-hidden rounded-lg border border-[#f0e8e4] bg-white py-1 shadow-[0_12px_40px_rgba(53,42,36,.14)]">
          {PERIODS.map(item => <button key={item.key} role="option" aria-selected={item.key === periodKey} onClick={() => { setPeriodKey(item.key); setMenuOpen(false) }} className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-[11px] transition hover:bg-[#fff8f5] ${item.key === periodKey ? 'font-semibold text-[#d95c43]' : 'text-[#655a54]'}`}>
            {item.label}{item.key === periodKey && <span className="size-1.5 rounded-full bg-[#e7654b]" />}
          </button>)}
        </div>}
      </div>
    </div>

    <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4 xl:gap-3.5">
      <MetricCard title="Available Dish" value={canViewSales ? salesThisWeek : '—'} icon={ShoppingBag} detail={canViewSales ? `${todaySales.length} recorded today` : 'Access not granted'} />
      <MetricCard title="Total Order" value={canViewSales ? todaySales.length : '—'} icon={ChartNoAxesCombined} detail={canViewSales ? `${money(salesToday, currency)} today` : 'Access not granted'} />
      <MetricCard title="Total Sale" value={canViewSales ? money(salesToday, currency) : '—'} icon={TrendingUp} detail={canViewSales ? 'Recorded today' : 'Access not granted'} />
      <MetricCard title="Total Profit" value={balanceToday === null ? '—' : money(balanceToday, currency)} icon={Wallet} detail={canViewExpenses ? `${money(expensesToday, currency)} spent today` : 'Access not granted'} inverse />
    </div>

    <div className="flex flex-col gap-3.5 xl:flex-row">
      <div className="grid min-w-0 flex-1 gap-3.5 lg:grid-cols-5">
        <section className="border border-[#f0e8e4] bg-white p-3.5 sm:p-4 lg:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="font-display text-[16px] font-bold text-[#292421]">Total Revenue</h3><p className="mt-1 text-[10px] text-[#a19690]">Recorded activity over the last 7 days</p></div>
            <span className="mt-0.5 inline-flex items-center gap-1.5 text-[10px] font-medium text-[#786d67]"><i className="size-2 rounded-sm bg-[#e7654b]" />Sales <i className="ml-2 size-2 rounded-sm bg-[#f2c7bb]" />Expenses</span>
          </div>
          <div className="mt-4 flex items-baseline gap-2"><strong className="font-display text-[18px] font-bold text-[#292421]">{canViewSales ? money(analytics.totalRevenue || 0, currency) : '—'}</strong><span className="text-[10px] text-[#a19690]">sales this week</span></div>
          <div className="mt-2 h-[184px] w-full sm:h-[205px]">
            {series.length ? <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 4, left: -20, bottom: 0 }} barGap={-15}>
                <CartesianGrid vertical={false} stroke="#f2ebe7" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8d817b', fontSize: 9 }} dy={7} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8d817b', fontSize: 9 }} tickFormatter={value => value >= 1000 ? `${Math.round(value / 1000)}k` : value} />
                <Tooltip contentStyle={{ border: '1px solid #eee4df', borderRadius: 4, fontSize: 10 }} formatter={value => money(value, currency)} />
                <Bar dataKey="sales" fill="#f8eeeb" radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar dataKey="expenses" fill="#e7654b" radius={[3, 3, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer> : <div className="grid h-full place-items-center text-center text-[10px] text-[#a19690]">Recorded sales and expenses will appear here.</div>}
          </div>
        </section>

        <section className="border border-[#f0e8e4] bg-white p-3.5 sm:p-4 lg:col-span-2">
          <div className="flex items-start justify-between gap-2">
            <div><h3 className="font-display text-[16px] font-bold text-[#292421]">Performance</h3><p className="mt-1 text-[10px] text-[#a19690]">Days that covered their expenses</p></div>
            <MoreHorizontal size={18} className="text-[#8d817b]" />
          </div>
          <div className="relative mx-auto mt-3 h-[150px] max-w-[210px]">
            <svg viewBox="0 0 200 140" className="h-full w-full" role="img" aria-label={`${Math.round(coverage * 100)} percent of days kept sales above expenses`}>
              <polygon points={polygon(56)} fill="#fdece5" stroke="#f8dccd" strokeWidth="10" strokeLinejoin="round" />
              <polygon points={polygon(56)} fill="#e7654b" clipPath="url(#gaugeClip)" />
              <clipPath id="gaugeClip"><polygon points={polygon(56 * coverage)} /></clipPath>
              <circle cx="100" cy="70" r="18" fill="#fff" stroke="#eee4df" />
              <text x="100" y="66" textAnchor="middle" fill="#786d67" fontSize="8">Days covered</text>
              <text x="100" y="80" textAnchor="middle" fill="#292421" fontSize="13" fontWeight="700">{coverage >= 1 ? '100' : Math.round(coverage * 100)}%</text>
            </svg>
          </div>
          <div className="mt-2 flex justify-between text-[9px] text-[#8d817b]">
            <span><i className="mr-1 inline-block size-1.5 rounded-full bg-[#e7654b]" />Covered</span>
            <span>{positiveDays}/{(analytics.series || []).length} days</span>
          </div>
          <div className="mt-3 border-t border-[#f1eae6] pt-3">
            <div className="flex items-center justify-between"><span className="text-[10px] text-[#8d817b]">Expenses today</span><strong className="text-[12px] font-bold text-[#292421]">{canViewExpenses ? money(expensesToday, currency) : '—'}</strong></div>
            <div className="mt-2 flex items-center justify-between"><span className="text-[10px] text-[#8d817b]">Sales today</span><strong className="text-[12px] font-bold text-[#292421]">{canViewSales ? money(salesToday, currency) : '—'}</strong></div>
          </div>
        </section>

        <section className="border border-[#f0e8e4] bg-white p-3.5 sm:p-4 lg:col-span-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex min-w-0 items-center gap-3 bg-[#fbf8f6] p-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e7654b] text-white"><ChartNoAxesCombined size={19} /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-[#292421]">Food categories</p><p className="mt-1 text-[10px] text-[#8d817b]">Manage your food types and expense categories.</p></div>
            </div>
            <button onClick={() => onNavigate('Food type')} className="flex min-w-0 items-center justify-center gap-2 bg-[#e7654b] px-3 py-2.5 text-[10px] font-semibold text-white transition hover:bg-[#d95c43]">Manage categories <ArrowRight size={13} /></button>
          </div>
        </section>

        <section className="border border-[#f0e8e4] bg-white p-3.5 sm:p-4 lg:col-span-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-[#fff0ea] text-[#d95c43]"><Receipt size={15} /></span><div><h3 className="font-display text-[16px] font-bold text-[#292421]">Last Reports</h3><p className="mt-1 text-[10px] text-[#a19690]">Latest recorded costs</p></div></div>
            <button onClick={() => onNavigate('Reports')} className="text-[10px] font-medium text-[#d95c43] hover:underline">See all</button>
          </div>
          <div className="mt-4 space-y-2">
            {recentExpenses.length ? recentExpenses.map(expense => <div key={expense._id} className="flex items-center gap-2.5 border border-[#f0e8e4] p-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#fff3ee] text-[#d95c43]"><Receipt size={14} /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold text-[#292421]">{expense.categoryName || 'Expense'}</p><p className="mt-1 truncate text-[9px] text-[#8d817b]">{expense.note || formatTime(expense.createdAt)}</p></div>
              <strong className="shrink-0 text-[10px] font-semibold text-[#292421]">{canViewExpenses ? money(expense.amount, currency) : '—'}</strong>
            </div>) : <p className="py-6 text-center text-[10px] text-[#8d817b]">No expenses have been recorded yet.</p>}
          </div>
          <button onClick={() => onNavigate('Reports')} className="mt-3 flex w-full items-center justify-center gap-2 bg-[#e7654b] px-3 py-2.5 text-[10px] font-semibold text-white transition hover:bg-[#d95c43]">Download PDF <Download size={13} /></button>
        </section>

        <section className="border border-[#f0e8e4] bg-white p-3.5 sm:p-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-[#fff0ea] text-[#d95c43]"><UsersRound size={15} /></span><div><h3 className="font-display text-[16px] font-bold text-[#292421]">Your Customer</h3><p className="mt-1 text-[10px] text-[#a19690]">Today&apos;s customers served</p></div></div>
            <MoreHorizontal size={18} className="text-[#8d817b]" />
          </div>
          <div className="mt-4 flex items-center justify-around gap-3 text-center">
            <div><strong className="font-display text-[20px] font-bold text-[#292421]">{todaySales.length}</strong><p className="mt-1 text-[9px] text-[#8d817b]">Today</p></div>
            <div className="h-9 w-px bg-[#eee4df]" /><div><strong className="font-display text-[20px] font-bold text-[#292421]">{salesThisWeek}</strong><p className="mt-1 text-[9px] text-[#8d817b]">This week</p></div>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#fdece5]"><div className="h-full rounded-full bg-[#e7654b] transition-all" style={{ width: `${Math.max(4, Math.min(100, salesThisWeek ? (todaySales.length / salesThisWeek) * 100 : 0))}%` }} /></div>
          <button onClick={() => onNavigate('Sales')} className="mt-3 flex w-full items-center justify-center gap-1 text-[10px] font-semibold text-[#d95c43] hover:underline">View More</button>
        </section>
      </div>

      <aside className="grid min-w-0 gap-3.5 xl:w-[300px] xl:shrink-0">
        <section className="border border-[#f0e8e4] bg-white p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div><button onClick={() => onNavigate('Make sale')} className="flex items-center gap-2 font-display text-[16px] font-bold text-[#292421] hover:text-[#d95c43]">More <ArrowRight size={17} /></button><p className="mt-1 text-[10px] text-[#8d817b]">Food sales management</p></div>
            <ShoppingBag size={17} className="mt-0.5 text-[#d95c43]" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-1.5">
            {[
              { label: 'Today Orders', count: todaySales.length },
              { label: 'Completed', count: todaySales.filter(sale => sale.approved !== false).length },
              { label: 'Pending', count: todaySales.filter(sale => sale.approved === false).length },
            ].map((item, index) => <div key={item.label} className={`flex min-h-[84px] flex-col items-center justify-center text-white ${index === 1 ? 'bg-[#df634b]' : index === 2 ? 'bg-[#e97158]' : 'bg-[#e7654b]'}`}>
              <strong className="font-display text-[22px] font-bold leading-none">{item.count}</strong><span className="mt-2 text-center text-[9px]">{item.label}</span>
            </div>)}
          </div>
          <div className="mt-3 flex items-center justify-between text-[9px] text-[#8d817b]"><span>{balanceToday === null ? 'Financial summary access is limited' : `${money(balanceToday, currency)} remaining today`}</span><button onClick={() => onNavigate('Make sale')} className="font-semibold text-[#d95c43] hover:underline">Record sale</button></div>
        </section>

        <section className="border border-[#f0e8e4] bg-white">
          <div className="flex items-center justify-between border-b border-[#f1eae6] px-4 py-3.5 sm:px-5">
            <div><h3 className="font-display text-[16px] font-bold text-[#292421]">Recent Order</h3><p className="mt-1 text-[10px] text-[#a19690]">Latest recorded food sales</p></div>
            <button onClick={() => onNavigate('Sales')} className="grid size-7 place-items-center rounded-full bg-[#fbf5f2] text-[#8d817b] transition hover:text-[#d95c43]" aria-label="View all sales"><ArrowRight size={14} /></button>
          </div>
          <div className="space-y-2.5 p-3 sm:p-4">
            {recentSales.length ? recentSales.map(sale => <div key={sale._id} className="flex items-center gap-2.5 border border-[#f0e8e4] p-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#fff0ea] text-[#d95c43]"><ShoppingBag size={16} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-semibold text-[#292421]">{sale.name || sale.items?.[0]?.name || 'Food sale'}</span><span className="mt-1 block truncate text-[9px] text-[#8d817b]">{sale.saleId || formatTime(sale.createdAt)}{sale.customerName ? ` · ${sale.customerName}` : ''}</span></span>
              <div className="shrink-0 text-right"><strong className="block text-[10px] font-semibold text-[#292421]">{canViewSales ? money(sale.amount, currency) : '—'}</strong><span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[8px] font-semibold ${sale.approved === false ? 'bg-[#fdf1cf] text-[#c4901c]' : 'bg-[#eaf7ef] text-[#55a978]'}`}>{sale.approved === false ? 'Pending' : 'Complete'}</span></div>
            </div>) : <div className="py-8 text-center"><span className="mx-auto grid size-9 place-items-center rounded-full bg-[#fbf5f2] text-[#a19690]"><ShoppingBag size={16} /></span><p className="mt-2 text-[10px] text-[#8d817b]">Record your first food sale to see it here.</p></div>}
          </div>
          <button onClick={() => onNavigate('Sales')} className="flex w-full items-center justify-center gap-1 border-t border-[#f1eae6] px-4 py-3 text-[10px] font-semibold text-[#d95c43] hover:bg-[#fffbf9]">View sales ledger <ArrowRight size={12} /></button>
        </section>
      </aside>
    </div>
  </div>
}

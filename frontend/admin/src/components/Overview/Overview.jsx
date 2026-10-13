import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight, CalendarDays, ChartNoAxesCombined, ChevronDown, MoreHorizontal, PackageOpen, Receipt,
  ShoppingBag, SlidersHorizontal, TrendingUp, Wallet, UsersRound, Download,
} from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { money } from '../../lib/ui.js'
import { api, apiAssetUrl } from '../../lib/api.js'
import { MetricCard } from '../MetricCard/MetricCard.jsx'
import { DateCalendar } from '../DateCalendar/DateCalendar.jsx'

const formatDay = value => new Date(`${value}T12:00:00`).toLocaleDateString('en-UG', { weekday: 'short' })
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

// Photo of a sale line's stock item, from the sale's stockImages map
// returned by the API; empty when the line is not stock-linked or has no photo.
const saleItemImage = (sale, item) => (sale.stockImages ? sale.stockImages[String(item?.stockItemId || '')] || '' : '')

export function Overview({ hotelName, onNavigate, analytics, currency, onRange, reportRange }) {
  const sales = analytics.sales || []
  const expenses = analytics.expenses || []
  const canViewSales = analytics.canViewSales !== false
  const canViewExpenses = analytics.canViewExpenses !== false

  // Date filter state, shared by the date button and the Filter chip (both
  // open the same option menu, as in the reference). The first render keeps
  // the range the dashboard already loaded; later changes re-fetch.
  // Seed from the range persisted in App (reportRange) so navigating away
  // and back shows the applied range, not a reset default. If the persisted
  // range matches a preset period, restore that preset; otherwise treat it
  // as the custom calendar range.
  const initialPeriod = () => {
    const range = reportRange || { from: periodDates('7').from, to: periodDates('7').to }
    for (const item of PERIODS) {
      if (item.key === 'today' || item.key === 'month') continue
      const dates = periodDates(item.key)
      if (dates.from === range.from && dates.to === range.to) return { key: item.key, custom: null }
    }
    return { key: '7', custom: { from: range.from, to: range.to } }
  }
  const [periodKey, setPeriodKey] = useState(() => initialPeriod().key)
  // Custom from/to range picked from the calendar; null while a preset
  // period is active.
  const [customRange, setCustomRange] = useState(() => initialPeriod().custom)
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
  // Calendar picking: one click applies that exact date; two clicks apply
  // the from→to span. Both go through the same fetch as the preset periods.
  const applyRange = (from, to) => {
    setCustomRange({ from, to })
    onRangeRef.current?.(from, to)
  }
  useEffect(() => {
    if (!menuOpen) return undefined
    const close = event => { if (!menuRef.current?.contains(event.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])
  const period = customRange
    ? { label: `${customRange.from === customRange.to ? 'that day' : 'that range'}` }
    : PERIODS.find(item => item.key === periodKey) || PERIODS[1]
  // Calendar preview range (fall back to the preset's dates for highlighting).
  const { from: periodFrom, to: periodTo } = customRange || periodDates(periodKey)
  // 'today'/'in period' wording keys off whether a single day is selected.
  const dayWording = customRange?.from === customRange?.to || (!customRange && periodKey === 'today') ? 'today' : 'in period'

  // Every figure below comes from the analytics payload the selected period
  // fetched — the dashboard shows exactly the chosen date's or range's data.
  const salesTotal = canViewSales ? Number(analytics.totalRevenue || 0) : null
  const expensesTotal = canViewExpenses ? Number(analytics.totalExpenses || 0) : null
  const profit = canViewSales && canViewExpenses
    ? Number(analytics.totalRevenue || 0) - Number(analytics.totalExpenses || 0)
    : null
  // Damages load from their own endpoint so the dashboard card is ready
  // whenever the analytics payload carries one; a quiet load never blocks
  // the page. The analytics payload's total (when present) wins.
  const [damageTotal, setDamageTotal] = useState(analytics.totalDamages ?? null)
  useEffect(() => {
    if (analytics.totalDamages !== undefined) { setDamageTotal(analytics.totalDamages); return }
    let cancelled = false
    api('/api/owner/damages').then(data => { if (!cancelled) setDamageTotal(data.total || 0) }).catch(() => {})
    return () => { cancelled = true }
  }, [analytics.totalDamages])
  const damagesTotal = damageTotal === null ? null : Number(damageTotal || 0)
  const series = (analytics.series || []).map(day => ({
    day: formatDay(day.date),
    sales: day.revenue || 0,
    expenses: day.expenses || 0,
  }))
  const recentSales = sales.slice(0, 3)
  const recentExpenses = expenses.slice(0, 3)
  let approvedCount = 0
  let pendingCount = 0
  for (const sale of sales) {
    if (sale.approved === false) pendingCount += 1
    else approvedCount += 1
  }
  const periodSales = sales.length
  const uniqueCustomers = new Set(sales.map(sale => sale.customerContact || sale.customerName).filter(Boolean)).size
  // Share of each recorded day in the period whose sales covered expenses.
  const seriesRaw = analytics.series || []
  const positiveDays = seriesRaw.filter(day => (day.revenue || 0) >= (day.expenses || 0)).length
  const coverage = seriesRaw.length ? Math.max(0, Math.min(1, positiveDays / seriesRaw.length)) : 0.7
  // The date button reflects the applied range — today's date for the
  // current-day default, otherwise the exact from–to the user applied.
  const readRange = customRange || periodDates(periodKey)
  const shortDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-UG', { month: 'long', day: 'numeric', year: 'numeric' }) : ''
  const reportDate = customRange && customRange.from !== customRange.to
    ? `${shortDate(customRange.from)} – ${shortDate(customRange.to)}`
    : shortDate(readRange.from)

  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-[26px] font-bold tracking-[-1px] text-[#292421]">My Dashboard</h2>
        <p className="mt-0.5 text-[10px] text-[#938780]">Sales, expenses, and stock activity at {hotelName}.</p>
        <div className="mt-3 flex items-center gap-4 border-b border-[#e8ded9]">
          <span className="relative -mb-px border-b-2 border-[#e7654b] px-2.5 pb-1.5 text-[11px] font-semibold text-[#d95c43]">Overview</span>
        </div>
      </div>
      <div ref={menuRef} className="relative mb-1 flex items-center gap-2">
        <button onClick={() => setMenuOpen(previous => !previous)} aria-haspopup="listbox" aria-expanded={menuOpen} className="inline-flex items-center gap-2 rounded-md border border-[#eadfd9] bg-white px-3 py-2 text-[10px] text-[#655a54] transition hover:border-[#e7654b]">
          <CalendarDays size={14} className="text-[#8d817b]" />{reportDate}<ChevronDown size={13} className={menuOpen ? 'text-[#d95c43]' : 'text-[#8d817b]'} />
        </button>
        <button onClick={() => setMenuOpen(previous => !previous)} aria-haspopup="listbox" aria-expanded={menuOpen} className="inline-flex items-center gap-2 rounded-md border border-[#eadfd9] bg-white px-3 py-2 text-[10px] font-medium text-[#655a54] transition hover:border-[#e7654b]">
          <SlidersHorizontal size={14} className={periodKey === 'today' ? 'text-[#d95c43]' : 'text-[#8d817b]'} />Filter
        </button>
        {menuOpen && <div className="absolute right-0 top-full z-40 mt-2 w-[280px] space-y-1 overflow-hidden rounded-lg border border-[#f0e8e4] bg-white py-2 shadow-[0_12px_40px_rgba(53,42,36,.14)]">
          <div className="flex gap-1 px-2">
            {PERIODS.map(item => <button key={item.key} onClick={() => { setCustomRange(null); setPeriodKey(item.key) }} className={`flex-1 rounded-md px-1 py-1.5 text-[9px] font-medium transition ${item.key === periodKey && !customRange ? 'bg-[#fde3da] font-semibold text-[#d95c43]' : 'text-[#655a54] hover:bg-[#fff8f5]'}`}>{item.label}</button>)}
          </div>
          <div className="border-t border-[#f1eae6] pt-1">
            <DateCalendar from={customRange?.from || periodFrom} to={customRange?.to || periodTo} onApply={applyRange} onClose={() => setMenuOpen(false)} />
          </div>
        </div>}
      </div>
    </div>
    <p className="-mt-2 text-[10px] text-[#a19690]">Showing <span className="font-semibold text-[#d95c43]">{period.label.toLowerCase()}</span> · pick a period with the date or filter button</p>

    <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4 xl:gap-3.5">
      <MetricCard title="Available Dish" value={canViewSales ? periodSales : '—'} icon={ShoppingBag} detail={canViewSales ? 'sales recorded in period' : 'Access not granted'} />
      <MetricCard title="Total Order" value={canViewSales ? periodSales : '—'} icon={ChartNoAxesCombined} detail={canViewSales ? `${period.label} orders` : 'Access not granted'} />
      <MetricCard title="Total Sale" value={salesTotal === null ? '—' : money(salesTotal, currency)} icon={TrendingUp} detail={canViewSales ? `${period.label} revenue` : 'Access not granted'} />
      <MetricCard title="Total Profit" value={profit === null ? '—' : money(profit, currency)} icon={Wallet} detail={canViewExpenses ? `${money(expensesTotal || 0, currency)} spent ${dayWording}` : 'Access not granted'} inverse />
      <MetricCard title="Damage" value={canViewExpenses ? money(damagesTotal === null ? analytics.totalDamages || 0 : damagesTotal, currency) : '—'} icon={PackageOpen} detail={canViewExpenses ? (dayWording === 'today' ? 'goods lost today' : 'goods lost in period') : 'Access not granted'} inverse />
    </div>

    <div className="flex flex-col gap-3.5 xl:flex-row">
      <div className="grid min-w-0 flex-1 gap-3.5 lg:grid-cols-5">
        <section className="border border-[#f0e8e4] bg-white p-3.5 sm:p-4 lg:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="font-display text-[16px] font-bold text-[#292421]">Total Revenue</h3><p className="mt-1 text-[10px] text-[#a19690]">Recorded activity, {period.label.toLowerCase()}</p></div>
            <span className="mt-0.5 inline-flex items-center gap-1.5 text-[10px] font-medium text-[#786d67]"><i className="size-2 rounded-sm bg-[#e7654b]" />Sales <i className="ml-2 size-2 rounded-sm bg-[#f2c7bb]" />Expenses</span>
          </div>
          <div className="mt-4 flex items-baseline gap-2"><strong className="font-display text-[18px] font-bold text-[#292421]">{salesTotal === null ? '—' : money(salesTotal, currency)}</strong><span className="text-[10px] text-[#a19690]">sales {dayWording}</span></div>
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
            <span>{positiveDays}/{seriesRaw.length} days</span>
          </div>
          <div className="mt-3 border-t border-[#f1eae6] pt-3">
            <div className="flex items-center justify-between"><span className="text-[10px] text-[#8d817b]">Expenses {dayWording}</span><strong className="text-[12px] font-bold text-[#292421]">{expensesTotal === null ? '—' : money(expensesTotal, currency)}</strong></div>
            <div className="mt-2 flex items-center justify-between"><span className="text-[10px] text-[#8d817b]">Sales {dayWording}</span><strong className="text-[12px] font-bold text-[#292421]">{salesTotal === null ? '—' : money(salesTotal, currency)}</strong></div>
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
            <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-[#fff0ea] text-[#d95c43]"><Receipt size={15} /></span><div><h3 className="font-display text-[16px] font-bold text-[#292421]">Last Reports</h3><p className="mt-1 text-[10px] text-[#a19690]">Latest costs, {period.label.toLowerCase()}</p></div></div>
            <button onClick={() => onNavigate('Reports')} className="text-[10px] font-medium text-[#d95c43] hover:underline">See all</button>
          </div>
          <div className="mt-4 space-y-2">
            {recentExpenses.length ? recentExpenses.map(expense => <div key={expense._id} className="flex items-center gap-2.5 border border-[#f0e8e4] p-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#fff3ee] text-[#d95c43]"><Receipt size={14} /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold text-[#292421]">{expense.categoryName || 'Expense'}</p><p className="mt-1 truncate text-[9px] text-[#8d817b]">{expense.note || formatTime(expense.createdAt)}</p></div>
              <strong className="shrink-0 text-[10px] font-semibold text-[#292421]">{canViewExpenses ? money(expense.amount, currency) : '—'}</strong>
            </div>) : <p className="py-6 text-center text-[10px] text-[#8d817b]">No expenses {dayWording}.</p>}
          </div>
          <button onClick={() => onNavigate('Reports')} className="mt-3 flex w-full items-center justify-center gap-2 bg-[#e7654b] px-3 py-2.5 text-[10px] font-semibold text-white transition hover:bg-[#d95c43]">Download PDF <Download size={13} /></button>
        </section>

        <section className="border border-[#f0e8e4] bg-white p-3.5 sm:p-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-[#fff0ea] text-[#d95c43]"><UsersRound size={15} /></span><div><h3 className="font-display text-[16px] font-bold text-[#292421]">Your Customer</h3><p className="mt-1 text-[10px] text-[#a19690]">Customers served {period.label.toLowerCase()}</p></div></div>
            <MoreHorizontal size={18} className="text-[#8d817b]" />
          </div>
          <div className="mt-4 flex items-center justify-around gap-3 text-center">
            <div><strong className="font-display text-[20px] font-bold text-[#292421]">{periodSales}</strong><p className="mt-1 text-[9px] text-[#8d817b]">Orders</p></div>
            <div className="h-9 w-px bg-[#eee4df]" /><div><strong className="font-display text-[20px] font-bold text-[#292421]">{uniqueCustomers}</strong><p className="mt-1 text-[9px] text-[#8d817b]">Unique customers</p></div>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#fdece5]"><div className="h-full rounded-full bg-[#e7654b] transition-all" style={{ width: `${Math.max(4, Math.min(100, periodSales ? 100 : 4))}%` }} /></div>
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
              { label: 'Orders', count: periodSales },
              { label: 'Completed', count: approvedCount },
              { label: 'Pending', count: pendingCount },
            ].map((item, index) => <div key={item.label} className={`flex min-h-[84px] flex-col items-center justify-center text-white ${index === 1 ? 'bg-[#df634b]' : index === 2 ? 'bg-[#e97158]' : 'bg-[#e7654b]'}`}>
              <strong className="font-display text-[22px] font-bold leading-none">{item.count}</strong><span className="mt-2 text-center text-[9px]">{item.label}</span>
            </div>)}
          </div>
          <div className="mt-3 flex items-center justify-between text-[9px] text-[#8d817b]"><span>{profit === null ? 'Financial summary access is limited' : `${expensesTotal ? 'Expenses' : 'No expenses'} ${dayWording}`}</span><button onClick={() => onNavigate('Make sale')} className="font-semibold text-[#d95c43] hover:underline">Record sale</button></div>
        </section>

        <section className="border border-[#f0e8e4] bg-white">
          <div className="flex items-center justify-between border-b border-[#f1eae6] px-4 py-3.5 sm:px-5">
            <div><h3 className="font-display text-[16px] font-bold text-[#292421]">Recent Order</h3><p className="mt-1 text-[10px] text-[#a19690]">Latest recorded food sales, {period.label.toLowerCase()}</p></div>
            <button onClick={() => onNavigate('Sales')} className="grid size-7 place-items-center rounded-full bg-[#fbf5f2] text-[#8d817b] transition hover:text-[#d95c43]" aria-label="View all sales"><ArrowRight size={14} /></button>
          </div>
          <div className="space-y-2.5 p-3 sm:p-4">
            {recentSales.length ? recentSales.map(sale => <div key={sale._id} className="flex items-center gap-2.5 border border-[#f0e8e4] p-2.5">
              {(() => { const image = saleItemImage(sale, (Array.isArray(sale.items) && sale.items[0]) || sale); return image
                ? <img src={apiAssetUrl(image)} alt="" aria-hidden="true" className="size-9 shrink-0 rounded-full object-cover" />
                : <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#fff0ea] text-[#d95c43]"><ShoppingBag size={16} /></span> })()}
              <span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-semibold text-[#292421]">{sale.name || sale.items?.[0]?.name || 'Food sale'}</span><span className="mt-1 block truncate text-[9px] text-[#8d817b]">{sale.saleId || formatTime(sale.createdAt)}{sale.customerName ? ` · ${sale.customerName}` : ''}</span></span>
              <div className="shrink-0 text-right"><strong className="block text-[10px] font-semibold text-[#292421]">{canViewSales ? money(sale.amount, currency) : '—'}</strong><span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[8px] font-semibold ${sale.approved === false ? 'bg-[#fdf1cf] text-[#c4901c]' : 'bg-[#eaf7ef] text-[#55a978]'}`}>{sale.approved === false ? 'Pending' : 'Complete'}</span></div>
            </div>) : <div className="py-8 text-center"><span className="mx-auto grid size-9 place-items-center rounded-full bg-[#fbf5f2] text-[#a19690]"><ShoppingBag size={16} /></span><p className="mt-2 text-[10px] text-[#8d817b]">No sales {dayWording}.</p></div>}
          </div>
          <button onClick={() => onNavigate('Sales')} className="flex w-full items-center justify-center gap-1 border-t border-[#f1eae6] px-4 py-3 text-[10px] font-semibold text-[#d95c43] hover:bg-[#fffbf9]">View sales ledger <ArrowRight size={12} /></button>
        </section>
      </aside>
    </div>
  </div>
}

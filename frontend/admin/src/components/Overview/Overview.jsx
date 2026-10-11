import {
  ArrowRight, CalendarDays, ChartNoAxesCombined, MoreHorizontal, Receipt,
  ShoppingBag, TrendingUp, Wallet,
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

export function Overview({ hotelName, onNavigate, analytics, currency }) {
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
  const balanceMargin = balanceToday !== null && salesToday ? Math.max(0, Math.min(100, (balanceToday / salesToday) * 100)) : 0
  const reportDate = new Intl.DateTimeFormat('en-UG', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())

  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-[22px] font-extrabold tracking-[-.8px] text-[#24201e] sm:text-[26px]">My Dashboard</h2>
        <p className="mt-0.5 text-[10px] text-[#938780]">Sales, expenses, and stock activity at {hotelName}.</p>
        <div className="mt-3 flex items-center gap-4 border-b border-[#e8ded9]">
          <span className="relative -mb-px border-b-2 border-[#e7654b] px-2.5 pb-1.5 text-[10px] font-semibold text-[#d95c43]">Overview</span>
          <button onClick={() => onNavigate('Sales')} className="relative -mb-px border-b-2 border-transparent px-2.5 pb-1.5 text-[10px] text-[#655a54] transition hover:border-[#e8ded9] hover:text-[#d95c43]">Sales</button>
          <button onClick={() => onNavigate('Purchase expenses')} className="relative -mb-px border-b-2 border-transparent px-2.5 pb-1.5 text-[10px] text-[#655a54] transition hover:border-[#e8ded9] hover:text-[#d95c43]">Expenses</button>
        </div>
      </div>
      <span className="mb-1 inline-flex items-center gap-2 rounded-md border border-[#eadfd9] bg-white px-3 py-2 text-[10px] text-[#655a54]">
        <CalendarDays size={14} className="text-[#8d817b]" />{reportDate}
      </span>
    </div>

    <div className="grid grid-cols-2 gap-2 min-[420px]:gap-2.5 xl:grid-cols-4 xl:gap-3">
      <MetricCard title="Sales today" value={canViewSales ? money(salesToday, currency) : '—'} icon={ShoppingBag} detail={canViewSales ? `${todaySales.length} recorded sales` : 'Access not granted'} />
      <MetricCard title="Expenses today" value={canViewExpenses ? money(expensesToday, currency) : '—'} icon={Receipt} detail={canViewExpenses ? `${todayExpenses.length} recorded expenses` : 'Access not granted'} />
      <MetricCard title="Balance today" value={balanceToday === null ? '—' : money(balanceToday, currency)} icon={Wallet} detail="Sales less recorded expenses" inverse />
      <MetricCard title="Sales this week" value={canViewSales ? salesThisWeek : '—'} icon={TrendingUp} detail={canViewSales ? `${money(analytics.totalRevenue || 0, currency)} total recorded` : 'Access not granted'} />
    </div>

    <div className="grid items-start gap-3 xl:grid-cols-12">
      <div className="grid min-w-0 gap-3 md:grid-cols-5 xl:col-span-8">
        <section className="grid min-w-0 border border-[#eee4df] bg-white md:col-span-5 md:grid-cols-5">
          <div className="min-w-0 p-3.5 sm:p-4 md:col-span-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="font-display text-[14px] font-bold text-[#292421]">Sales & Expenses</h3><p className="mt-1 text-[10px] text-[#a19690]">Recorded activity over the last 7 days</p></div>
              <span className="mt-0.5 inline-flex items-center gap-1.5 text-[10px] font-medium text-[#786d67]"><i className="size-2 rounded-sm bg-[#e7654b]" />Sales <i className="ml-2 size-2 rounded-sm bg-[#f2c7bb]" />Expenses</span>
            </div>
            <div className="mt-4 flex items-baseline gap-2"><strong className="font-display text-[18px] font-bold text-[#292421]">{money(analytics.totalRevenue || 0, currency)}</strong><span className="text-[10px] text-[#a19690]">sales this week</span></div>
            <div className="mt-2 h-[184px] w-full sm:h-[205px]">
              {series.length ? <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 4, left: -20, bottom: 0 }} barGap={-14}>
                  <CartesianGrid vertical={false} stroke="#f2ebe7" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8d817b', fontSize: 9 }} dy={7} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8d817b', fontSize: 9 }} tickFormatter={value => value >= 1000 ? `${Math.round(value / 1000)}k` : value} />
                  <Tooltip contentStyle={{ border: '1px solid #eee4df', borderRadius: 4, fontSize: 10 }} formatter={value => money(value, currency)} />
                  <Bar dataKey="sales" fill="#f8eeeb" radius={[2, 2, 0, 0]} maxBarSize={23} />
                  <Bar dataKey="expenses" fill="#e7654b" radius={[2, 2, 0, 0]} maxBarSize={23} />
                </BarChart>
              </ResponsiveContainer> : <div className="grid h-full place-items-center text-center text-[10px] text-[#a19690]">Recorded sales and expenses will appear here.</div>}
            </div>
          </div>

          <div className="min-w-0 border-t border-[#f1eae6] p-3.5 sm:p-4 md:col-span-2 md:border-l md:border-t-0">
            <div className="flex items-start justify-between gap-2">
              <div><h3 className="font-display text-[14px] font-bold text-[#292421]">Daily Balance</h3><p className="mt-1 text-[10px] text-[#a19690]">Sales less expenses today</p></div>
              <MoreHorizontal size={18} className="text-[#8d817b]" />
            </div>
            <div className="relative mx-auto mt-3 h-[132px] max-w-[190px]">
              <svg viewBox="0 0 200 112" className="h-full w-full" role="img" aria-label={`${balanceMargin.toFixed(1)} percent of sales remains after recorded expenses`}>
                <path d="M 16 100 A 84 84 0 0 0 184 100" fill="none" stroke="#f5ece8" strokeWidth="22" strokeLinecap="butt" />
                <path d="M 16 100 A 84 84 0 0 0 184 100" fill="none" stroke="#e7654b" strokeWidth="22" strokeLinecap="butt" pathLength="100" strokeDasharray={`${balanceMargin} 100`} />
                <text x="100" y="76" textAnchor="middle" fill="#786d67" fontSize="10">After expenses</text>
                <text x="100" y="99" textAnchor="middle" fill="#292421" fontSize="17" fontWeight="700">{balanceToday === null ? '—' : money(balanceToday, currency)}</text>
              </svg>
            </div>
            <div className="mt-2 border-t border-[#f1eae6] pt-3 text-center">
              <p className="text-[10px] leading-4 text-[#8d817b]">Recorded expenses today</p>
              <strong className="mt-1 block text-[13px] font-bold text-[#292421]">{canViewExpenses ? money(expensesToday, currency) : '—'}</strong>
            </div>
            <div className="mt-3 flex justify-between text-[9px] text-[#8d817b]"><span><i className="mr-1 inline-block size-1.5 rounded-full bg-[#e7654b]" />Expenses</span><span>Sales</span></div>
          </div>
        </section>

        <section className="min-w-0 border border-[#eee4df] bg-white p-3.5 sm:p-4 md:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <div><h3 className="font-display text-[14px] font-bold text-[#292421]">Food types</h3><p className="mt-1 text-[10px] text-[#a19690]">Organize items you sell</p></div>
            <button onClick={() => onNavigate('Food type')} className="text-[10px] font-medium text-[#786d67] hover:text-[#d95c43]">Manage</button>
          </div>
          <div className="mt-4 flex min-h-[90px] items-center gap-3 bg-[#fbf8f6] p-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e7654b] text-white"><ChartNoAxesCombined size={19} /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-[#292421]">Food categories</p><p className="mt-1 text-[10px] text-[#8d817b]">Manage your food types and expense categories.</p></div>
          </div>
          <button onClick={() => onNavigate('Food type')} className="mt-3 flex w-full items-center justify-center gap-2 bg-[#e7654b] px-3 py-2.5 text-[10px] font-semibold text-white transition hover:bg-[#d95c43]">Manage categories <ArrowRight size={13} /></button>
        </section>

        <section className="min-w-0 border border-[#eee4df] bg-white p-3.5 sm:p-4 md:col-span-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-[#fff0ea] text-[#d95c43]"><Receipt size={15} /></span><div><h3 className="font-display text-[14px] font-bold text-[#292421]">Recent Expenses</h3><p className="mt-1 text-[10px] text-[#a19690]">Latest recorded costs</p></div></div>
            <button onClick={() => onNavigate('Purchase expenses')} className="text-[10px] font-medium text-[#d95c43] hover:underline">View all</button>
          </div>
          <div className="mt-4 space-y-2">
            {!canViewExpenses && <p className="py-6 text-center text-[10px] text-[#8d817b]">Expense access has not been granted.</p>}
            {canViewExpenses && recentExpenses.length ? recentExpenses.map(expense => <div key={expense._id} className="flex items-center gap-2.5 border-b border-[#f1eae6] py-2 last:border-0">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#fff3ee] text-[#d95c43]"><Receipt size={14} /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold text-[#292421]">{expense.categoryName || 'Expense'}</p><p className="mt-1 truncate text-[9px] text-[#8d817b]">{expense.note || formatTime(expense.createdAt)}</p></div>
              <strong className="shrink-0 text-[10px] font-semibold text-[#292421]">{money(expense.amount, currency)}</strong>
            </div>) : canViewExpenses && <p className="py-6 text-center text-[10px] text-[#8d817b]">No expenses have been recorded yet.</p>}
          </div>
          <button onClick={() => onNavigate('Purchase expenses')} className="mt-2 flex w-full items-center justify-center gap-1 border-t border-[#f1eae6] pt-3 text-[10px] font-semibold text-[#d95c43]">Record an expense <ArrowRight size={12} /></button>
        </section>
      </div>

      <aside className="grid min-w-0 gap-3 xl:col-span-4">
        <section className="border border-[#eee4df] bg-white p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div><button onClick={() => onNavigate('Make sale')} className="flex items-center gap-2 font-display text-[14px] font-bold text-[#292421] hover:text-[#d95c43]">Record Sale <ArrowRight size={17} /></button><p className="mt-1 text-[10px] text-[#8d817b]">Food sales management</p></div>
            <ShoppingBag size={17} className="mt-0.5 text-[#d95c43]" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-1.5">
            {[
              { label: 'Sales today', count: todaySales.length },
              { label: 'Sales this week', count: salesThisWeek },
              { label: 'Expenses today', count: todayExpenses.length },
            ].map((item, index) => <div key={item.label} className={`flex min-h-[74px] flex-col items-center justify-center text-white ${index === 1 ? 'bg-[#df634b]' : index === 2 ? 'bg-[#e97158]' : 'bg-[#e7654b]'}`}>
              <strong className="font-display text-[22px] font-bold leading-none">{item.count}</strong><span className="mt-2 text-center text-[9px]">{item.label}</span>
            </div>)}
          </div>
          <div className="mt-3 flex items-center justify-between text-[9px] text-[#8d817b]"><span>{balanceToday === null ? 'Financial summary access is limited' : `${money(balanceToday, currency)} remaining after expenses`}</span><button onClick={() => onNavigate('Make sale')} className="font-semibold text-[#d95c43] hover:underline">Record sale</button></div>
        </section>

        <section className="border border-[#eee4df] bg-white">
          <div className="flex items-center justify-between border-b border-[#f1eae6] px-4 py-3.5 sm:px-5">
            <div><h3 className="font-display text-[14px] font-bold text-[#292421]">Recent Sales</h3><p className="mt-1 text-[10px] text-[#a19690]">Latest recorded food sales</p></div>
            <button onClick={() => onNavigate('Sales')} className="grid size-7 place-items-center rounded-full bg-[#fbf5f2] text-[#8d817b] transition hover:text-[#d95c43]" aria-label="View all sales"><ArrowRight size={14} /></button>
          </div>
          <div className="space-y-2.5 p-3 sm:p-4">
            {recentSales.length ? recentSales.map(sale => <div key={sale._id} className="flex items-center gap-2.5 border border-[#eee4df] p-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#fff0ea] text-[#d95c43]"><ShoppingBag size={16} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-semibold text-[#292421]">{sale.name || sale.items?.[0]?.name || 'Food sale'}</span><span className="mt-1 block truncate text-[9px] text-[#8d817b]">{sale.saleId || formatTime(sale.createdAt)}{sale.customerName ? ` · ${sale.customerName}` : ''}</span></span>
              <strong className="shrink-0 text-[10px] font-semibold text-[#292421]">{money(sale.amount, currency)}</strong>
            </div>) : <div className="py-8 text-center"><span className="mx-auto grid size-9 place-items-center rounded-full bg-[#fbf5f2] text-[#a19690]"><ShoppingBag size={16} /></span><p className="mt-2 text-[10px] text-[#8d817b]">Record your first food sale to see it here.</p></div>}
          </div>
          <button onClick={() => onNavigate('Sales')} className="flex w-full items-center justify-center gap-1 border-t border-[#f1eae6] px-4 py-3 text-[10px] font-semibold text-[#d95c43] hover:bg-[#fffaf8]">View sales ledger <ArrowRight size={12} /></button>
        </section>
      </aside>
    </div>
  </div>
}

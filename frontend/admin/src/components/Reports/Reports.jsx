import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Receipt, ShoppingBag, Wallet } from 'lucide-react'
import { money } from '../../lib/ui.js'
import { MetricCard } from '../MetricCard/MetricCard.jsx'

const dateText = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const initialRange = () => {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 6)
  return { from: dateText(from), to: dateText(to) }
}
const formatTime = value => new Date(value).toLocaleString('en-UG', { dateStyle: 'medium', timeStyle: 'short' })

export function Reports({ analytics, currency, onRange }) {
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
  const series = (analytics.series || []).map(day => ({
    day: new Date(`${day.date}T12:00:00`).toLocaleDateString('en-UG', { weekday: 'short', month: 'short', day: 'numeric' }),
    sales: day.revenue || 0,
    expenses: day.expenses || 0,
  }))
  const sales = analytics.sales || []
  const expenses = analytics.expenses || []

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[12px] text-[#8d817b]">Track recorded food sales and business expenses.</p>
      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        {['Daily', 'Monthly', 'Yearly'].map(preset => <button key={preset} onClick={() => setPreset(preset)} className="rounded-lg border border-[#eee4df] bg-white px-3 py-2 text-[10px] font-semibold text-[#655a54] hover:border-[#e7654b]">{preset}</button>)}
      </div>
      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-end">
        <label className="min-w-0 text-[9px] font-semibold text-[#a19690]">From<input type="date" value={range.from} max={range.to} onChange={event => setRange({ ...range, from: event.target.value })} className="mt-1 block w-full min-w-0 rounded-lg border border-[#eee4df] bg-white px-2 py-2 text-[10px] text-[#655a54] sm:mt-0 sm:inline-block sm:ml-2 sm:w-auto" /></label>
        <label className="min-w-0 text-[9px] font-semibold text-[#a19690]">To<input type="date" value={range.to} min={range.from} max={dateText(new Date())} onChange={event => setRange({ ...range, to: event.target.value })} className="mt-1 block w-full min-w-0 rounded-lg border border-[#eee4df] bg-white px-2 py-2 text-[10px] text-[#655a54] sm:mt-0 sm:inline-block sm:ml-2 sm:w-auto" /></label>
        <button onClick={() => onRange(range.from, range.to)} className="col-span-2 rounded-lg bg-[#e7654b] px-3 py-2 text-[10px] font-semibold text-white sm:col-span-1">Apply</button>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-2.5 min-[420px]:gap-3 lg:grid-cols-3">
      <MetricCard title="Food sales" value={money(analytics.totalRevenue, currency)} icon={ShoppingBag} detail={`${analytics.totalSalesCount || 0} records in selected period`} />
      <MetricCard title="Expenses" value={money(analytics.totalExpenses, currency)} icon={Receipt} detail={`${analytics.totalExpensesCount || 0} records in selected period`} />
      <MetricCard title="Balance after expenses" value={money(analytics.netBalance, currency)} icon={Wallet} detail="Sales minus recorded expenses" inverse />
    </div>

    <section className="border border-[#eee4df] bg-white p-4 sm:p-5">
      <div><h2 className="font-display text-[14px] font-bold text-[#292421]">Sales and expenses</h2><p className="mt-1 text-[10px] text-[#a19690]">Recorded amounts by day</p></div>
      <div className="mt-6 h-[220px] sm:h-[290px]">
        {series.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={series} barGap={5} margin={{ left: -15, right: 5 }}>
          <CartesianGrid vertical={false} stroke="#f2ebe7" />
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8d817b', fontSize: 9 }} dy={8} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8d817b', fontSize: 9 }} tickFormatter={value => `${Math.round(value / 1000)}k`} />
          <Tooltip contentStyle={{ border: '1px solid #eee4df', borderRadius: 4, fontSize: 10 }} formatter={value => money(value, currency)} />
          <Bar dataKey="sales" name="Sales" fill="#e7654b" radius={[3, 3, 0, 0]} />
          <Bar dataKey="expenses" name="Expenses" fill="#f2c7bb" radius={[3, 3, 0, 0]} />
        </BarChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-center text-[11px] text-[#a19690]">No records for the selected period.</div>}
      </div>
    </section>

    <div className="grid gap-4 xl:grid-cols-2">
      <section className="min-w-0 border border-[#eee4df] bg-white">
        <div className="flex items-center justify-between border-b border-[#f1eae6] px-4 py-3"><div><h2 className="font-display text-[14px] font-bold text-[#292421]">Recorded Sales</h2><p className="mt-1 text-[10px] text-[#a19690]">Food sales in this period</p></div><span className="text-[10px] font-semibold text-[#655a54]">{sales.length}</span></div>
        <div className="divide-y divide-[#f1eae6]">
          {sales.length ? sales.map(sale => <div key={sale._id} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#fff0ea] text-[#d95c43]"><ShoppingBag size={14} /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-[#292421]">{sale.name || 'Food sale'} <span className="font-normal text-[#a19690]">{sale.saleId}</span></p><p className="mt-1 text-[9px] text-[#8d817b]">{formatTime(sale.createdAt)}</p></div>
            <strong className="shrink-0 text-[10px] text-[#292421]">{money(sale.amount, currency)}</strong>
          </div>) : <p className="px-4 py-8 text-center text-[10px] text-[#a19690]">No sales recorded in this period.</p>}
        </div>
      </section>
      <section className="min-w-0 border border-[#eee4df] bg-white">
        <div className="flex items-center justify-between border-b border-[#f1eae6] px-4 py-3"><div><h2 className="font-display text-[14px] font-bold text-[#292421]">Recorded Expenses</h2><p className="mt-1 text-[10px] text-[#a19690]">Business costs in this period</p></div><span className="text-[10px] font-semibold text-[#655a54]">{expenses.length}</span></div>
        <div className="divide-y divide-[#f1eae6]">
          {expenses.length ? expenses.map(expense => <div key={expense._id} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#fff0ea] text-[#d95c43]"><Receipt size={14} /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-[#292421]">{expense.categoryName || 'Expense'}</p><p className="mt-1 truncate text-[9px] text-[#8d817b]">{expense.note || formatTime(expense.createdAt)}</p></div>
            <strong className="shrink-0 text-[10px] text-[#292421]">{money(expense.amount, currency)}</strong>
          </div>) : <p className="px-4 py-8 text-center text-[10px] text-[#a19690]">No expenses recorded in this period.</p>}
        </div>
      </section>
    </div>
  </div>
}

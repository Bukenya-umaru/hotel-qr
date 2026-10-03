import { useEffect, useState } from 'react'
import {
  Banknote, ChevronRight, Plus, Trash2,
} from 'lucide-react'
import { api } from '../../lib/api.js'
import { money } from '../../lib/ui.js'

// The independent Purchase page. Clicking "Purchase" in the sidebar lands
// here and shows its subsections — Sales for now — each opening its own
// workspace, the same way Categories shows Food type and Expenses.
export function PurchasePage({ initialView = 'menu' }) {
  const [view, setView] = useState(initialView) // 'menu' | 'sales'
  const [saleCount, setSaleCount] = useState(null)
  const [error, setError] = useState('')

  // Follow sidebar navigation between the Purchase subsections.
  useEffect(() => { setView(initialView) }, [initialView])

  // The count on the subsection card is a nice-to-have; probe the API
  // quietly so a failure never blocks the page.
  useEffect(() => {
    api('/api/owner/sales').then(data => setSaleCount(data.count)).catch(() => {})
  }, [view])

  const SUBSECTIONS = [
    {
      key: 'sales',
      icon: Banknote,
      title: 'Sales',
      description: 'Record the sales you make by hand, e.g. walk-in cash sales.',
      stat: saleCount === null ? '…' : `${saleCount} sale${saleCount === 1 ? '' : 's'}`,
    },
  ]

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-bold">Purchase</h2>
        <p className="mt-1 text-[12px] text-[#8d9389]">{view === 'menu'
          ? 'Choose a subsection to work in.'
          : 'Record the sales you make by hand and keep track of the money coming in.'}</p>
      </div>
    </div>
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-[#fae9e5] px-3 py-2.5 text-[11px] text-[#a44f3d]"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}

    {view === 'menu' && <div className="grid gap-3 sm:grid-cols-2">
      {SUBSECTIONS.map(({ key, icon: Icon, title, description, stat }) => <button key={key} onClick={() => setView(key)} className="group flex flex-col items-start gap-2 rounded-2xl border border-[#eceee8] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#dca875] hover:shadow-md">
        <span className="grid size-10 place-items-center rounded-xl bg-[#fff1e6] text-[#c65d1b]"><Icon size={19} /></span>
        <span className="flex items-center gap-1 text-[13px] font-bold text-[#293128]">{title}<ChevronRight size={14} className="text-[#a6aa9f] transition-transform group-hover:translate-x-0.5" /></span>
        <span className="text-[10px] leading-4 text-[#8d9389]">{description}</span>
        <span className="mt-1 rounded-full bg-[#f4f4f0] px-2 py-0.5 text-[9px] font-semibold text-[#757c71]">{stat}</span>
      </button>)}
    </div>}

    {view === 'sales' && <SalesView onError={setError} />}
  </div>
}

// ---- Subsection: Sales — record sales by hand and see the money coming in ----

function SalesView({ onError }) {
  const [form, setForm] = useState({ name: '', quantity: '1', amount: '', note: '' })
  const [sales, setSales] = useState([])
  const [stats, setStats] = useState({ total: 0, count: 0, todayTotal: 0, todayCount: 0 })
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const data = await api('/api/owner/sales')
      setSales(data.sales)
      setStats({ total: data.total, count: data.count, todayTotal: data.todayTotal, todayCount: data.todayCount })
      onError('')
    } catch (err) {
      onError(err.message)
    }
  }
  useEffect(() => { load() }, [])

  const addSale = async event => {
    event.preventDefault()
    const name = form.name.trim()
    if (!name) return
    setBusy(true)
    try {
      await api('/api/owner/sales', { method: 'POST', body: JSON.stringify({
        name,
        quantity: form.quantity === '' ? 1 : Number(form.quantity),
        amount: Number(form.amount || 0),
        note: form.note.trim(),
      }) })
      setForm({ name: '', quantity: '1', amount: '', note: '' })
      onError('')
      await load()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const removeSale = async sale => {
    if (!window.confirm(`Remove the sale "${sale.name}" (${money(sale.amount)})?`)) return
    setBusy(true)
    try {
      await api(`/api/owner/sales/${sale._id}`, { method: 'DELETE' })
      onError('')
      await load()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const saleTime = value => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  return <div className="rounded-xl border border-[#eceee8] bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="flex items-center gap-2 text-[11px] font-bold text-[#3d443a]">Recorded sales
        <span className="rounded-full bg-[#f4f4f0] px-2 py-0.5 text-[9px] font-semibold text-[#757c71]">{stats.count}</span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-[#eef6ec] px-2.5 py-1 text-[9px] font-semibold text-[#3f8f3a]">Today {money(stats.todayTotal)} · {stats.todayCount} sale{stats.todayCount === 1 ? '' : 's'}</span>
        <span className="rounded-full bg-[#fff1e6] px-2.5 py-1 text-[9px] font-semibold text-[#a34b16]">All time {money(stats.total)}</span>
      </div>
    </div>
    <form onSubmit={addSale} className="mt-3 grid grid-cols-1 gap-2 min-[540px]:grid-cols-2 lg:grid-cols-4">
      <label className="block min-[540px]:col-span-2 lg:col-span-1"><span className="sr-only">What was sold</span>
        <input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} maxLength="60" placeholder="What was sold, e.g. Beef plates" aria-label="What was sold" className="w-full rounded-lg border border-[#e6e9e1] bg-white px-3 py-2 text-[11px] outline-none focus:border-[#dca875] focus:ring-2 focus:ring-[#fff1e6]" />
      </label>
      <label className="block"><span className="sr-only">Quantity</span>
        <input type="number" min="0" step="0.01" value={form.quantity} onChange={event => setForm({ ...form, quantity: event.target.value })} placeholder="Quantity" aria-label="Quantity sold" className="w-full rounded-lg border border-[#e6e9e1] bg-white px-3 py-2 text-[11px] outline-none focus:border-[#dca875] focus:ring-2 focus:ring-[#fff1e6]" />
      </label>
      <label className="block"><span className="sr-only">Amount</span>
        <input required type="number" min="0" step="1" value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} placeholder="Total amount (UGX)" aria-label="Total amount in UGX" className="w-full rounded-lg border border-[#e6e9e1] bg-white px-3 py-2 text-[11px] outline-none focus:border-[#dca875] focus:ring-2 focus:ring-[#fff1e6]" />
      </label>
      <button disabled={busy || !form.name.trim()} className="flex items-center justify-center gap-1.5 rounded-lg bg-[#c65d1b] px-3 py-2 text-[10px] font-semibold text-white hover:bg-[#a34b16] disabled:cursor-not-allowed disabled:opacity-50"><Plus size={13} />Record sale</button>
      <label className="block min-[540px]:col-span-2 lg:col-span-4"><span className="sr-only">Note</span>
        <input value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} maxLength="200" placeholder="Note — optional, e.g. sold at the market stall" aria-label="Optional note" className="w-full rounded-lg border border-[#e6e9e1] bg-white px-3 py-2 text-[11px] outline-none focus:border-[#dca875] focus:ring-2 focus:ring-[#fff1e6]" />
      </label>
    </form>
    {sales.length > 0 && <ul className="mt-3 divide-y divide-[#f1f2ee]">
      {sales.map(sale => <li key={sale._id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-[#3d443a]">{sale.name}{Number(sale.quantity) !== 1 && <span className="ml-1.5 font-normal text-[#8d9389]">× {sale.quantity}</span>}</p>
          <p className="mt-0.5 truncate text-[9px] text-[#9b9f96]">{saleTime(sale.createdAt)}{sale.recordedBy && ` · by ${sale.recordedBy}`}{sale.note && ` · ${sale.note}`}</p>
        </div>
        <span className="shrink-0 text-[11px] font-bold text-[#3f8f3a]">{money(sale.amount)}</span>
        <button disabled={busy} onClick={() => removeSale(sale)} title={`Remove ${sale.name}`} className="shrink-0 rounded-md p-1 text-[#c08b7e] hover:bg-[#fae9e5] hover:text-[#b75c48] disabled:opacity-50"><Trash2 size={13} /></button>
      </li>)}
    </ul>}
    {!sales.length && <p className="mt-3 rounded-xl border border-dashed border-[#e6e9e1] px-3 py-6 text-center text-[10px] text-[#9b9f96]">No sales recorded yet — record your first one above.</p>}
  </div>
}

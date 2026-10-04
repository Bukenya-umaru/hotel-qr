import { useEffect, useState } from 'react'
import {
  Banknote, ChevronRight, Plus, Receipt, Trash2,
} from 'lucide-react'
import { api } from '../../lib/api.js'
import { money, cx, UNIT_OPTIONS, unitDisplay } from '../../lib/ui.js'
import { Modal } from '../Modal/Modal.jsx'

// The independent Purchase page. Clicking "Purchase" in the sidebar lands
// here and shows its subsections — Sales and Expenses — each opening its own
// workspace, the same way Categories shows Food type and Expenses.
export function PurchasePage({ initialView = 'menu', canManageExpenses = true }) {
  const [view, setView] = useState(initialView) // 'menu' | 'sales' | 'expenses'
  const [saleCount, setSaleCount] = useState(null)
  const [expenseCount, setExpenseCount] = useState(null)
  const [error, setError] = useState('')

  // Follow sidebar navigation between the Purchase subsections. Staff
  // without the expenses permission fall back to the menu of subsections.
  useEffect(() => { setView(canManageExpenses ? initialView : 'menu') }, [initialView, canManageExpenses])

  // The counts on the subsection cards are a nice-to-have; probe the APIs
  // quietly so a failure never blocks the page.
  useEffect(() => {
    api('/api/owner/sales').then(data => setSaleCount(data.count)).catch(() => {})
    if (canManageExpenses) api('/api/owner/expenses').then(data => setExpenseCount(data.count)).catch(() => {})
  }, [view, canManageExpenses])

  const SUBSECTIONS = [
    {
      key: 'sales',
      icon: Banknote,
      title: 'Sales',
      description: 'Record the sales you make by hand, e.g. walk-in cash sales.',
      stat: saleCount === null ? '…' : `${saleCount} sale${saleCount === 1 ? '' : 's'}`,
    },
    ...(canManageExpenses ? [{
      key: 'expenses',
      icon: Receipt,
      title: 'Expenses',
      description: 'Record everything the hotel spends, e.g. cooking gas, wages, deliveries.',
      stat: expenseCount === null ? '…' : `${expenseCount} expense${expenseCount === 1 ? '' : 's'}`,
    }] : []),
  ]

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-bold">Purchase</h2>
        <p className="mt-1 text-[12px] text-[#8d9389]">{view === 'menu'
          ? 'Choose a subsection to work in.'
          : view === 'expenses'
          ? 'Record what the hotel spends and keep track of the money going out.'
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
    {view === 'expenses' && <ExpensesView onError={setError} />}
  </div>
}

// ---- Subsection: Sales — record sales by hand and see the money coming in ----

function SalesView({ onError }) {
  const [sales, setSales] = useState([])
  const [stats, setStats] = useState({ total: 0, count: 0, todayTotal: 0, todayCount: 0 })
  const [busy, setBusy] = useState(false)
  const [showPopup, setShowPopup] = useState(false)

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
        <button onClick={() => setShowPopup(true)} className="flex items-center gap-1.5 rounded-lg bg-[#c65d1b] px-3 py-2 text-[10px] font-semibold text-white hover:bg-[#a34b16]"><Plus size={13} />Record sale</button>
      </div>
    </div>
    {sales.length > 0 && <ul className="mt-3 divide-y divide-[#f1f2ee]">
      {sales.map(sale => <li key={sale._id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-[#3d443a]">{sale.name}{Number(sale.quantity) !== 1 && <span className="ml-1.5 font-normal text-[#8d9389]">× {sale.quantity}{sale.unit ? ` ${sale.unit}` : ''}</span>}</p>
          <p className="mt-0.5 truncate text-[9px] text-[#9b9f96]">{saleTime(sale.createdAt)}{sale.recordedBy && ` · by ${sale.recordedBy}`}{sale.note && ` · ${sale.note}`}</p>
        </div>
        <span className="shrink-0 text-[11px] font-bold text-[#3f8f3a]">{money(sale.amount)}</span>
        <button disabled={busy} onClick={() => removeSale(sale)} title={`Remove ${sale.name}`} className="shrink-0 rounded-md p-1 text-[#c08b7e] hover:bg-[#fae9e5] hover:text-[#b75c48] disabled:opacity-50"><Trash2 size={13} /></button>
      </li>)}
    </ul>}
    {!sales.length && <p className="mt-3 rounded-xl border border-dashed border-[#e6e9e1] px-3 py-6 text-center text-[10px] text-[#9b9f96]">No sales recorded yet — click “Record sale” above to record your first one.</p>}
    {showPopup && <RecordSaleModal onClose={() => setShowPopup(false)} onSaved={() => { setShowPopup(false); load() }} />}
  </div>
}

// ---- Subsection: Expenses — everything the hotel spends, filed under the ----
// ---- expense categories managed in Categories > Expenses in the sidebar. ----

function ExpensesView({ onError }) {
  const [expenses, setExpenses] = useState([])
  const [byCategory, setByCategory] = useState([])
  const [stats, setStats] = useState({ total: 0, count: 0, todayTotal: 0, todayCount: 0 })
  const [busy, setBusy] = useState(false)
  const [showPopup, setShowPopup] = useState(false)

  const load = async () => {
    try {
      const data = await api('/api/owner/expenses')
      setExpenses(data.expenses)
      setByCategory(data.byCategory || [])
      setStats({ total: data.total, count: data.count, todayTotal: data.todayTotal, todayCount: data.todayCount })
      onError('')
    } catch (err) {
      onError(err.message)
    }
  }
  useEffect(() => { load() }, [])

  const removeExpense = async expense => {
    const label = expense.note ? `${expense.categoryName} — ${expense.note}` : expense.categoryName
    if (!window.confirm(`Remove the ${money(expense.amount)} expense for ${label}?`)) return
    setBusy(true)
    try {
      await api(`/api/owner/expenses/${expense._id}`, { method: 'DELETE' })
      onError('')
      await load()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const expenseTime = value => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  return <div className="rounded-xl border border-[#eceee8] bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="flex items-center gap-2 text-[11px] font-bold text-[#3d443a]">Recorded expenses
        <span className="rounded-full bg-[#f4f4f0] px-2 py-0.5 text-[9px] font-semibold text-[#757c71]">{stats.count}</span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-[#fae9e5] px-2.5 py-1 text-[9px] font-semibold text-[#a44f3d]">Today {money(stats.todayTotal)} · {stats.todayCount} expense{stats.todayCount === 1 ? '' : 's'}</span>
        <span className="rounded-full bg-[#f4f4f0] px-2.5 py-1 text-[9px] font-semibold text-[#757c71]">All time {money(stats.total)}</span>
        <button onClick={() => setShowPopup(true)} className="flex items-center gap-1.5 rounded-lg bg-[#c65d1b] px-3 py-2 text-[10px] font-semibold text-white hover:bg-[#a34b16]"><Plus size={13} />Record expense</button>
      </div>
    </div>
    {byCategory.length > 0 && <div className="mt-2.5 flex flex-wrap gap-1.5">
      {byCategory.map(entry => <span key={entry.category} className="rounded-full bg-[#f7f8f5] px-2.5 py-1 text-[9px] font-semibold text-[#757c71]">{entry.category} · {money(entry.total)} ({entry.count})</span>)}
    </div>}
    {expenses.length > 0 && <ul className="mt-3 divide-y divide-[#f1f2ee]">
      {expenses.map(expense => <li key={expense._id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-[#3d443a]">{expense.categoryName}</p>
          <p className="mt-0.5 truncate text-[9px] text-[#9b9f96]">{expenseTime(expense.createdAt)}{expense.recordedBy && ` · by ${expense.recordedBy}`}{expense.note && ` · ${expense.note}`}</p>
        </div>
        <span className="shrink-0 text-[11px] font-bold text-[#b75c48]">−{money(expense.amount)}</span>
        <button disabled={busy} onClick={() => removeExpense(expense)} title={`Remove ${expense.categoryName} expense`} className="shrink-0 rounded-md p-1 text-[#c08b7e] hover:bg-[#fae9e5] hover:text-[#b75c48] disabled:opacity-50"><Trash2 size={13} /></button>
      </li>)}
    </ul>}
    {!expenses.length && <p className="mt-3 rounded-xl border border-dashed border-[#e6e9e1] px-3 py-6 text-center text-[10px] text-[#9b9f96]">No expenses recorded yet — click “Record expense” above to record your first one.</p>}
    {showPopup && <RecordExpenseModal onClose={() => setShowPopup(false)} onSaved={() => { setShowPopup(false); load() }} />}
  </div>
}

// ---- Popup for recording one expense — pick one of the expense categories ----
// ---- from Categories > Expenses, or type a new category name to create it. ----

function RecordExpenseModal({ onClose, onSaved }) {
  const [categories, setCategories] = useState(null) // null while loading
  const [mode, setMode] = useState(null) // 'existing' | 'new'
  const [categoryId, setCategoryId] = useState('')
  const [newName, setNewName] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // The category options come from the expense categories the business
  // already manages; if that list cannot load, a new category can still be
  // typed by hand.
  useEffect(() => {
    let cancelled = false
    api('/api/owner/expense-categories').then(data => {
      if (cancelled) return
      const list = data.categories || []
      setCategories(list)
      setMode(list.length ? 'existing' : 'new')
    }).catch(() => {
      if (cancelled) return
      setCategories([])
      setMode('new')
    })
    return () => { cancelled = true }
  }, [])

  const submit = async event => {
    event.preventDefault()
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) { setError('Enter the amount the hotel spent.'); return }
    if (mode === 'new' && !newName.trim()) { setError('Name the category, e.g. Cooking gas.'); return }
    if (mode === 'existing' && !categoryId) { setError('Pick a category, or switch to “New category”.'); return }
    setBusy(true)
    try {
      await api('/api/owner/expenses', { method: 'POST', body: JSON.stringify(mode === 'existing'
        ? { categoryId, amount: value, note: note.trim() }
        : { categoryName: newName.trim(), amount: value, note: note.trim() }) })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const inputClass = 'w-full rounded-lg border border-[#e6e9e1] bg-white px-3 py-2.5 text-[12px] outline-none focus:border-[#dca875] focus:ring-2 focus:ring-[#fff1e6]'
  const labelClass = 'mb-1.5 block text-[10px] font-semibold text-[#737a70]'
  const modeButton = active => cx('rounded-md px-2 py-1.5 text-[10px] font-semibold transition', active ? 'bg-white text-[#c65d1b] shadow-sm' : 'text-[#757c71] hover:text-[#3d443a]')

  return <Modal title="Record expense" onClose={onClose}>
    <form className="space-y-3.5" onSubmit={submit}>
      <div>
        <span className={labelClass}>Category <span className="text-[#b75c48]">*</span></span>
        {categories === null ? <p className="text-[10px] text-[#9b9f96]">Loading categories…</p> : <>
          {categories.length > 0 && <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#f4f4f0] p-1">
            <button type="button" onClick={() => setMode('existing')} className={modeButton(mode === 'existing')}>Pick a category</button>
            <button type="button" onClick={() => setMode('new')} className={modeButton(mode === 'new')}>New category</button>
          </div>}
          {mode === 'existing' && <select autoFocus value={categoryId} onChange={event => setCategoryId(event.target.value)} className={cx(inputClass, 'mt-2')}>
            <option value="">Choose a category…</option>
            {categories.map(category => <option key={category._id} value={category._id}>{category.name}</option>)}
          </select>}
          {mode === 'new' && <input required autoFocus value={newName} onChange={event => setNewName(event.target.value)} maxLength="60" placeholder="Category name, e.g. Cooking gas" className={cx(inputClass, 'mt-2')} />}
          <p className="mt-1.5 text-[9px] leading-4 text-[#a0a49b]">{categories.length
            ? 'Categories are the same expense categories managed under Categories > Expenses in the sidebar.'
            : 'No expense categories yet — type a name to create your first one. You can manage them under Categories > Expenses.'}</p>
        </>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className={labelClass}>Amount (UGX) <span className="text-[#b75c48]">*</span></span>
          <input required type="number" min="0" step="1" value={amount} onChange={event => setAmount(event.target.value)} placeholder="e.g. 25000" className={inputClass} />
        </label>
        <label className="block"><span className={labelClass}>Note — optional</span>
          <input value={note} onChange={event => setNote(event.target.value)} maxLength="200" placeholder="e.g. gas refill" className={inputClass} />
        </label>
      </div>

      {error && <p className="text-[11px] text-[#b75c48]">{error}</p>}
      <button disabled={busy || mode === null} className="w-full rounded-lg bg-[#c65d1b] py-2.5 text-[11px] font-semibold text-white hover:bg-[#a34b16] disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Recording…' : 'Record expense'}</button>
    </form>
  </Modal>
}

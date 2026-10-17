import { Fragment, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import {
  ArrowDown, BadgePlus, Banknote, CalendarDays, Check, ChevronRight, History, Minus, Pencil, Plus, Receipt, Trash2, PackageOpen,
} from 'lucide-react'
import { api, apiAssetUrl, API_BASE_URL } from '../../lib/api.js'
import { money, cx, UNIT_OPTIONS, unitDisplay } from '../../lib/ui.js'
import { Modal } from '../Modal/Modal.jsx'
import { ActionProgress } from '../ActionProgress/ActionProgress.jsx'

// Sales and expense records each open their own workspace, like the
// Food type and expense-category sections in Categories.
export function PurchasePage({ hotelId, initialView = 'menu', canManageExpenses = true, canApprove = false }) {
  const [view, setView] = useState(initialView) // 'menu' | 'make-sale' | 'sales' | 'expenses' | 'damages'
  const [saleCount, setSaleCount] = useState(null)
  const [expenseCount, setExpenseCount] = useState(null)
  const [damageCount, setDamageCount] = useState(null)
  const [error, setError] = useState('')

  // Follow sidebar navigation while keeping expense-only permissions scoped
  // to expense records.
  useEffect(() => { setView((initialView === 'expenses' || initialView === 'damages') && !canManageExpenses ? 'menu' : initialView) }, [initialView, canManageExpenses])

  // The counts on the subsection cards are a nice-to-have; probe the APIs
  // quietly so a failure never blocks the page.
  useEffect(() => {
    api('/api/owner/sales').then(data => setSaleCount(data.count)).catch(() => {})
    if (canManageExpenses) {
      api('/api/owner/expenses').then(data => setExpenseCount(data.count)).catch(() => {})
      api('/api/owner/damages').then(data => setDamageCount(data.count)).catch(() => {})
    }
  }, [view, canManageExpenses])

  const SUBSECTIONS = [
    {
      key: 'make-sale',
      icon: BadgePlus,
      title: 'Make sale',
      description: 'Add one or more items and record them as one sale — every sale gets its own ID automatically.',
      stat: saleCount === null ? '…' : `${saleCount} recorded`,
    },
    {
      key: 'sales',
      icon: Banknote,
      title: 'Sales',
      description: 'Every sale made by the hotel, newest first, each with its own ID.',
      stat: saleCount === null ? '…' : `${saleCount} sale${saleCount === 1 ? '' : 's'}`,
    },
    ...(canManageExpenses ? [{
      key: 'expenses',
      icon: Receipt,
      title: 'Expenses',
      description: 'Record everything the hotel spends, e.g. cooking gas, wages, deliveries.',
      stat: expenseCount === null ? '…' : `${expenseCount} expense${expenseCount === 1 ? '' : 's'}`,
    }, {
      key: 'damages',
      icon: PackageOpen,
      title: 'Damage',
      description: 'Record damaged goods — from tracked stock or items not in stock — as plates, items, cups, kg or any other measure.',
      stat: damageCount === null ? '…' : `${damageCount} damage${damageCount === 1 ? '' : 's'}`,
    }] : []),
  ]

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-bold">Purchases</h2>
        <p className="mt-1 text-[12px] text-[#94a3b8]">{view === 'menu'
          ? 'Choose a subsection to work in.'
          : view === 'make-sale'
          ? 'Record one or more items as a single sale, with an optional customer name and contact.'
          : view === 'expenses'
          ? 'Record what the hotel spends and keep track of the money going out.'
          : view === 'damages'
          ? 'Record damaged goods, price the loss and keep the stock count honest.'
          : 'Every sale made by this hotel, newest first, each with its own ID.'}</p>
      </div>
    </div>
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-[#fef2f2] px-3 py-2.5 text-[11px] text-[#dc2626]"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}

    {view === 'menu' && <div className="grid gap-3 sm:grid-cols-2">
      {SUBSECTIONS.map(({ key, icon: Icon, title, description, stat }) => <button key={key} onClick={() => setView(key)} className="group flex flex-col items-start gap-2 rounded-2xl border border-[#e7ebf0] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#fdba74] hover:shadow-md">
        <span className="grid size-10 place-items-center rounded-xl bg-[#fff4ec] text-[#f97316]"><Icon size={19} /></span>
        <span className="flex items-center gap-1 text-[13px] font-bold text-[#0f172a]">{title}<ChevronRight size={14} className="text-[#94a3b8] transition-transform group-hover:translate-x-0.5" /></span>
        <span className="text-[10px] leading-4 text-[#94a3b8]">{description}</span>
        <span className="mt-1 rounded-full bg-[#f1f4f9] px-2 py-0.5 text-[9px] font-semibold text-[#64748b]">{stat}</span>
      </button>)}
    </div>}

    {view === 'make-sale' && <MakeSaleView onError={setError} onViewSales={() => setView('sales')} />}
    {view === 'sales' && <SalesView onError={setError} canApprove={canApprove} hotelId={hotelId} />}
    {view === 'expenses' && <ExpensesView onError={setError} canApprove={canApprove} hotelId={hotelId} />}
    {view === 'damages' && <DamagesView onError={setError} canApprove={canApprove} hotelId={hotelId} />}
  </div>
}

// Units the sale form knows natively; anything else is treated as a custom
// word carried in `customUnit`.
const UNIT_KEYS = UNIT_OPTIONS.map(option => option.key)

// One-line summary of what a sale contains, e.g. "Beef plates ×3, Soda ×2".
// Multi-item sales carry an items array; older single-item sales are shown
// from their top-level name/quantity/unit.
const saleLine = sale => ((Array.isArray(sale.items) && sale.items.length ? sale.items : [{ name: sale.name, quantity: sale.quantity, unit: sale.unit }])
  .map(item => `${item.name || 'Item'}${Number(item.quantity) !== 1 ? ` ×${item.quantity}${item.unit ? ` ${item.unit}` : ''}` : ''}`)
  .join(', '))

// Image of a sale line's stock item, from the sale's stockImages map returned
// by the API; empty when the line is not stock-linked or has no photo.
const saleItemImage = (sale, item) => (sale.stockImages ? sale.stockImages[String(item.stockItemId || '')] || '' : '')

// ---- Shared date filter (Sales and Expenses) — a From/To range over the ----
// ---- record times with quick presets. Empty from/to mean no filter, and ----
// ---- days parse in local time so boundaries hit the hotel's own midnight. ----
const isoDay = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const dayBound = (value, end) => {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  return end ? new Date(y, m - 1, d, 23, 59, 59, 999).getTime() : new Date(y, m - 1, d).getTime()
}
const DATE_PRESETS = [['today', 'Today'], ['week', 'Last 7 days'], ['month', 'This month'], ['all', 'All']]
const presetRange = preset => {
  const now = new Date()
  if (preset === 'all') return { from: '', to: '' }
  if (preset === 'today') return { from: isoDay(now), to: isoDay(now) }
  if (preset === 'week') { const from = new Date(now); from.setDate(from.getDate() - 6); return { from: isoDay(from), to: isoDay(now) } }
  return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDay(now) }
}
const inDayRange = (time, fromBound, toBound) => (fromBound == null || time >= fromBound) && (toBound == null || time <= toBound)

// The From/To date inputs and preset chips shared by the Sales and
// Expenses filters — styled to match the dashboard's date + Filter chips.
function DateFilterRow({ range, setRange }) {
  const inputClass = 'bg-white text-[10px] font-medium text-[#292421] outline-none '
    + '[color-scheme:light] [&::-webkit-calendar-picker-indicator]:opacity-60'
  const chipClass = 'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-[#eadfd9] bg-white px-2.5 py-2 '
    + 'transition focus-within:border-[#e7654b] hover:border-[#e7654b]'
  return <div className="mt-2.5 flex w-full flex-nowrap items-center gap-1.5 overflow-x-auto overscroll-x-contain sm:flex-wrap sm:overflow-visible">
    <label className={chipClass}>
      <CalendarDays size={13} className="shrink-0 text-[#8d817b]" />
      <span className="text-[9px] font-semibold text-[#655a54]">From</span>
      <input type="date" aria-label="Filter from date" value={range.from} max={range.to || undefined} onChange={event => setRange({ ...range, from: event.target.value })} className={inputClass} />
    </label>
    <label className={chipClass}>
      <CalendarDays size={13} className="shrink-0 text-[#8d817b]" />
      <span className="text-[9px] font-semibold text-[#655a54]">To</span>
      <input type="date" aria-label="Filter to date" value={range.to} min={range.from || undefined} max={isoDay(new Date())} onChange={event => setRange({ ...range, to: event.target.value })} className={inputClass} />
    </label>
    {DATE_PRESETS.map(([key, label]) => {
      const target = presetRange(key)
      const active = range.from === target.from && range.to === target.to
      return <button key={key} type="button" onClick={() => setRange(target)} className={cx('shrink-0 whitespace-nowrap rounded-md border px-2.5 py-2 text-[9px] font-semibold transition', active ? 'border-[#e7654b] bg-[#fde3da] text-[#d95c43]' : 'border-[#eadfd9] bg-white text-[#655a54] hover:border-[#e7654b] hover:text-[#d95c43]')}>{label}</button>
    })}
  </div>
}

// ---- Subsection: Sales — every sale made by the hotel, newest first,   ----
// ---- each shown with its own ID. Recording lives in the Make sale tab. ----

function SalesView({ onError, canApprove = false, hotelId }) {
  const [sales, setSales] = useState([])
  const [stats, setStats] = useState({ total: 0, count: 0, todayTotal: 0, todayCount: 0 })
  const [busy, setBusy] = useState(false)
  const [busyAction, setBusyAction] = useState('')
  const [range, setRange] = useState({ from: '', to: '' }) // Date filter: empty from/to = everything.
  const [editing, setEditing] = useState(null) // Unapproved sale being edited.
  const [historyFor, setHistoryFor] = useState(null) // Sale whose change trail is open.

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

  // Live list: the backend broadcasts sales_changed on every record,
  // approve, edit or delete — the list refreshes instantly, no page reload.
  useEffect(() => {
    const socket = io(API_BASE_URL || undefined, { withCredentials: true })
    socket.on('connect', () => {
      socket.emit('join_hotel', hotelId)
    })
    socket.on('sales_changed', load)
    return () => socket.disconnect()
  }, [])

  const removeSale = async sale => {
    if (busy) return
    if (!window.confirm(`Remove the sale "${sale.name}" (${money(sale.amount)})?`)) return
    setBusy(true)
    setBusyAction(`delete:${sale._id}`)
    try {
      await api(`/api/owner/sales/${sale._id}`, { method: 'DELETE' })
      onError('')
      await load()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
      setBusyAction('')
    }
  }

  // The owner — or staff granted the approval permission — signs a sale off.
  // Approved sales are locked: they can no longer be removed.
  const approveSale = async sale => {
    if (busy) return
    setBusy(true)
    setBusyAction(`approve:${sale._id}`)
    try {
      await api(`/api/owner/sales/${sale._id}/approve`, { method: 'POST' })
      onError('')
      await load()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
      setBusyAction('')
    }
  }

  const saleTime = value => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  // Date filter — a From/To range over the sale times plus quick presets.
  // Empty from/to mean no filter.
  const fromBound = dayBound(range.from, false)
  const toBound = dayBound(range.to, true)
  const hasFilter = Boolean(range.from || range.to)
  const filtered = sales.filter(sale => inDayRange(new Date(sale.createdAt).getTime(), fromBound, toBound))
  const filteredTotal = filtered.reduce((sum, sale) => sum + sale.amount, 0)

  return <div className="rounded-xl border border-[#e7ebf0] bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="flex items-center gap-2 font-display text-[15px] font-bold text-[#292421]">Recorded sales
        <span className="rounded-full bg-[#f1f4f9] px-2 py-0.5 text-[9px] font-semibold text-[#64748b]">{stats.count}</span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {hasFilter && <span className="rounded-full bg-[#f97316] px-2.5 py-1 text-[9px] font-semibold text-white">Selected {money(filteredTotal)} · {filtered.length} sale{filtered.length === 1 ? '' : 's'}</span>}
        <span className="rounded-full bg-[#f0fdf4] px-2.5 py-1 text-[9px] font-semibold text-[#16a34a]">Today {money(stats.todayTotal)} · {stats.todayCount} sale{stats.todayCount === 1 ? '' : 's'}</span>
        <span className="rounded-full bg-[#fff4ec] px-2.5 py-1 text-[9px] font-semibold text-[#ea580c]">All time {money(stats.total)}</span>
      </div>
    </div>
    <DateFilterRow range={range} setRange={setRange} />
    {filtered.length > 0 && <ul className="mt-3 divide-y divide-[#f1f5f9]">
      {filtered.map(sale => <li key={sale._id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0f172a]">
            {(() => { const image = saleItemImage(sale, (Array.isArray(sale.items) && sale.items[0]) || sale); return image
              ? <img src={apiAssetUrl(image)} alt="" aria-hidden="true" className="size-6 shrink-0 rounded-md object-cover" />
              : null })()}
            <span className="min-w-0 truncate">{saleLine(sale)}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[9px] text-[#94a3b8]">
            <span className="shrink-0 rounded bg-[#f1f4f9] px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-wide text-[#64748b]">{sale.saleId}</span>
            <span className="truncate">{saleTime(sale.createdAt)}{sale.recordedBy && ` · by ${sale.recordedBy}`}{sale.customerName && ` · for ${sale.customerName}`}{sale.customerContact && ` · ${sale.customerContact}`}{sale.note && ` · ${sale.note}`}</span>
          </p>
          {sale.approved && <p className="mt-0.5 flex items-center gap-1 text-[8px] font-bold text-[#16a34a]"><Check size={10} />Approved{sale.approvedByName && ` by ${sale.approvedByName}`}</p>}
        </div>
        {!sale.approved && canApprove && <button disabled={busy} onClick={() => approveSale(sale)} title={`Approve ${sale.saleId}`} className="flex shrink-0 items-center gap-1 rounded-md bg-[#f0fdf4] px-2 py-1 text-[9px] font-bold text-[#16a34a] transition hover:bg-[#dcfce7] disabled:opacity-50">{busyAction === `approve:${sale._id}` ? <ActionProgress>Approving…</ActionProgress> : <><Check size={11} />Approve</>}</button>}
        {sale.edits?.length > 0 && <button onClick={() => setHistoryFor(sale)} title="See what changed" className="flex shrink-0 items-center gap-1 rounded-md bg-[#fef9ee] px-2 py-1 text-[9px] font-bold text-[#b45309] transition hover:bg-[#fef9ee]"><History size={11} />Edited</button>}
        <span className="shrink-0 text-[11px] font-bold text-[#16a34a]">{money(sale.amount)}</span>
        {!sale.approved && <button disabled={busy} onClick={() => setEditing(sale)} title={`Edit ${sale.saleId}`} className="shrink-0 rounded-md p-1 text-[#94a3b8] transition hover:bg-[#f1f4f9] hover:text-[#0f172a]"><Pencil size={13} /></button>}
        <button disabled={busy || sale.approved} onClick={() => removeSale(sale)} title={sale.approved ? 'Approved — cannot be changed' : `Remove ${sale.name}`} aria-label={busyAction === `delete:${sale._id}` ? `Deleting ${sale.name}` : `Remove ${sale.name}`} className="shrink-0 rounded-md p-1 text-[#f87171] hover:bg-[#fef2f2] hover:text-[#dc2626] disabled:opacity-50">{busyAction === `delete:${sale._id}` ? <ActionProgress><span className="sr-only">Deleting sale…</span></ActionProgress> : <Trash2 size={13} />}</button>
      </li>)}
    </ul>}
    {!filtered.length && <p className="mt-3 rounded-xl border border-dashed border-[#e7ebf0] px-3 py-6 text-center text-[10px] text-[#94a3b8]">{hasFilter ? 'No sales in the selected dates — pick another range or choose All.' : 'No sales made yet — open “Make sale” to record the first one.'}</p>}
    {editing && <EditSaleModal sale={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    {historyFor && <SaleHistoryModal sale={historyFor} onClose={() => setHistoryFor(null)} />}
  </div>
}

// Edit an unapproved sale. Approved sales can no longer be changed — the
// backend rejects it and the edit button is hidden for them anyway.
function EditSaleModal({ sale, onClose, onSaved }) {
  const [items, setItems] = useState(() => (Array.isArray(sale.items) && sale.items.length
    ? sale.items.map(item => ({ name: item.name, quantity: String(item.quantity ?? 1), unit: UNIT_KEYS.includes(item.unit) ? item.unit : 'other', customUnit: UNIT_KEYS.includes(item.unit) ? '' : (item.unit || ''), price: item.quantity ? Math.round((item.amount / item.quantity) * 100) / 100 : item.amount, amount: item.amount, unitPrice: item.quantity ? Math.round((item.amount / item.quantity) * 100) / 100 : null, stockId: item.stockItemId || '', pendingStockId: '', committed: true }))
    : []))
  const [customerName, setCustomerName] = useState(sale.customerName || '')
  const [customerContact, setCustomerContact] = useState(sale.customerContact || '')
  const [note, setNote] = useState(sale.note || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // The hotel's stock supplies the photos shown beside stock-linked lines.
  // A quiet load — if stock cannot be read, lines simply show no photo.
  const [stock, setStock] = useState([])
  useEffect(() => {
    let cancelled = false
    api('/api/stock').then(data => { if (!cancelled) setStock(data.items || []) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const setItem = (index, patch) => setItems(previous => previous.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  const removeItem = index => setItems(previous => previous.filter((_, i) => i !== index))

  const changeQuantity = (index, value) => setItems(previous => previous.map((item, i) => {
    if (i !== index) return item
    const qty = value === '' ? 1 : Number(value)
    const autoPrice = item.unitPrice != null && Number.isFinite(qty) && qty >= 0
    return { ...item, quantity: value, amount: autoPrice ? Math.round(item.unitPrice * qty * 100) / 100 : item.amount }
  }))

  const changePrice = (index, value) => setItems(previous => previous.map((item, i) => {
    if (i !== index) return item
    const unitPrice = value === '' ? null : Number(value)
    const qty = item.quantity === '' ? 1 : Number(item.quantity)
    const ok = unitPrice != null && Number.isFinite(unitPrice) && Number.isFinite(qty) && qty >= 0
    return { ...item, price: value, unitPrice: ok ? unitPrice : null, amount: ok ? Math.round(unitPrice * qty * 100) / 100 : '' }
  }))

  const stepQuantity = (index, delta) => setItems(previous => previous.map((item, i) => {
    if (i !== index) return item
    const qty = Math.max(1, (Number(item.quantity) || 0) + delta)
    const autoPrice = item.unitPrice != null
    return { ...item, quantity: String(qty), amount: autoPrice ? Math.round(item.unitPrice * qty * 100) / 100 : item.amount }
  }))

  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const submit = async event => {
    event.preventDefault()
    if (busy) return
    const payload = []
    for (const [index, item] of items.entries()) {
      const qty = item.quantity === '' ? 1 : Number(item.quantity)
      const value = Number(item.amount)
      if (!item.name.trim()) { setError(`Item ${index + 1}: give it a name.`); return }
      if (!Number.isFinite(value) || value <= 0) { setError(`Item ${index + 1}: enter a valid total.`); return }
      if (!Number.isFinite(qty) || qty < 0) { setError(`Item ${index + 1}: enter a valid quantity.`); return }
      payload.push({ name: item.name.trim(), quantity: qty, unit: unitDisplay(item.unit, item.customUnit.trim()), amount: value, stockItemId: item.stockId || undefined })
    }
    if (!payload.length) { setError('The sale needs at least one item.'); return }
    setBusy(true)
    try {
      await api(`/api/owner/sales/${sale._id}`, { method: 'PATCH', body: JSON.stringify({
        items: payload,
        customerName: customerName.trim(),
        customerContact: customerContact.trim(),
        note: note.trim(),
      }) })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const inputClass = 'w-full rounded-lg border border-[#e7ebf0] bg-white px-3 py-2.5 text-[12px] outline-none focus:border-[#fdba74] focus:ring-2 focus:ring-[#fff4ec]'
  const labelClass = 'mb-1 block text-[10px] font-semibold text-[#64748b]'

  return <Modal title={`Edit sale ${sale.saleId}`} onClose={onClose}>
    <form className="space-y-3.5" onSubmit={submit}>
      <p className="text-[10px] leading-4 text-[#94a3b8]">This sale is not approved yet, so it can still be corrected. The owner will see what it looked like before your change.</p>
      <div className="space-y-2">
        {items.map((item, index) => <div key={index} className="rounded-lg border border-[#e7ebf0] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              {(() => { const image = (item.stockId || item.pendingStockId) && stock.length ? stock.find(entry => String(entry._id) === String(item.stockId || item.pendingStockId))?.imageUrl || '' : ''; return image
                ? <img src={apiAssetUrl(image)} alt="" aria-hidden="true" className="size-6 shrink-0 rounded-md object-cover" />
                : null })()}
              <input aria-label={`Item ${index + 1} name`} value={item.name} onChange={event => setItem(index, { name: event.target.value })} maxLength="60" className={cx(inputClass, 'min-w-0 flex-1')} />
            </span>
            <button type="button" onClick={() => removeItem(index)} title={`Remove ${item.name}`} className="shrink-0 rounded-md p-1.5 text-[#f87171] transition hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={13} /></button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <label className="block"><span className={labelClass}>Qty</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => stepQuantity(index, -1)} aria-label="Decrease quantity" className="grid size-7 shrink-0 place-items-center rounded-md border border-[#e7ebf0] text-[#64748b] hover:bg-[#f1f4f9]"><Minus size={12} /></button>
                <input type="number" min="0" step="0.01" aria-label={`Item ${index + 1} quantity`} value={item.quantity} onChange={event => changeQuantity(index, event.target.value)} className={cx(inputClass, 'px-2 py-1.5 text-center')} />
                <button type="button" onClick={() => stepQuantity(index, 1)} aria-label="Increase quantity" className="grid size-7 shrink-0 place-items-center rounded-md border border-[#e7ebf0] text-[#64748b] hover:bg-[#f1f4f9]"><Plus size={12} /></button>
              </div>
            </label>
            <label className="block"><span className={labelClass}>Price of one</span>
              <input type="number" min="0" step="1" aria-label={`Item ${index + 1} price of one`} value={item.price} onChange={event => changePrice(index, event.target.value)} className={cx(inputClass, 'px-2 py-1.5')} />
            </label>
            <label className="block"><span className={labelClass}>Total</span>
              <input type="number" min="0" step="1" aria-label={`Item ${index + 1} total`} value={item.amount} onChange={event => setItem(index, { amount: Number(event.target.value) || 0, unitPrice: null })} className={cx(inputClass, 'px-2 py-1.5')} />
            </label>
          </div>
        </div>)}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block"><span className={labelClass}>Customer name</span>
          <input value={customerName} onChange={event => setCustomerName(event.target.value)} maxLength="80" placeholder="Optional" className={inputClass} />
        </label>
        <label className="block"><span className={labelClass}>Contact</span>
          <input value={customerContact} onChange={event => setCustomerContact(event.target.value)} maxLength="60" placeholder="Optional" className={inputClass} />
        </label>
      </div>
      <label className="block"><span className={labelClass}>Note</span>
        <input value={note} onChange={event => setNote(event.target.value)} maxLength="200" placeholder="Optional, e.g. paid cash" className={inputClass} />
      </label>
      {error && <p className="text-[11px] text-[#dc2626]">{error}</p>}
      <div className="flex items-center justify-between border-t border-[#f1f5f9] pt-3">
        <span className="text-[10px] font-semibold text-[#64748b]">New total <b className="ml-1 text-[13px] font-bold text-[#0f172a]">{money(total)}</b></span>
        <button disabled={busy} className="rounded-lg bg-[#f97316] px-4 py-2 text-[10px] font-semibold text-white hover:bg-[#ea580c] disabled:opacity-60">{busy ? <ActionProgress>Updating sale…</ActionProgress> : 'Save changes'}</button>
      </div>
    </form>
  </Modal>
}

// The change trail: each edit snapshots what the sale looked like before it.
// Shown to whoever inspects the sale — the owner sees "changed from this to
// this" with who made the change and when.
function SaleHistoryModal({ sale, onClose }) {
  const previous = sale.edits?.length ? sale.edits[sale.edits.length - 1] : null
  return <Modal title={`Changes to ${sale.saleId}`} onClose={onClose}>
    <div className="space-y-3">
      <div className="rounded-lg border border-[#e7ebf0] p-3">
        <p className="text-[10px] font-bold text-[#94a3b8]">CURRENT (after edit)</p>
        <SaleSnapshot name={sale.name} items={sale.items} amount={sale.amount} customerName={sale.customerName} note={sale.note} sale={sale} />
      </div>
      {[...sale.edits].reverse().map((edit, index) => <Fragment key={index}>
        <div className="flex items-center gap-2 text-[9px] font-semibold text-[#b45309]"><ArrowDown size={12} />changed to the block above — by {edit.editedByName || 'staff'} · {new Date(edit.editedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
        <div className="rounded-lg border border-[#f1f5f9] bg-[#f8fafc] p-3">
          <p className="text-[10px] font-bold text-[#94a3b8]">BEFORE{sale.edits.length > 1 && index < sale.edits.length - 1 ? ' (earlier version)' : ''}</p>
          <SaleSnapshot name={edit.name} items={edit.items} amount={edit.amount} customerName={edit.customerName} note={edit.note} />
        </div>
      </Fragment>)}
    </div>
  </Modal>
}

function SaleSnapshot({ name, items, amount, customerName, note, sale }) {
  return <div className="mt-1">
    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0f172a]">
      {(() => { const image = sale ? saleItemImage(sale, (Array.isArray(items) && items[0]) || { stockItemId: null }) : ''; return image
        ? <img src={apiAssetUrl(image)} alt="" aria-hidden="true" className="size-6 shrink-0 rounded-md object-cover" />
        : null })()}
      <span className="min-w-0 truncate">{saleLine({ items, name })}</span>
    </p>
    <p className="mt-0.5 text-[9px] text-[#94a3b8]">{money(amount)}{customerName && ` · for ${customerName}`}{note && ` · ${note}`}</p>
  </div>
}

// ---- Subsection: Make sale — record one sale holding any number of    ----
// ---- items (plates, sodas…), plus an optional customer name and       ----
// ---- contact. The backend stamps every sale with an ID, SAL-000042.   ----

const EMPTY_ITEM = () => ({ name: '', quantity: '1', unit: 'plates', customUnit: '', price: '', amount: '', stockId: '', pendingStockId: '', unitPrice: null, committed: false })

function MakeSaleView({ onError, onViewSales }) {
  const [items, setItems] = useState(() => [EMPTY_ITEM()])
  const [customerName, setCustomerName] = useState('')
  const [customerContact, setCustomerContact] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [recorded, setRecorded] = useState(null) // The sale just saved, with its ID.
  // The hotel's stock powers the item search: picking a stock item fills in
  // its unit and per-unit price, and the line total then follows the qty.
  const [stock, setStock] = useState([])
  const [openSearch, setOpenSearch] = useState(null) // Row whose stock search is open.

  // A quiet load — if stock cannot be read, every item is simply filled in
  // by hand exactly as before.
  useEffect(() => {
    let cancelled = false
    api('/api/stock').then(data => { if (!cancelled) setStock(data.items || []) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const setItem = (index, patch) => setItems(previous => previous.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  // Every list ends with one empty draft row — that row is the adder.
  const withDraft = rows => (rows.some(row => !row.stockId && !row.committed) ? rows : [...rows, EMPTY_ITEM()])
  const removeItem = index => setItems(previous => withDraft(previous.filter((_, i) => i !== index)))

  // Typing a name by hand detaches the row from the stock item (no stock
  // badge, no stock reduction) but keeps the price typed so far.
  const changeName = (index, value) => setItem(index, { name: value, stockId: '', pendingStockId: '' })

  // Searching the hotel's stock by the text typed so far.
  const stockMatches = query => {
    const text = String(query || '').trim().toLowerCase()
    const list = text ? stock.filter(entry => entry.name.toLowerCase().includes(text)) : stock
    return list.slice(0, 8)
  }

  // Picking a stock item fills the row with its unit and the price of one
  // item; the line total is price × qty. The row only joins the sale when
  // Add is clicked, so the user can still adjust the quantity or price.
  const pickStock = (index, stockItem) => {
    setItems(previous => previous.map((item, i) => {
      if (i !== index) return item
      const qty = item.quantity === '' ? 1 : Math.max(0, Number(item.quantity) || 0)
      const unitPrice = stockItem.price ?? 0
      return { ...item, name: stockItem.name, unit: stockItem.unit || 'plates', customUnit: stockItem.customUnit || '', pendingStockId: String(stockItem._id), stockId: '', committed: false, price: String(stockItem.price ?? ''), unitPrice, amount: Math.round(unitPrice * qty * 100) / 100 }
    }))
    setOpenSearch(null)
  }

  // While a line has a per-item price, changing the qty re-prices the total.
  const changeQuantity = (index, value) => setItems(previous => previous.map((item, i) => {
    if (i !== index) return item
    const qty = value === '' ? 1 : Number(value)
    const autoPrice = item.unitPrice != null && Number.isFinite(qty) && qty >= 0
    return { ...item, quantity: value, amount: autoPrice ? Math.round(item.unitPrice * qty * 100) / 100 : item.amount }
  }))

  // The price input holds the price of ONE item — the line total is
  // price × qty and follows along as the quantity changes.
  const changePrice = (index, value) => setItems(previous => previous.map((item, i) => {
    if (i !== index) return item
    const unitPrice = value === '' ? null : Number(value)
    const qty = item.quantity === '' ? 1 : Number(item.quantity)
    const ok = unitPrice != null && Number.isFinite(unitPrice) && Number.isFinite(qty) && qty >= 0
    return { ...item, price: value, unitPrice: ok ? unitPrice : null, amount: ok ? Math.round(unitPrice * qty * 100) / 100 : '' }
  }))

  // The +/− steppers on added lines: change the quantity without typing and
  // re-price the line from its per-unit price. Never below one — use × to
  // drop the line entirely.
  const stepQuantity = (index, delta) => setItems(previous => previous.map((item, i) => {
    if (i !== index) return item
    const qty = Math.max(1, (Number(item.quantity) || 0) + delta)
    const autoPrice = item.unitPrice != null
    return { ...item, quantity: String(qty), amount: autoPrice ? Math.round(item.unitPrice * qty * 100) / 100 : item.amount }
  }))

  // The Add button (or Enter) commits the row into the read-only list:
  // stock-picked rows keep their stock link — merging into an existing line
  // of the same item — and typed rows remember their per-item price so the
  // steppers can re-price them later.
  const addRow = index => {
    const item = items[index]
    if (!item || item.committed) return
    const price = Number(item.price)
    const qty = item.quantity === '' ? 1 : Number(item.quantity)
    if (!item.name.trim()) { setError('Give the item a name, e.g. Beef plates.'); return }
    if (item.price === '' || !Number.isFinite(price) || price <= 0) { setError('Enter the price of one item, e.g. 2000.'); return }
    if (!Number.isFinite(qty) || qty < 0) { setError('Enter a quantity of zero or more.'); return }
    if (!(price * qty > 0)) { setError('The total is zero — enter a quantity of at least one.'); return }
    setError('')
    setItems(previous => {
      if (item.pendingStockId) {
        const duplicateAt = previous.findIndex((row, i) =>
          i !== index && row.name.trim().toLowerCase() === item.name.trim().toLowerCase())
        if (duplicateAt !== -1) {
          // Same item is already on the sale: add this row's qty there and
          // drop the row instead of duplicating it.
          const addedQty = Math.max(1, qty)
          return withDraft(previous
            .map((row, i) => {
              if (i !== duplicateAt) return row
              const mergedQty = Math.max(1, Number(row.quantity) || 1) + addedQty
              const unitPrice = item.unitPrice ?? price
              return { ...row, stockId: row.stockId || item.pendingStockId, unit: item.unit, customUnit: item.customUnit, pendingStockId: '', price: item.price, unitPrice, quantity: String(mergedQty), amount: Math.round(unitPrice * mergedQty * 100) / 100 }
            })
            .filter((_, i) => i !== index))
        }
        return withDraft(previous.map((row, i) => (i === index ? { ...row, stockId: item.pendingStockId, pendingStockId: '', committed: true } : row)))
      }
      return withDraft(previous.map((row, i) => (i === index ? { ...row, committed: true, unitPrice: price } : row)))
    })
  }

  // Live total of everything typed so far, shown above the record button.
  const runningTotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const submit = async event => {
    event.preventDefault()
    if (busy) return
    const payload = []
    // A fully empty trailing draft row is just the adder — skip it.
    const entries = items.filter(item => item.stockId || item.committed || item.pendingStockId || item.name.trim() || item.price.trim() || String(item.amount).trim())
    if (!entries.length) { setError('Add at least one item to record.'); return }
    for (const [index, item] of entries.entries()) {
      const qty = item.quantity === '' ? 1 : Number(item.quantity)
      const price = Number(item.price)
      const value = Number(item.amount)
      if (!item.name.trim()) { setError(`Give item ${index + 1} a name, e.g. Beef plates.`); return }
      if (item.price === '' || !Number.isFinite(price) || price <= 0) { setError(`Item ${index + 1}: enter the price of one item, e.g. 2000.`); return }
      if (!Number.isFinite(qty) || qty < 0) { setError(`Item ${index + 1}: enter a quantity of zero or more.`); return }
      if (!Number.isFinite(value) || value <= 0) { setError(`Item ${index + 1}: the total is zero — enter a quantity of at least one.`); return }
      payload.push({ name: item.name.trim(), quantity: qty, unit: unitDisplay(item.unit, item.customUnit.trim()), amount: value, stockItemId: item.stockId || item.pendingStockId || undefined })
    }
    setBusy(true)
    try {
      const data = await api('/api/owner/sales', { method: 'POST', body: JSON.stringify({
        items: payload,
        customerName: customerName.trim(),
        customerContact: customerContact.trim(),
        note: note.trim(),
      }) })
      setRecorded(data.sale)
      onError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const startAnother = () => {
    setRecorded(null)
    setItems([EMPTY_ITEM()])
    setCustomerName('')
    setCustomerContact('')
    setNote('')
  }

  const inputClass = 'rounded-md border border-[#e7ebf0] bg-white px-2 py-1.5 text-[11px] outline-none transition placeholder:text-[#a8b3c4] focus:border-[#fdba74] focus:ring-2 focus:ring-[#fff4ec]'

  // After a successful save, confirm the sale and show the ID it was given.
  if (recorded) return <div className="mx-auto w-full max-w-xl rounded-xl border border-[#e7ebf0] bg-white p-5">
    <div className="flex flex-col items-center gap-1.5 py-4 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-[#f0fdf4] text-[#16a34a]"><Check size={22} /></span>
      <p className="mt-1 text-[13px] font-bold text-[#0f172a]">Sale recorded</p>
      <p className="text-[10px] text-[#94a3b8]">Saved to this hotel’s sales with its own ID — quote it any time.</p>
      <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
        <span className="rounded-lg bg-[#fff4ec] px-3 py-1.5 font-mono text-[12px] font-bold tracking-wide text-[#ea580c]">{recorded.saleId}</span>
        <span className="text-[12px] font-bold text-[#16a34a]">{money(recorded.amount)}</span>
      </div>
      <p className="mt-1 max-w-sm break-words text-[10px] leading-4 text-[#94a3b8]">{saleLine(recorded)}{recorded.customerName && ` · for ${recorded.customerName}`}{recorded.note && ` · ${recorded.note}`}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button onClick={startAnother} className="flex items-center gap-1.5 rounded-lg bg-[#f97316] px-3.5 py-2 text-[10px] font-semibold text-white hover:bg-[#ea580c]"><Plus size={13} />Record another sale</button>
        <button onClick={onViewSales} className="rounded-lg border border-[#e7ebf0] px-3.5 py-2 text-[10px] font-semibold text-[#64748b] transition hover:border-[#fdba74] hover:text-[#ea580c]">View all sales</button>
      </div>
    </div>
  </div>

  return <div className="mx-auto w-full max-w-2xl rounded-xl border border-[#e7ebf0] bg-white p-4">
    <p className="text-[11px] font-bold text-[#0f172a]">Record a sale</p>
    <p className="mt-0.5 text-[9px] text-[#94a3b8]">Search the stock or type an item and the price of one item, then click Add to put it on the sale — the total is price × quantity.</p>
    <form className="mt-3" onSubmit={submit}>
      <div className="divide-y divide-[#f1f5f9]">
        <div className="hidden gap-1 px-1 pb-1 text-[8px] font-bold uppercase tracking-[.8px] text-[#94a3b8] sm:flex">
          <span className="min-w-0 flex-[2_1_0%]">Item</span>
          <span className="w-[88px] shrink-0 text-center">Qty</span>
          <span className="w-[84px] shrink-0">Unit</span>
          <span className="w-[96px] shrink-0">Amount (UGX)</span>
          <span className="w-[64px] shrink-0" />
          <span className="w-7 shrink-0" />
        </div>
        {items.map((item, index) => {
          const locked = item.stockId || item.committed
          // Stock-picked lines show the stock entry's photo so the staff sees
          // the same item face everywhere.
          const stockImage = (item.stockId || item.pendingStockId) && stock.length
            ? stock.find(entry => String(entry._id) === String(item.stockId || item.pendingStockId))?.imageUrl || ''
            : ''
          return <div key={index} className="py-1 first:pt-0">
            {locked ? (
              // Added lines — picked from stock or typed in — show as plain
              // text: no borders and nothing to type. The steppers change the
              // quantity, and × removes the line.
              <div className="flex flex-wrap items-center gap-1">
                <div className="min-w-0 flex-[1_1_100%] sm:flex-[2_1_0%]">
                  <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold text-[#0f172a]">
                    {stockImage && <img src={apiAssetUrl(stockImage)} alt="" aria-hidden="true" className="size-6 shrink-0 rounded-md object-cover" />}
                    <span className="min-w-0 truncate">{item.name}</span>
                    {item.stockId && <span className="shrink-0 rounded bg-[#f0fdf4] px-1 py-0.5 text-[8px] font-bold text-[#16a34a]">stock</span>}
                  </p>
                  <p className="px-1 text-[8px] text-[#94a3b8]">{money(item.unitPrice)} per {unitDisplay(item.unit, item.customUnit)}{item.stockId && ' · reduces stock when recorded'}</p>
                </div>
                <span className="flex w-[88px] shrink-0 items-center justify-center gap-0.5">
                  <button type="button" onClick={() => stepQuantity(index, -1)} aria-label={`Decrease ${item.name} quantity`} className="grid size-5 place-items-center rounded-md text-[#64748b] transition hover:bg-[#f1f4f9] hover:text-[#0f172a]"><Minus size={11} /></button>
                  <span className="min-w-4 text-center text-[11px] font-semibold text-[#0f172a]">{item.quantity}</span>
                  <button type="button" onClick={() => stepQuantity(index, 1)} aria-label={`Increase ${item.name} quantity`} className="grid size-5 place-items-center rounded-md text-[#64748b] transition hover:bg-[#f1f4f9] hover:text-[#0f172a]"><Plus size={11} /></button>
                </span>
                <span className="w-[84px] shrink-0 truncate text-[10px] text-[#64748b]">{unitDisplay(item.unit, item.customUnit)}</span>
                <span className="w-[96px] shrink-0 truncate text-right text-[11px] font-semibold text-[#0f172a]">{money(item.amount)}</span>
                <span className="w-[64px] shrink-0" />
                <button type="button" onClick={() => removeItem(index)} title={`Remove ${item.name}`} className="grid size-7 shrink-0 place-items-center rounded-md text-[#f87171] transition hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={12} /></button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1">
                <div className="relative min-w-0 flex-[1_1_100%] sm:flex-[2_1_0%]">
                  <input aria-label={`Item ${index + 1} name`} value={item.name} onChange={event => { changeName(index, event.target.value); setOpenSearch(index) }} onFocus={() => setOpenSearch(index)} onBlur={() => setTimeout(() => setOpenSearch(current => (current === index ? null : current)), 120)} onKeyDown={event => {
                    if (event.key === 'Escape') { setOpenSearch(null); return }
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    const matches = stockMatches(item.name)
                    if (matches.length === 1) pickStock(index, matches[0])
                    else if (!matches.length) addRow(index)
                  }} maxLength="60" placeholder="Search stock or type an item" autoFocus={index === items.length - 1} className={cx(inputClass, 'w-full')} />
                  {openSearch === index && <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-[#e7ebf0] bg-white shadow-lg">
                    {stockMatches(item.name).map(stockItem => <button key={stockItem._id} type="button" onMouseDown={() => pickStock(index, stockItem)} className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left transition hover:bg-[#fff6ee]">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {stockItem.imageUrl
                          ? <img src={apiAssetUrl(stockItem.imageUrl)} alt="" aria-hidden="true" className="size-6 shrink-0 rounded-md object-cover" />
                          : <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-md bg-[#f1f5f9] text-[#e2e8f0]"><PackageOpen size={11} /></span>}
                        <span className="min-w-0 truncate text-[10px] font-semibold text-[#0f172a]">{stockItem.name}</span>
                      </span>
                      <span className="shrink-0 text-[8px] text-[#94a3b8]">{money(stockItem.price)}/{unitDisplay(stockItem.unit, stockItem.customUnit)}{Number(stockItem.plates) > 0 && ` · ${stockItem.plates} in stock`}</span>
                    </button>)}
                    {!stockMatches(item.name).length && <p className="px-2.5 py-2 text-[9px] text-[#94a3b8]">Not in stock — set the price, then click Add.</p>}
                  </div>}
                </div>
                <input type="number" min="0" step="0.01" aria-label={`Item ${index + 1} quantity`} value={item.quantity} onChange={event => changeQuantity(index, event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addRow(index) } }} className={cx(inputClass, 'w-[88px] shrink-0 text-center')} />
                <select aria-label={`Item ${index + 1} unit`} value={item.unit} onChange={event => setItem(index, { unit: event.target.value, customUnit: '' })} className={cx(inputClass, 'w-[84px] shrink-0')}>
                  {UNIT_OPTIONS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
                </select>
                <input type="number" min="0" step="1" aria-label={`Item ${index + 1} price of one item in UGX`} placeholder="Price of one" value={item.price} onChange={event => changePrice(index, event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addRow(index) } }} className={cx(inputClass, 'w-[96px] shrink-0')} />
                <button type="button" onClick={() => addRow(index)} disabled={!item.name.trim() && !String(item.amount).trim()} title="Add the item to the sale" className="flex w-[64px] shrink-0 items-center justify-center gap-1 rounded-md bg-[#f97316] px-2 py-1.5 text-[10px] font-semibold text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-50"><Plus size={12} />Add</button>
                {(item.name.trim() || String(item.amount).trim()) && <button type="button" onClick={() => removeItem(index)} title={`Remove ${item.name || `item ${index + 1}`}`} className="grid size-7 shrink-0 place-items-center rounded-md text-[#f87171] transition hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={12} /></button>}
              </div>
            )}
          </div>
        })}
      </div>

      <div className="mt-2 grid gap-1.5 border-t border-[#f1f5f9] pt-2.5 sm:grid-cols-2">
        <input aria-label="Customer name" value={customerName} onChange={event => setCustomerName(event.target.value)} maxLength="80" placeholder="Customer name — optional" className={inputClass} />
        <input aria-label="Customer contact" value={customerContact} onChange={event => setCustomerContact(event.target.value)} maxLength="60" placeholder="Contact — optional" className={inputClass} />
      </div>
      <input aria-label="Note" value={note} onChange={event => setNote(event.target.value)} maxLength="200" placeholder="Note — optional, e.g. paid cash" className={cx(inputClass, 'mt-1.5')} />

      {error && <p className="mt-2 text-[11px] text-[#dc2626]">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#f1f5f9] pt-3">
        <span className="text-[10px] font-semibold text-[#64748b]">Sale total <b className="ml-1 text-[13px] font-bold text-[#0f172a]">{money(runningTotal)}</b></span>
        <button disabled={busy} className="rounded-lg bg-[#f97316] px-4 py-2 text-[10px] font-semibold text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60">{busy ? <ActionProgress>Recording sale…</ActionProgress> : 'Record sale'}</button>
      </div>
    </form>
  </div>
}

// ---- Subsection: Expenses — everything the hotel spends, filed under the ----
// ---- expense categories managed in Categories > Expenses in the sidebar. ----

function ExpensesView({ onError, canApprove = false, hotelId }) {
  const [expenses, setExpenses] = useState([])
  const [byCategory, setByCategory] = useState([])
  const [stats, setStats] = useState({ total: 0, count: 0, todayTotal: 0, todayCount: 0 })
  const [busy, setBusy] = useState(false)
  const [busyAction, setBusyAction] = useState('')
  const [showPopup, setShowPopup] = useState(false)
  const [editing, setEditing] = useState(null)
  const [historyFor, setHistoryFor] = useState(null)
  const [range, setRange] = useState({ from: '', to: '' }) // Date filter: empty from/to = everything.

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

  // Live list: expenses broadcast expenses_changed on record, approve or
  // delete — the list refreshes instantly, no page reload.
  useEffect(() => {
    const socket = io(API_BASE_URL || undefined, { withCredentials: true })
    socket.on('connect', () => {
      socket.emit('join_hotel', hotelId)
    })
    socket.on('expenses_changed', load)
    return () => socket.disconnect()
  }, [])

  const removeExpense = async expense => {
    if (busy) return
    const label = expense.note ? `${expense.categoryName} — ${expense.note}` : expense.categoryName
    if (!window.confirm(`Remove the ${money(expense.amount)} expense for ${label}?`)) return
    setBusy(true)
    setBusyAction(`delete:${expense._id}`)
    try {
      await api(`/api/owner/expenses/${expense._id}`, { method: 'DELETE' })
      onError('')
      await load()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
      setBusyAction('')
    }
  }

  // The owner — or staff granted the approval permission — signs an expense
  // off. Approved expenses are locked: they can no longer be removed.
  const approveExpense = async expense => {
    if (busy) return
    setBusy(true)
    setBusyAction(`approve:${expense._id}`)
    try {
      await api(`/api/owner/expenses/${expense._id}/approve`, { method: 'POST' })
      onError('')
      await load()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
      setBusyAction('')
    }
  }

  const expenseTime = value => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  // Date filter — the same From/To range and presets as the Sales list.
  const fromBound = dayBound(range.from, false)
  const toBound = dayBound(range.to, true)
  const hasFilter = Boolean(range.from || range.to)
  const filtered = expenses.filter(expense => inDayRange(new Date(expense.createdAt).getTime(), fromBound, toBound))
  const filteredTotal = filtered.reduce((sum, expense) => sum + expense.amount, 0)

  return <div className="rounded-xl border border-[#e7ebf0] bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="flex items-center gap-2 font-display text-[15px] font-bold text-[#292421]">Recorded expenses
        <span className="rounded-full bg-[#f1f4f9] px-2 py-0.5 text-[9px] font-semibold text-[#64748b]">{stats.count}</span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {hasFilter && <span className="rounded-full bg-[#f97316] px-2.5 py-1 text-[9px] font-semibold text-white">Selected {money(filteredTotal)} · {filtered.length} expense{filtered.length === 1 ? '' : 's'}</span>}
        <span className="rounded-full bg-[#fef2f2] px-2.5 py-1 text-[9px] font-semibold text-[#dc2626]">Today {money(stats.todayTotal)} · {stats.todayCount} expense{stats.todayCount === 1 ? '' : 's'}</span>
        <span className="rounded-full bg-[#f1f4f9] px-2.5 py-1 text-[9px] font-semibold text-[#64748b]">All time {money(stats.total)}</span>
        <button onClick={() => setShowPopup(true)} className="flex items-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-2 text-[10px] font-semibold text-white hover:bg-[#ea580c]"><Plus size={13} />Record expense</button>
      </div>
    </div>
    <DateFilterRow range={range} setRange={setRange} />
    {byCategory.length > 0 && <div className="mt-2.5 flex flex-wrap gap-1.5">
      {byCategory.map(entry => <span key={entry.category} className="rounded-full bg-[#f8fafc] px-2.5 py-1 text-[9px] font-semibold text-[#64748b]">{entry.category} · {money(entry.total)} ({entry.count})</span>)}
    </div>}
    {filtered.length > 0 && <ul className="mt-4 grid gap-3 md:grid-cols-2">
      {filtered.map(expense => <li key={expense._id} className="flex min-w-0 flex-col rounded-2xl border border-[#e7ebf0] bg-white p-4 shadow-sm transition hover:border-[#fdba74] hover:shadow-md sm:p-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="break-words text-[14px] font-bold leading-5 text-[#0f172a]">{expense.categoryName}</p>
            <p className="mt-1 text-[11px] leading-4 text-[#64748b]">{expenseTime(expense.createdAt)}{expense.recordedBy && ` · by ${expense.recordedBy}`}</p>
          </div>
          <span className="shrink-0 rounded-xl bg-[#fff4ec] px-3 py-2 text-[13px] font-bold text-[#c2410c]">−{money(expense.amount)}</span>
        </div>
        {expense.note && <p className="mt-3 break-words rounded-lg bg-[#f8fafc] px-3 py-2 text-[12px] leading-5 text-[#475569]">{expense.note}</p>}
        {expense.approved && <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-[#15803d]"><Check size={13} />Approved{expense.approvedByName && ` by ${expense.approvedByName}`}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#f1f5f9] pt-3">
          {!expense.approved && canApprove && <button disabled={busy} onClick={() => approveExpense(expense)} title="Approve expense" className="flex items-center gap-1.5 rounded-lg bg-[#f0fdf4] px-3 py-2 text-[11px] font-semibold text-[#15803d] transition hover:bg-[#dcfce7] disabled:opacity-50">{busyAction === `approve:${expense._id}` ? <ActionProgress>Approving…</ActionProgress> : <><Check size={13} />Approve</>}</button>}
          {!expense.approved && <button disabled={busy} onClick={() => setEditing(expense)} title={`Edit ${expense.categoryName} expense`} className="flex items-center gap-1.5 rounded-lg bg-[#fff4ec] px-3 py-2 text-[11px] font-semibold text-[#c2410c] transition hover:bg-[#ffedd5] disabled:opacity-50"><Pencil size={13} />Edit</button>}
          {expense.edits?.length > 0 && <button onClick={() => setHistoryFor(expense)} title="See what changed" className="flex items-center gap-1.5 rounded-lg bg-[#fef9ee] px-3 py-2 text-[11px] font-semibold text-[#a16207] transition hover:bg-[#fef3c7]"><History size={13} />Edited</button>}
          <button disabled={busy || expense.approved} onClick={() => removeExpense(expense)} title={expense.approved ? 'Approved — cannot be changed' : `Remove ${expense.categoryName} expense`} aria-label={busyAction === `delete:${expense._id}` ? `Deleting ${expense.categoryName} expense` : `Remove ${expense.categoryName} expense`} className="ml-auto rounded-lg p-2 text-[#f87171] transition hover:bg-[#fef2f2] hover:text-[#dc2626] disabled:opacity-50">{busyAction === `delete:${expense._id}` ? <ActionProgress><span className="sr-only">Deleting expense…</span></ActionProgress> : <Trash2 size={15} />}</button>
        </div>
      </li>)}
    </ul>}
    {!filtered.length && <p className="mt-3 rounded-xl border border-dashed border-[#e7ebf0] px-3 py-6 text-center text-[10px] text-[#94a3b8]">{hasFilter ? 'No expenses in the selected dates — pick another range or choose All.' : 'No expenses recorded yet — click “Record expense” above to record your first one.'}</p>}
    {showPopup && <RecordExpenseModal onClose={() => setShowPopup(false)} onSaved={() => { setShowPopup(false); load() }} />}
    {editing && <EditExpenseModal expense={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    {historyFor && <ExpenseHistoryModal expense={historyFor} onClose={() => setHistoryFor(null)} />}
  </div>
}

// ---- Subsection: Damage — record goods lost to spoilage, breakage or  ----
// ---- spillage, either from tracked stock (its count drops) or items   ----
// ---- not in stock. Units follow the system: plates, items, cups, kg,  ----
// ---- or any custom word. Stock-picked rows price the loss from the    ----
// ---- stock's unit value; deleting a record restores the stock.        ----

function DamagesView({ onError, canApprove = false, hotelId }) {
  const [damages, setDamages] = useState([])
  const [stats, setStats] = useState({ total: 0, count: 0, todayTotal: 0, todayCount: 0 })
  const [busy, setBusy] = useState(false)
  const [busyAction, setBusyAction] = useState('')
  const [showPopup, setShowPopup] = useState(false)
  const [editing, setEditing] = useState(null)
  const [historyFor, setHistoryFor] = useState(null)
  const [range, setRange] = useState({ from: '', to: '' })

  const load = async () => {
    try {
      const data = await api('/api/owner/damages')
      setDamages(data.damages)
      setStats({ total: data.total, count: data.count, todayTotal: data.todayTotal, todayCount: data.todayCount })
      onError('')
    } catch (err) {
      onError(err.message)
    }
  }
  useEffect(() => { load() }, [])

  // Live list: damages broadcast damages_changed on record or delete.
  useEffect(() => {
    const socket = io(API_BASE_URL || undefined, { withCredentials: true })
    socket.on('connect', () => {
      socket.emit('join_hotel', hotelId)
    })
    socket.on('damages_changed', load)
    return () => socket.disconnect()
  }, [])

  const removeDamage = async damage => {
    if (busy) return
    const label = damage.note ? `${damage.name} — ${damage.note}` : damage.name
    if (!window.confirm(`Remove the damage record for ${label}?${damage.stockItem ? ' The stock count it drew down will be restored.' : ''}`)) return
    setBusy(true)
    setBusyAction(`delete:${damage._id}`)
    try {
      await api(`/api/owner/damages/${damage._id}`, { method: 'DELETE' })
      onError('')
      await load()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
      setBusyAction('')
    }
  }

  // The owner — or staff granted the approval permission — signs a damage
  // off. Once approved it is locked: no more edits or removals.
  const approveDamage = async damage => {
    if (busy) return
    setBusy(true)
    setBusyAction(`approve:${damage._id}`)
    try {
      await api(`/api/owner/damages/${damage._id}/approve`, { method: 'POST' })
      onError('')
      await load()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
      setBusyAction('')
    }
  }

  const damageTime = value => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  // Date filter — the same From/To range and presets as Sales and Expenses.
  const fromBound = dayBound(range.from, false)
  const toBound = dayBound(range.to, true)
  const hasFilter = Boolean(range.from || range.to)
  const filtered = damages.filter(damage => inDayRange(new Date(damage.createdAt).getTime(), fromBound, toBound))
  const filteredTotal = filtered.reduce((sum, damage) => sum + damage.value, 0)

  return <div className="rounded-xl border border-[#e7ebf0] bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="flex items-center gap-2 font-display text-[15px] font-bold text-[#292421]">Recorded damage
        <span className="rounded-full bg-[#f1f4f9] px-2 py-0.5 text-[9px] font-semibold text-[#64748b]">{stats.count}</span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {hasFilter && <span className="rounded-full bg-[#f97316] px-2.5 py-1 text-[9px] font-semibold text-white">Selected {money(filteredTotal)} · {filtered.length} record{filtered.length === 1 ? '' : 's'}</span>}
        <span className="rounded-full bg-[#fef2f2] px-2.5 py-1 text-[9px] font-semibold text-[#dc2626]">Today {money(stats.todayTotal)} · {stats.todayCount} record{stats.todayCount === 1 ? '' : 's'}</span>
        <span className="rounded-full bg-[#f1f4f9] px-2.5 py-1 text-[9px] font-semibold text-[#64748b]">All time {money(stats.total)}</span>
        <button onClick={() => setShowPopup(true)} className="flex items-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-2 text-[10px] font-semibold text-white hover:bg-[#ea580c]"><Plus size={13} />Record damage</button>
      </div>
    </div>
    <DateFilterRow range={range} setRange={setRange} />
    {filtered.length > 0 && <ul className="mt-3 divide-y divide-[#f1f5f9]">
      {filtered.map(damage => <li key={damage._id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
        {damage.stockItem?.imageUrl
          ? <img src={apiAssetUrl(damage.stockItem.imageUrl)} alt="" aria-hidden="true" className="size-7 shrink-0 rounded-md object-cover" />
          : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-[#0f172a]">
            {damage.name}
            <span className="ml-1.5 font-normal text-[#94a3b8]">{damage.quantity} {damage.unit || 'units'}</span>
          </p>
          <p className="mt-0.5 truncate text-[9px] text-[#94a3b8]">{damageTime(damage.createdAt)}{damage.recordedBy && ` · by ${damage.recordedBy}`}{damage.stockItem && ` · from stock: ${damage.stockItem.name}`}{damage.note && ` · ${damage.note}`}</p>
          {damage.approved && <p className="mt-0.5 flex items-center gap-1 text-[8px] font-bold text-[#16a34a]"><Check size={10} />Approved{damage.approvedByName && ` by ${damage.approvedByName}`}</p>}
        </div>
        {!damage.approved && canApprove && <button disabled={busy} onClick={() => approveDamage(damage)} title="Approve damage record" className="flex shrink-0 items-center gap-1 rounded-md bg-[#f0fdf4] px-2 py-1 text-[9px] font-bold text-[#16a34a] transition hover:bg-[#dcfce7] disabled:opacity-50">{busyAction === `approve:${damage._id}` ? <ActionProgress>Approving…</ActionProgress> : <><Check size={11} />Approve</>}</button>}
      {!damage.approved && <button disabled={busy} onClick={() => setEditing(damage)} title={`Edit ${damage.name} damage`} className="flex shrink-0 items-center gap-1 rounded-md bg-[#fff4ec] px-2 py-1 text-[9px] font-bold text-[#ea580c] transition hover:bg-[#ffedd5] disabled:opacity-50"><Pencil size={11} />Edit</button>}
      {damage.edits?.length > 0 && <button onClick={() => setHistoryFor(damage)} title="See what changed" className="flex shrink-0 items-center gap-1 rounded-md bg-[#fef9ee] px-2 py-1 text-[9px] font-bold text-[#b45309] transition hover:bg-[#fef3c7]"><History size={11} />Edited</button>}
      <span className="shrink-0 text-[11px] font-bold text-[#dc2626]">−{money(damage.value)}</span>
      <button disabled={busy || damage.approved} onClick={() => removeDamage(damage)} title={damage.approved ? 'Approved — cannot be changed' : 'Remove record'} aria-label={busyAction === `delete:${damage._id}` ? `Deleting ${damage.name}` : `Remove ${damage.name}`} className="shrink-0 rounded-md p-1 text-[#f87171] hover:bg-[#fef2f2] hover:text-[#dc2626] disabled:opacity-50">{busyAction === `delete:${damage._id}` ? <ActionProgress><span className="sr-only">Deleting damage record…</span></ActionProgress> : <Trash2 size={13} />}</button>
    </li>)}
  </ul>}
  {!filtered.length && <p className="mt-3 rounded-xl border border-dashed border-[#e7ebf0] px-3 py-6 text-center text-[10px] text-[#94a3b8]">{hasFilter ? 'No damage records in the selected dates — pick another range or choose All.' : 'No damage recorded yet — click “Record damage” above to record your first one.'}</p>}
  {showPopup && <RecordDamageModal onClose={() => setShowPopup(false)} onSaved={() => { setShowPopup(false); load() }} />}
  {editing && <EditDamageModal damage={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
  {historyFor && <DamageHistoryModal damage={historyFor} onClose={() => setHistoryFor(null)} />}
  </div>
}

// ---- Popup for recording one damage — pick an item from the hotel's ----
// ---- stock (its count drops and the loss is priced from the stock's ----
// ---- unit value) or record something not in stock with its own value. ----

function RecordDamageModal({ onClose, onSaved }) {
  // The hotel's stock powers the item search, exactly as in Make sale.
  const [stock, setStock] = useState([])
  const [mode, setMode] = useState(null) // 'stock' | 'other'
  const [name, setName] = useState('')
  const [stockId, setStockId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('plates')
  const [customUnit, setCustomUnit] = useState('')
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // A quiet load — if stock cannot be read, 'other' mode still works.
  useEffect(() => {
    let cancelled = false
    api('/api/stock').then(data => {
      if (cancelled) return
      setStock(data.items || [])
      setMode((data.items || []).length ? 'stock' : 'other')
    }).catch(() => { if (!cancelled) setMode('other') })
    return () => { cancelled = true }
  }, [])

  const stockMatches = query => {
    const text = String(query || '').trim().toLowerCase()
    const list = text ? stock.filter(entry => entry.name.toLowerCase().includes(text)) : stock
    return list.slice(0, 8)
  }

  // Picking a stock item fills in its unit and shows the per-unit value;
  // the loss value is computed from the unit price × quantity.
  const pickedStock = stock.find(entry => String(entry._id) === stockId) || null
  const unitWord = pickedStock
    ? unitDisplay(pickedStock.unit, pickedStock.customUnit || '')
    : unit === 'other' ? (customUnit.trim() || 'units') : unit
  const unitPrice = pickedStock ? (pickedStock.price ?? 0) : null
  const computedValue = unitPrice != null && Number(quantity) > 0
    ? Math.round(unitPrice * Number(quantity) * 100) / 100
    : null

  const pickedName = event => {
    setName(event.target.value)
    setStockId('')
  }

  const submit = async event => {
    event.preventDefault()
    if (busy) return
    const qty = quantity === '' ? 1 : Number(quantity)
    const label = pickedStock ? pickedStock.name : name
    if (!label.trim()) { setError('Give the damaged item a name, e.g. Beef plates.'); return }
    if (!Number.isFinite(qty) || qty <= 0) { setError('Enter the quantity that was damaged.'); return }
    if (pickedStock && pickedStock.plates < qty) {
      setError(`Only ${pickedStock.plates} ${unitWord} of ${pickedStock.name} in stock — you cannot record damage of ${qty}.`)
      return
    }
    setBusy(true)
    try {
      const payload = { name: label.trim(), quantity: qty, unit: unitWord, note: note.trim() }
      if (pickedStock) payload.stockItemId = pickedStock._id
      else {
        const money = Number(value)
        if (!Number.isFinite(money) || money <= 0) { setError('Enter the money value of what was damaged.'); setBusy(false); return }
        payload.value = money
      }
      await api('/api/owner/damages', { method: 'POST', body: JSON.stringify(payload) })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const inputClass = 'w-full rounded-lg border border-[#e7ebf0] bg-white px-3 py-2.5 text-[12px] outline-none focus:border-[#fdba74] focus:ring-2 focus:ring-[#fff4ec]'
  const labelClass = 'mb-1.5 block text-[10px] font-semibold text-[#64748b]'
  const modeButton = active => cx('rounded-md px-2 py-1.5 text-[10px] font-semibold transition', active ? 'bg-white text-[#f97316] shadow-sm' : 'text-[#64748b] hover:text-[#0f172a]')

  return <Modal title="Record damage" onClose={onClose}>
    <form className="space-y-3.5" onSubmit={submit}>
      {stock.length > 0 && <div>
        <span className={labelClass}>Where is it from? <span className="text-[#dc2626]">*</span></span>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#f1f4f9] p-1">
          <button type="button" onClick={() => { setMode('stock'); setName(''); setStockId('') }} className={modeButton(mode === 'stock')}>From stock</button>
          <button type="button" onClick={() => { setMode('other'); setName(''); setStockId('') }} className={modeButton(mode === 'other')}>Not in stock</button>
        </div>
      </div>}
      {stock.length === 0 && <p className="rounded-lg bg-[#fff7e8] px-3 py-2 text-[10px] leading-4 text-[#a85f18]">No stock items yet — recording in “not in stock” mode. Add stock under Stock in the sidebar to draw damage from tracked items.</p>}

      {mode === 'stock'
        ? <div>
            <span className={labelClass}>Stock item <span className="text-[#dc2626]">*</span></span>
            <select autoFocus value={stockId} onChange={event => { setStockId(event.target.value); setName('') }} className={cx(inputClass, 'mt-0.5')}>
              <option value="">Choose a stock item…</option>
              {stock.map(item => <option key={item._id} value={item._id}>{item.name} — {item.plates} {unitDisplay(item.unit, item.customUnit || '')} in stock</option>)}
            </select>
            {pickedStock && <p className="mt-1.5 flex items-center gap-1.5 text-[9px] text-[#94a3b8]">
              {pickedStock.imageUrl && <img src={apiAssetUrl(pickedStock.imageUrl)} alt={pickedStock.name} className="size-7 shrink-0 rounded-md object-cover" />}
              Priced from stock: {money(pickedStock.price)} per {unitWord} — the count drops when recorded.
            </p>}
          </div>
        : <label className="block"><span className={labelClass}>Damaged item name <span className="text-[#dc2626]">*</span></span>
            <input required autoFocus="autoFocus" value={name} onChange={pickedName} maxLength="60" placeholder="e.g. Broken plates, spoilt beef" className={inputClass} />
          </label>}
      {/* Name is derived from the picked stock item in stock mode. */}

      <div className="grid grid-cols-3 gap-2">
        <label className="block"><span className={labelClass}>Quantity <span className="text-[#dc2626]">*</span></span>
          <input required type="number" min="0.01" step="0.01" value={quantity} onChange={event => setQuantity(event.target.value)} placeholder="e.g. 3" className={inputClass} />
        </label>
        {!pickedStock && <label className="block"><span className={labelClass}>Unit</span>
          <select value={unit} onChange={event => setUnit(event.target.value)} className={inputClass}>
            {UNIT_OPTIONS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
        </label>}
        {!pickedStock && unit === 'other' && <label className="block"><span className={labelClass}>Unit name</span>
          <input value={customUnit} onChange={event => setCustomUnit(event.target.value)} maxLength="20" placeholder="e.g. crates" className={inputClass} />
        </label>}
      </div>

      {mode === 'other' && <label className="block"><span className={labelClass}>Value of damage (UGX) <span className="text-[#dc2626]">*</span></span>
        <input required type="number" min="0" step="1" value={value} onChange={event => setValue(event.target.value)} placeholder="e.g. 15000" className={inputClass} />
      </label>}
      {pickedStock && <p className="rounded-lg bg-[#fff7e8] px-3 py-2 text-[10px] text-[#a85f18]">Loss value: <b>{computedValue != null ? money(computedValue) : '—'}</b> ({money(pickedStock.price)} × {quantity || 1} {unitWord})</p>}

      <label className="block"><span className={labelClass}>Note — optional</span>
        <input value={note} onChange={event => setNote(event.target.value)} maxLength="200" placeholder="e.g. fell, spillage during prep" className={inputClass} />
      </label>

      {error && <p className="text-[11px] text-[#dc2626]">{error}</p>}
      <button disabled={busy || mode === null || (mode === 'stock' && !pickedStock)} className="w-full rounded-lg bg-[#f97316] py-2.5 text-[11px] font-semibold text-white hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60">{busy ? <ActionProgress>Recording damage…</ActionProgress> : 'Record damage'}</button>
    </form>
  </Modal>
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
    if (busy) return
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

  const inputClass = 'w-full rounded-lg border border-[#e7ebf0] bg-white px-3 py-2.5 text-[12px] outline-none focus:border-[#fdba74] focus:ring-2 focus:ring-[#fff4ec]'
  const labelClass = 'mb-1.5 block text-[10px] font-semibold text-[#64748b]'
  const modeButton = active => cx('rounded-md px-2 py-1.5 text-[10px] font-semibold transition', active ? 'bg-white text-[#f97316] shadow-sm' : 'text-[#64748b] hover:text-[#0f172a]')

  return <Modal title="Record expense" onClose={onClose}>
    <form className="space-y-3.5" onSubmit={submit}>
      <div>
        <span className={labelClass}>Category <span className="text-[#dc2626]">*</span></span>
        {categories === null ? <p className="text-[10px] text-[#94a3b8]">Loading categories…</p> : <>
          {categories.length > 0 && <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#f1f4f9] p-1">
            <button type="button" onClick={() => setMode('existing')} className={modeButton(mode === 'existing')}>Pick a category</button>
            <button type="button" onClick={() => setMode('new')} className={modeButton(mode === 'new')}>New category</button>
          </div>}
          {mode === 'existing' && <select autoFocus value={categoryId} onChange={event => setCategoryId(event.target.value)} className={cx(inputClass, 'mt-2')}>
            <option value="">Choose a category…</option>
            {categories.map(category => <option key={category._id} value={category._id}>{category.name}</option>)}
          </select>}
          {mode === 'new' && <input required autoFocus value={newName} onChange={event => setNewName(event.target.value)} maxLength="60" placeholder="Category name, e.g. Cooking gas" className={cx(inputClass, 'mt-2')} />}
          <p className="mt-1.5 text-[9px] leading-4 text-[#94a3b8]">{categories.length
            ? 'Categories are the same expense categories managed under Categories > Expenses in the sidebar.'
            : 'No expense categories yet — type a name to create your first one. You can manage them under Categories > Expenses.'}</p>
        </>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className={labelClass}>Amount (UGX) <span className="text-[#dc2626]">*</span></span>
          <input required type="number" min="0" step="1" value={amount} onChange={event => setAmount(event.target.value)} placeholder="e.g. 25000" className={inputClass} />
        </label>
        <label className="block"><span className={labelClass}>Note — optional</span>
          <input value={note} onChange={event => setNote(event.target.value)} maxLength="200" placeholder="e.g. gas refill" className={inputClass} />
        </label>
      </div>

      {error && <p className="text-[11px] text-[#dc2626]">{error}</p>}
      <button disabled={busy || mode === null} className="w-full rounded-lg bg-[#f97316] py-2.5 text-[11px] font-semibold text-white hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60">{busy ? <ActionProgress>Recording expense…</ActionProgress> : 'Record expense'}</button>
    </form>
  </Modal>
}

// ---- Edit an unapproved expense until it is approved; approved ones are ----
// ---- locked. Each save snapshots what it was before into the trail.   ----

function EditExpenseModal({ expense, onClose, onSaved }) {
  const [mode, setMode] = useState('existing') // 'existing' | 'new'
  const [categoryId, setCategoryId] = useState(expense.category || '')
  const [newName, setNewName] = useState('')
  const [amount, setAmount] = useState(String(expense.amount ?? ''))
  const [note, setNote] = useState(expense.note || '')
  const [categories, setCategories] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    api('/api/owner/expense-categories').then(data => {
      if (cancelled) return
      const list = data.categories || []
      // Keep the expense's current category selectable even if renamed.
      if (expense.categoryName && !list.some(category => String(category._id) === String(expense.category))) {
        list.unshift({ _id: expense.category, name: expense.categoryName })
      }
      setCategories(list)
    }).catch(() => { if (!cancelled) setCategories([]) })
    return () => { cancelled = true }
  }, [expense])

  const submit = async event => {
    event.preventDefault()
    if (busy) return
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) { setError('Enter an expense amount greater than zero.'); return }
    const body = { amount: value, note: note.trim() }
    if (mode === 'new') {
      if (!newName.trim()) { setError('Name the category, e.g. Cooking gas.'); return }
      body.categoryName = newName.trim()
    } else if (categoryId) {
      body.categoryId = categoryId
    }
    setBusy(true)
    try {
      await api(`/api/owner/expenses/${expense._id}`, { method: 'PATCH', body: JSON.stringify(body) })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const inputClass = 'w-full rounded-lg border border-[#e7ebf0] bg-white px-3 py-2.5 text-[12px] outline-none focus:border-[#fdba74] focus:ring-2 focus:ring-[#fff4ec]'
  const labelClass = 'mb-1.5 block text-[10px] font-semibold text-[#64748b]'
  const modeButton = active => cx('rounded-md px-2 py-1.5 text-[10px] font-semibold transition', active ? 'bg-white text-[#f97316] shadow-sm' : 'text-[#64748b] hover:text-[#0f172a]')

  return <Modal title={`Edit expense — ${expense.categoryName}`} onClose={onClose}>
    <form className="space-y-3.5" onSubmit={submit}>
      <p className="text-[10px] leading-4 text-[#94a3b8]">This expense is not approved yet, so it can still be corrected. The owner will see what it looked like before your change.</p>
      <div>
        <span className={labelClass}>Category <span className="text-[#dc2626]">*</span></span>
        {categories === null ? <p className="text-[10px] text-[#94a3b8]">Loading categories…</p> : <>
          {categories.length > 0 && <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#f1f4f9] p-1">
            <button type="button" onClick={() => setMode('existing')} className={modeButton(mode === 'existing')}>Pick a category</button>
            <button type="button" onClick={() => setMode('new')} className={modeButton(mode === 'new')}>New category</button>
          </div>}
          {mode === 'existing' && <select value={categoryId} onChange={event => setCategoryId(event.target.value)} className={cx(inputClass, 'mt-2')}>
            <option value="">Keep current ({expense.categoryName})</option>
            {categories.map(category => <option key={category._id} value={category._id}>{category.name}</option>)}
          </select>}
          {mode === 'new' && <input required value={newName} onChange={event => setNewName(event.target.value)} maxLength="60" placeholder="Category name, e.g. Cooking gas" className={cx(inputClass, 'mt-2')} />}
        </>}
      </div>
      <label className="block"><span className={labelClass}>Amount (UGX) <span className="text-[#dc2626]">*</span></span>
        <input required type="number" min="0" step="1" value={amount} onChange={event => setAmount(event.target.value)} placeholder="e.g. 25000" className={inputClass} />
      </label>
      <label className="block"><span className={labelClass}>Note — optional</span>
        <input value={note} onChange={event => setNote(event.target.value)} maxLength="200" placeholder="e.g. gas refill" className={inputClass} />
      </label>
      {error && <p className="text-[11px] text-[#dc2626]">{error}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-[#f97316] py-2.5 text-[11px] font-semibold text-white hover:bg-[#ea580c] disabled:opacity-60">{busy ? <ActionProgress>Updating expense…</ActionProgress> : 'Save changes'}</button>
    </form>
  </Modal>
}

// The change trail: each edit snapshots what the expense looked like before it.
function ExpenseHistoryModal({ expense, onClose }) {
  const previous = expense.edits?.length ? expense.edits[expense.edits.length - 1] : null
  return <Modal title={`Changes to ${expense.categoryName}`} onClose={onClose}>
    <div className="space-y-3">
      <div className="rounded-lg border border-[#e7ebf0] p-3">
        <p className="text-[10px] font-bold text-[#94a3b8]">CURRENT (after edit)</p>
        <p className="text-[11px] font-semibold text-[#0f172a]">{expense.categoryName} — {money(expense.amount)}</p>
        <p className="mt-0.5 text-[9px] text-[#94a3b8]">{expense.note || 'no note'}</p>
      </div>
      {previous && <>
        <div className="flex items-center gap-2 text-[9px] font-semibold text-[#b45309]"><ArrowDown size={12} />changed to the block above — by {previous.editedByName || 'staff'} · {new Date(previous.editedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
        <div className="rounded-lg border border-[#f1f5f9] bg-[#f8fafc] p-3">
          <p className="text-[10px] font-bold text-[#94a3b8]">BEFORE{expense.edits.length > 1 ? ` (${expense.edits.length} edit${expense.edits.length === 1 ? '' : 's'} total, latest shown)` : ''}</p>
          <p className="text-[11px] font-semibold text-[#0f172a]">{previous.categoryName || expense.categoryName} — {money(previous.amount)}</p>
          <p className="mt-0.5 text-[9px] text-[#94a3b8]">{previous.note || 'no note'}</p>
        </div>
      </>}
      {!previous && <p className="text-[10px] text-[#94a3b8]">No edits recorded yet.</p>}
    </div>
  </Modal>
}

// ---- Edit an unapproved damage until it is approved; approved ones are ----
// ---- locked. Stock-picked records re-price from the stock's unit value. ----

function EditDamageModal({ damage, onClose, onSaved }) {
  const [stock, setStock] = useState([])
  const [mode, setMode] = useState(damage.stockItem || damage.stockItemId ? 'stock' : 'other') // 'stock' | 'other'
  const [hasStockList, setHasStockList] = useState(null) // whether the hotel has any stock
  const [name, setName] = useState(damage.name || '')
  const [stockId, setStockId] = useState('')
  const [quantity, setQuantity] = useState(String(damage.quantity ?? 1))
  const [value, setValue] = useState(damage.stockItem ? '' : String(damage.value ?? ''))
  const [note, setNote] = useState(damage.note || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // A quiet load — if stock cannot be read, 'other' mode still works.
  useEffect(() => {
    let cancelled = false
    api('/api/stock').then(data => {
      if (cancelled) return
      const list = data.items || []
      setHasStockList(Boolean(list.length))
      // Keep the record's current stock link selectable even if the entry
      // is missing from the live list.
      if (damage.stockItem && damage.stockItem._id && !list.some(entry => String(entry._id) === String(damage.stockItem._id))) {
        list.unshift({ _id: damage.stockItem._id, name: damage.stockItem.name })
      }
      setStock(list)
      if (!list.length) setMode('other')
    }).catch(() => { if (!cancelled) setHasStockList(false) })
    return () => { cancelled = true }
  }, [damage])

  const pickedStock = stock.find(entry => String(entry._id) === String(stockId)) || null
  const unitWord = pickedStock ? unitDisplay(pickedStock.unit, pickedStock.customUnit || '') : 'units'
  const unitPrice = pickedStock ? (pickedStock.price ?? 0) : null
  const computedValue = unitPrice != null && Number(quantity) > 0
    ? Math.round(unitPrice * Number(quantity) * 100) / 100
    : null

  const submit = async event => {
    event.preventDefault()
    if (busy) return
    const qty = quantity === '' ? 1 : Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) { setError('Enter the quantity that was damaged.'); return }
    const body = { name: name.trim() || damage.name, quantity: qty, note: note.trim() }
    if (mode === 'stock' && pickedStock) {
      body.stockItemId = pickedStock._id
    } else {
      body.stockItemId = null
      const money = Number(value)
      if (!Number.isFinite(money) || money <= 0) { setError('Enter the money value of what was damaged.'); return }
      body.value = money
    }
    setBusy(true)
    try {
      await api(`/api/owner/damages/${damage._id}`, { method: 'PATCH', body: JSON.stringify(body) })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const inputClass = 'w-full rounded-lg border border-[#e7ebf0] bg-white px-3 py-2.5 text-[12px] outline-none focus:border-[#fdba74] focus:ring-2 focus:ring-[#fff4ec]'
  const labelClass = 'mb-1.5 block text-[10px] font-semibold text-[#64748b]'
  const modeButton = active => cx('rounded-md px-2 py-1.5 text-[10px] font-semibold transition', active ? 'bg-white text-[#f97316] shadow-sm' : 'text-[#64748b] hover:text-[#0f172a]')

  return <Modal title={`Edit damage — ${damage.name}`} onClose={onClose}>
    <form className="space-y-3.5" onSubmit={submit}>
      <p className="text-[10px] leading-4 text-[#94a3b8]">This record is not approved yet, so it can still be corrected. The stock count follows the change, and the owner will see what it looked like before.</p>
      {hasStockList && <div>
        <span className={labelClass}>Where is it from? <span className="text-[#dc2626]">*</span></span>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#f1f4f9] p-1">
          <button type="button" onClick={() => { setMode('stock'); setStockId('') }} className={modeButton(mode === 'stock')}>From stock</button>
          <button type="button" onClick={() => { setMode('other') }} className={modeButton(mode === 'other')}>Not in stock</button>
        </div>
      </div>}
      {mode === 'stock'
        ? <div>
            <span className={labelClass}>Stock item <span className="text-[#dc2626]">*</span></span>
            <select value={stockId} onChange={event => setStockId(event.target.value)} className={cx(inputClass, 'mt-0.5')}>
              <option value="">Keep current{(damage.stockItem ? ` (${damage.stockItem.name})` : '')}</option>
              {stock.map(item => <option key={item._id} value={item._id}>{item.name} — {item.plates} {unitDisplay(item.unit, item.customUnit || '')} in stock</option>)}
            </select>
            {pickedStock && <p className="mt-1.5 flex items-center gap-1.5 text-[9px] text-[#94a3b8]">
              {pickedStock.imageUrl && <img src={apiAssetUrl(pickedStock.imageUrl)} alt={pickedStock.name} className="size-7 shrink-0 rounded-md object-cover" />}
              Priced from stock: {money(pickedStock.price)} per {unitWord} — the count follows the correction.
            </p>}
          </div>
        : <label className="block"><span className={labelClass}>Damaged item name <span className="text-[#dc2626]">*</span></span>
            <input required value={name} onChange={event => setName(event.target.value)} maxLength="60" placeholder="e.g. Broken plates, spoilt beef" className={inputClass} />
          </label>}

      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className={labelClass}>Quantity <span className="text-[#dc2626]">*</span></span>
          <input required type="number" min="0.01" step="0.01" value={quantity} onChange={event => setQuantity(event.target.value)} placeholder="e.g. 3" className={inputClass} />
        </label>
        {mode === 'other' && <label className="block"><span className={labelClass}>Value of damage (UGX) <span className="text-[#dc2626]">*</span></span>
          <input required type="number" min="0" step="1" value={value} onChange={event => setValue(event.target.value)} placeholder="e.g. 15000" className={inputClass} />
        </label>}
      </div>
      {mode === 'stock' && pickedStock && <p className="rounded-lg bg-[#fff7e8] px-3 py-2 text-[10px] text-[#a85f18]">Loss value: <b>{computedValue != null ? money(computedValue) : '—'}</b> ({money(pickedStock.price)} × {quantity || 1} {unitWord})</p>}

      <label className="block"><span className={labelClass}>Note — optional</span>
        <input value={note} onChange={event => setNote(event.target.value)} maxLength="200" placeholder="e.g. fell, spillage during prep" className={inputClass} />
      </label>

      {error && <p className="text-[11px] text-[#dc2626]">{error}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-[#f97316] py-2.5 text-[11px] font-semibold text-white hover:bg-[#ea580c] disabled:opacity-60">{busy ? <ActionProgress>Updating damage record…</ActionProgress> : 'Save changes'}</button>
    </form>
  </Modal>
}

// The change trail: each edit snapshots what the damage looked like before it.
function DamageHistoryModal({ damage, onClose }) {
  const previous = damage.edits?.length ? damage.edits[damage.edits.length - 1] : null
  return <Modal title={`Changes to ${damage.name}`} onClose={onClose}>
    <div className="space-y-3">
      <div className="rounded-lg border border-[#e7ebf0] p-3">
        <p className="text-[10px] font-bold text-[#94a3b8]">CURRENT (after edit)</p>
        <p className="text-[11px] font-semibold text-[#0f172a]">{damage.name} — {damage.quantity} {damage.unit || 'units'} — {money(damage.value)}</p>
        <p className="mt-0.5 text-[9px] text-[#94a3b8]">{damage.note || 'no note'}</p>
      </div>
      {previous && <Fragment>
        <div className="flex items-center gap-2 text-[9px] font-semibold text-[#b45309]"><ArrowDown size={12} />changed to the block above — by {previous.editedByName || 'staff'} · {new Date(previous.editedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
        <div className="rounded-lg border border-[#f1f5f9] bg-[#f8fafc] p-3">
          <p className="text-[10px] font-bold text-[#94a3b8]">BEFORE{damage.edits.length > 1 ? ` (${damage.edits.length} edit${damage.edits.length === 1 ? '' : 's'} total, latest shown)` : ''}</p>
          <p className="text-[11px] font-semibold text-[#0f172a]">{previous.name || damage.name} — {previous.quantity} units — {money(previous.value)}</p>
          <p className="mt-0.5 text-[9px] text-[#94a3b8]">{previous.note || 'no note'}</p>
        </div>
      </Fragment>}
      {!previous && <p className="text-[10px] text-[#94a3b8]">No edits recorded yet.</p>}
    </div>
  </Modal>
}

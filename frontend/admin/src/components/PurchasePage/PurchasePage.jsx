import { useEffect, useState } from 'react'
import {
  BadgePlus, Banknote, Check, ChevronRight, Minus, Plus, Receipt, Trash2,
} from 'lucide-react'
import { api } from '../../lib/api.js'
import { money, cx, UNIT_OPTIONS, unitDisplay } from '../../lib/ui.js'
import { Modal } from '../Modal/Modal.jsx'

// The independent Purchase page. Clicking "Purchase" in the sidebar lands
// here and shows its subsections — Make sale, Sales and Expenses — each
// opening its own workspace, the same way Categories shows Food type and
// Expenses.
export function PurchasePage({ initialView = 'menu', canManageExpenses = true }) {
  const [view, setView] = useState(initialView) // 'menu' | 'make-sale' | 'sales' | 'expenses'
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
    }] : []),
  ]

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-bold">Purchase</h2>
        <p className="mt-1 text-[12px] text-[#8d9389]">{view === 'menu'
          ? 'Choose a subsection to work in.'
          : view === 'make-sale'
          ? 'Record one or more items as a single sale, with an optional customer name and contact.'
          : view === 'expenses'
          ? 'Record what the hotel spends and keep track of the money going out.'
          : 'Every sale made by this hotel, newest first, each with its own ID.'}</p>
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

    {view === 'make-sale' && <MakeSaleView onError={setError} onViewSales={() => setView('sales')} />}
    {view === 'sales' && <SalesView onError={setError} />}
    {view === 'expenses' && <ExpensesView onError={setError} />}
  </div>
}

// One-line summary of what a sale contains, e.g. "Beef plates ×3, Soda ×2".
// Multi-item sales carry an items array; older single-item sales are shown
// from their top-level name/quantity/unit.
const saleLine = sale => ((Array.isArray(sale.items) && sale.items.length ? sale.items : [{ name: sale.name, quantity: sale.quantity, unit: sale.unit }])
  .map(item => `${item.name || 'Item'}${Number(item.quantity) !== 1 ? ` ×${item.quantity}${item.unit ? ` ${item.unit}` : ''}` : ''}`)
  .join(', '))

// ---- Subsection: Sales — every sale made by the hotel, newest first,   ----
// ---- each shown with its own ID. Recording lives in the Make sale tab. ----

function SalesView({ onError }) {
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
    {sales.length > 0 && <ul className="mt-3 divide-y divide-[#f1f2ee]">
      {sales.map(sale => <li key={sale._id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-[#3d443a]">{saleLine(sale)}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[9px] text-[#9b9f96]">
            <span className="shrink-0 rounded bg-[#f4f4f0] px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-wide text-[#757c71]">{sale.saleId}</span>
            <span className="truncate">{saleTime(sale.createdAt)}{sale.recordedBy && ` · by ${sale.recordedBy}`}{sale.customerName && ` · for ${sale.customerName}`}{sale.customerContact && ` · ${sale.customerContact}`}{sale.note && ` · ${sale.note}`}</span>
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-bold text-[#3f8f3a]">{money(sale.amount)}</span>
        <button disabled={busy} onClick={() => removeSale(sale)} title={`Remove ${sale.name}`} className="shrink-0 rounded-md p-1 text-[#c08b7e] hover:bg-[#fae9e5] hover:text-[#b75c48] disabled:opacity-50"><Trash2 size={13} /></button>
      </li>)}
    </ul>}
    {!sales.length && <p className="mt-3 rounded-xl border border-dashed border-[#e6e9e1] px-3 py-6 text-center text-[10px] text-[#9b9f96]">No sales made yet — open “Make sale” to record the first one.</p>}
  </div>
}

// ---- Subsection: Make sale — record one sale holding any number of    ----
// ---- items (plates, sodas…), plus an optional customer name and       ----
// ---- contact. The backend stamps every sale with an ID, SAL-000042.   ----

const EMPTY_ITEM = () => ({ name: '', quantity: '1', unit: 'plates', customUnit: '', amount: '', stockId: '', unitPrice: null, manualPrice: false })

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
  const addItem = () => setItems(previous => [...previous, EMPTY_ITEM()])
  const removeItem = index => setItems(previous => previous.filter((_, i) => i !== index))

  // Typing a name by hand always detaches the row from stock pricing.
  const changeName = (index, value) => setItem(index, { name: value, stockId: '', unitPrice: null, manualPrice: false })

  // Searching the hotel's stock by the text typed so far.
  const stockMatches = query => {
    const text = String(query || '').trim().toLowerCase()
    const list = text ? stock.filter(entry => entry.name.toLowerCase().includes(text)) : stock
    return list.slice(0, 8)
  }

  // Picking a stock item fills its unit and per-unit price and prices the
  // line at price × qty. If the same item is already on another line, that
  // line just grows — no duplicate rows. The amount can still be edited by
  // hand afterwards.
  const pickStock = (index, stockItem) => {
    setItems(previous => {
      const duplicateAt = previous.findIndex((item, i) =>
        i !== index && item.name.trim().toLowerCase() === stockItem.name.trim().toLowerCase())
      if (duplicateAt === -1) {
        return previous.map((item, i) => {
          if (i !== index) return item
          const qty = item.quantity === '' ? 1 : Math.max(0, Number(item.quantity) || 0)
          const unitPrice = stockItem.price ?? 0
          return { ...item, name: stockItem.name, unit: stockItem.unit || 'plates', customUnit: stockItem.customUnit || '', stockId: String(stockItem._id), unitPrice, manualPrice: false, amount: Math.round(unitPrice * qty * 100) / 100 }
        })
      }
      // Merge into the existing line: add this row's qty and re-price from
      // stock, then drop the row that would have duplicated it.
      const addedQty = Math.max(1, Number(previous[index].quantity) || 1)
      return previous
        .map((item, i) => {
          if (i !== duplicateAt) return item
          const qty = Math.max(1, Number(item.quantity) || 1) + addedQty
          const unitPrice = stockItem.price ?? 0
          return { ...item, name: stockItem.name, unit: stockItem.unit || 'plates', customUnit: stockItem.customUnit || '', stockId: String(stockItem._id), unitPrice, manualPrice: false, quantity: String(qty), amount: Math.round(unitPrice * qty * 100) / 100 }
        })
        .filter((_, i) => i !== index)
    })
    setOpenSearch(null)
  }

  // While a line is priced from stock, changing the qty re-prices it.
  const changeQuantity = (index, value) => setItems(previous => previous.map((item, i) => {
    if (i !== index) return item
    const qty = value === '' ? 1 : Number(value)
    const autoPrice = item.stockId && !item.manualPrice && item.unitPrice != null && Number.isFinite(qty) && qty >= 0
    return { ...item, quantity: value, amount: autoPrice ? Math.round(item.unitPrice * qty * 100) / 100 : item.amount }
  }))

  // Editing the amount by hand stops the automatic re-pricing.
  const changeAmount = (index, value) => setItem(index, { amount: value, manualPrice: true })

  // The +/− steppers on stock lines: change the quantity without typing and
  // re-price the line from the stock price. Never below one — use × to drop
  // the line entirely.
  const stepQuantity = (index, delta) => setItems(previous => previous.map((item, i) => {
    if (i !== index) return item
    const qty = Math.max(1, (Number(item.quantity) || 0) + delta)
    const autoPrice = item.stockId && !item.manualPrice && item.unitPrice != null
    return { ...item, quantity: String(qty), amount: autoPrice ? Math.round(item.unitPrice * qty * 100) / 100 : item.amount }
  }))

  // Live total of everything typed so far, shown above the record button.
  const runningTotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const submit = async event => {
    event.preventDefault()
    const payload = []
    for (const [index, item] of items.entries()) {
      const qty = item.quantity === '' ? 1 : Number(item.quantity)
      const value = Number(item.amount)
      if (!item.name.trim()) { setError(`Give item ${index + 1} a name, e.g. Beef plates.`); return }
      if (!Number.isFinite(qty) || qty < 0) { setError(`Item ${index + 1}: enter a quantity of zero or more.`); return }
      if (!Number.isFinite(value) || value <= 0) { setError(`Item ${index + 1}: enter the amount it brought in.`); return }
      payload.push({ name: item.name.trim(), quantity: qty, unit: unitDisplay(item.unit, item.customUnit.trim()), amount: value, stockItemId: item.stockId || undefined })
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

  const inputClass = 'rounded-md border border-[#e6e9e1] bg-white px-2 py-1.5 text-[11px] outline-none transition placeholder:text-[#b0b4ac] focus:border-[#dca875] focus:ring-2 focus:ring-[#fff1e6]'

  // After a successful save, confirm the sale and show the ID it was given.
  if (recorded) return <div className="mx-auto w-full max-w-2xl rounded-xl border border-[#eceee8] bg-white p-5">
    <div className="flex flex-col items-center gap-1.5 py-4 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-[#eef6ec] text-[#3f8f3a]"><Check size={22} /></span>
      <p className="mt-1 text-[13px] font-bold text-[#293128]">Sale recorded</p>
      <p className="text-[10px] text-[#8d9389]">Saved to this hotel’s sales with its own ID — quote it any time.</p>
      <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
        <span className="rounded-lg bg-[#fff1e6] px-3 py-1.5 font-mono text-[12px] font-bold tracking-wide text-[#a34b16]">{recorded.saleId}</span>
        <span className="text-[12px] font-bold text-[#3f8f3a]">{money(recorded.amount)}</span>
      </div>
      <p className="mt-1 max-w-sm break-words text-[10px] leading-4 text-[#9b9f96]">{saleLine(recorded)}{recorded.customerName && ` · for ${recorded.customerName}`}{recorded.note && ` · ${recorded.note}`}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button onClick={startAnother} className="flex items-center gap-1.5 rounded-lg bg-[#c65d1b] px-3.5 py-2 text-[10px] font-semibold text-white hover:bg-[#a34b16]"><Plus size={13} />Record another sale</button>
        <button onClick={onViewSales} className="rounded-lg border border-[#e6e9e1] px-3.5 py-2 text-[10px] font-semibold text-[#757c71] transition hover:border-[#dca875] hover:text-[#a34b16]">View all sales</button>
      </div>
    </div>
  </div>

  return <div className="mx-auto w-full max-w-2xl rounded-xl border border-[#eceee8] bg-white p-4">
    <p className="text-[11px] font-bold text-[#3d443a]">Record a sale</p>
    <p className="mt-0.5 text-[9px] text-[#9b9f96]">Search the stock to pull an item in with its price, or type something new and enter its price by hand. Everything records as one sale.</p>
    <form className="mt-3" onSubmit={submit}>
      <div className="divide-y divide-[#f1f2ee]">
        <div className="hidden gap-1.5 px-1 pb-1 text-[8px] font-bold uppercase tracking-[.8px] text-[#9b9f96] sm:flex">
          <span className="min-w-0 flex-[2_1_0%]">Item</span>
          <span className="w-[88px] shrink-0 text-center">Qty</span>
          <span className="w-[84px] shrink-0">Unit</span>
          <span className="w-[96px] shrink-0">Amount (UGX)</span>
          <span className="w-7 shrink-0" />
        </div>
        {items.map((item, index) => <div key={index} className="py-1.5 first:pt-0">
          {item.stockId ? (
            // A line picked from stock shows as plain text — no borders and
            // nothing to type. Its quantity grows by picking the same stock
            // item again, and the line is removed with the × button.
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="min-w-0 flex-[1_1_100%] sm:flex-[2_1_0%]">
                <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold text-[#3d443a]">
                  <span className="min-w-0 truncate">{item.name}</span>
                  <span className="shrink-0 rounded bg-[#eef6ec] px-1 py-0.5 text-[8px] font-bold text-[#3f8f3a]">stock</span>
                </p>
                <p className="px-1 text-[8px] text-[#9b9f96]">{money(item.unitPrice)} per {unitDisplay(item.unit, item.customUnit)} · reduces stock when recorded</p>
              </div>
              <span className="flex w-[88px] shrink-0 items-center justify-center gap-0.5">
                <button type="button" onClick={() => stepQuantity(index, -1)} aria-label={`Decrease ${item.name} quantity`} className="grid size-5 place-items-center rounded-md text-[#757c71] transition hover:bg-[#f4f4f0] hover:text-[#3d443a]"><Minus size={11} /></button>
                <span className="min-w-4 text-center text-[11px] font-semibold text-[#3d443a]">{item.quantity}</span>
                <button type="button" onClick={() => stepQuantity(index, 1)} aria-label={`Increase ${item.name} quantity`} className="grid size-5 place-items-center rounded-md text-[#757c71] transition hover:bg-[#f4f4f0] hover:text-[#3d443a]"><Plus size={11} /></button>
              </span>
              <span className="w-[84px] shrink-0 truncate text-[10px] text-[#757c71]">{unitDisplay(item.unit, item.customUnit)}</span>
              <span className="w-[96px] shrink-0 truncate text-right text-[11px] font-semibold text-[#3d443a]">{money(item.amount)}</span>
              {items.length > 1 && <button type="button" onClick={() => removeItem(index)} title={`Remove ${item.name}`} className="grid size-7 shrink-0 place-items-center rounded-md text-[#c08b7e] transition hover:bg-[#fae9e5] hover:text-[#b75c48]"><Trash2 size={12} /></button>}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="relative min-w-0 flex-[1_1_100%] sm:flex-[2_1_0%]">
                  <input required aria-label={`Item ${index + 1} name`} value={item.name} onChange={event => { changeName(index, event.target.value); setOpenSearch(index) }} onFocus={() => setOpenSearch(index)} onBlur={() => setTimeout(() => setOpenSearch(current => (current === index ? null : current)), 120)} onKeyDown={event => { if (event.key === 'Escape') setOpenSearch(null) }} maxLength="60" placeholder="Search stock or type an item…" autoFocus={index === 0} className={cx(inputClass, 'w-full')} />
                  {openSearch === index && <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-[#e6e9e1] bg-white shadow-lg">
                    {stockMatches(item.name).map(stockItem => <button key={stockItem._id} type="button" onMouseDown={() => pickStock(index, stockItem)} className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left transition hover:bg-[#fff4eb]">
                      <span className="min-w-0 truncate text-[10px] font-semibold text-[#3d443a]">{stockItem.name}</span>
                      <span className="shrink-0 text-[8px] text-[#9b9f96]">{money(stockItem.price)}/{unitDisplay(stockItem.unit, stockItem.customUnit)}{Number(stockItem.plates) > 0 && ` · ${stockItem.plates} in stock`}</span>
                    </button>)}
                    {!stockMatches(item.name).length && <p className="px-2.5 py-2 text-[9px] text-[#9b9f96]">Not in stock — type the item and enter its price by hand.</p>}
                  </div>}
                </div>
                <input type="number" min="0" step="0.01" aria-label={`Item ${index + 1} quantity`} value={item.quantity} onChange={event => changeQuantity(index, event.target.value)} className={cx(inputClass, 'w-[88px] shrink-0 text-center')} />
                <select aria-label={`Item ${index + 1} unit`} value={item.unit} onChange={event => setItem(index, { unit: event.target.value, customUnit: '' })} className={cx(inputClass, 'w-[84px] shrink-0')}>
                  {UNIT_OPTIONS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
                </select>
                <input required type="number" min="0" step="1" aria-label={`Item ${index + 1} amount in UGX`} placeholder="15000" value={item.amount} onChange={event => changeAmount(index, event.target.value)} className={cx(inputClass, 'w-[96px] shrink-0')} />
                {items.length > 1 && <button type="button" onClick={() => removeItem(index)} title={`Remove ${item.name || `item ${index + 1}`}`} className="grid size-7 shrink-0 place-items-center rounded-md text-[#c08b7e] transition hover:bg-[#fae9e5] hover:text-[#b75c48]"><Trash2 size={12} /></button>}
              </div>
              {item.unit === 'other' && <input value={item.customUnit} onChange={event => setItem(index, { customUnit: event.target.value })} maxLength="20" placeholder="Unit name, e.g. crates" className={cx(inputClass, 'ml-auto mt-1 block w-44')} />}
            </>
          )}
        </div>)}
      </div>
      <button type="button" onClick={addItem} className="mt-1 flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold text-[#a34b16] transition hover:bg-[#fff4eb]"><Plus size={12} />Add item</button>

      <div className="mt-2 grid gap-1.5 border-t border-[#f1f2ee] pt-2.5 sm:grid-cols-2">
        <input aria-label="Customer name" value={customerName} onChange={event => setCustomerName(event.target.value)} maxLength="80" placeholder="Customer name — optional" className={inputClass} />
        <input aria-label="Customer contact" value={customerContact} onChange={event => setCustomerContact(event.target.value)} maxLength="60" placeholder="Contact — optional" className={inputClass} />
      </div>
      <input aria-label="Note" value={note} onChange={event => setNote(event.target.value)} maxLength="200" placeholder="Note — optional, e.g. paid cash" className={cx(inputClass, 'mt-1.5')} />

      {error && <p className="mt-2 text-[11px] text-[#b75c48]">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#f1f2ee] pt-3">
        <span className="text-[10px] font-semibold text-[#757c71]">Sale total <b className="ml-1 text-[13px] font-bold text-[#293128]">{money(runningTotal)}</b></span>
        <button disabled={busy} className="rounded-lg bg-[#c65d1b] px-4 py-2 text-[10px] font-semibold text-white transition hover:bg-[#a34b16] disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Recording…' : 'Record sale'}</button>
      </div>
    </form>
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

import { useEffect, useState } from 'react'
import {
  Banknote, ChevronRight, Plus, Trash2,
} from 'lucide-react'
import { api } from '../../lib/api.js'
import { money, cx, UNIT_OPTIONS, unitDisplay } from '../../lib/ui.js'
import { Modal } from '../Modal/Modal.jsx'

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

// ---- Popup for recording one sale — search the kitchen stock, or type ----
// ---- an item that is not tracked in stock at all. Either way the seller ----
// ---- chooses the unit (plate, item, cup, kg or their own) per sale. ----

function RecordSaleModal({ onClose, onSaved }) {
  const [stockItems, setStockItems] = useState(null) // null while loading
  const [mode, setMode] = useState(null) // 'stock' | 'custom'
  const [form, setForm] = useState({ stockId: '', name: '', quantity: '1', amount: '', note: '' })
  const [stockQuery, setStockQuery] = useState('')
  const [showMatches, setShowMatches] = useState(false)
  const [unit, setUnit] = useState('plates')
  const [customUnit, setCustomUnit] = useState('')
  const [amountTouched, setAmountTouched] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // The kitchen stock list powers the search; if it cannot load, recording
  // still works by typing the item by hand.
  useEffect(() => {
    let cancelled = false
    api('/api/stock').then(data => {
      if (cancelled) return
      const items = data.items || []
      setStockItems(items)
      setMode(items.length ? 'stock' : 'custom')
    }).catch(() => {
      if (cancelled) return
      setStockItems([])
      setMode('custom')
    })
    return () => { cancelled = true }
  }, [])

  const selectedItem = (stockItems || []).find(item => item._id === form.stockId)
  const query = stockQuery.trim().toLowerCase()
  const matches = (stockItems || []).filter(item => !query || item.name.toLowerCase().includes(query))
  const chosenUnit = unitDisplay(unit, customUnit)
  const quantity = Number(form.quantity)
  const overStock = mode === 'stock' && selectedItem && Number.isFinite(quantity) && quantity > selectedItem.plates

  // Picking a search result fills the name, syncs the unit buttons to the
  // stock entry's own unit, and suggests the money the sale brings in
  // (per-unit price × quantity); the amount stays editable.
  const pickItem = item => {
    setForm(prev => ({ ...prev, stockId: item._id, name: item.name, amount: String(Math.round((item.price || 0) * (Number(prev.quantity) || 0) * 100) / 100) }))
    setStockQuery(item.name)
    setUnit(item.unit || 'plates')
    setCustomUnit(item.customUnit || '')
    setAmountTouched(false)
    setShowMatches(false)
  }

  const setQuantity = value => {
    setForm(prev => {
      const next = { ...prev, quantity: value }
      if (mode === 'stock' && selectedItem && !amountTouched) {
        const quantity = Number(value) || 0
        next.amount = String(Math.round((selectedItem.price || 0) * quantity * 100) / 100)
      }
      return next
    })
  }

  const submit = async event => {
    event.preventDefault()
    const name = (mode === 'stock' ? selectedItem?.name : form.name).trim()
    if (!name) { setError(mode === 'stock' ? 'Search and pick what was sold, or switch to “Not in stock”.' : 'Write what was sold.'); return }
    if (unit === 'other' && !customUnit.trim()) { setError('Name the unit, e.g. crate or tray.'); return }
    const quantity = form.quantity === '' ? 1 : Number(form.quantity)
    const amount = Number(form.amount)
    if (!Number.isFinite(quantity) || quantity <= 0) { setError('Enter how many were sold.'); return }
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter the amount the sale brought in.'); return }
    setBusy(true)
    try {
      await api('/api/owner/sales', { method: 'POST', body: JSON.stringify({
        name,
        quantity,
        amount,
        note: form.note.trim(),
        unit: unit === 'other' ? customUnit.trim().toLowerCase() : unit,
      }) })
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
  const unitButton = active => cx('rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition', active ? 'border-[#c65d1b] bg-[#fff1e6] text-[#c65d1b]' : 'border-[#e6e9e1] bg-white text-[#757c71] hover:border-[#dca875]')

  return <Modal title="Record sale" onClose={onClose}>
    <form className="space-y-3.5" onSubmit={submit}>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#f4f4f0] p-1">
        <button type="button" disabled={stockItems === null || !stockItems.length} onClick={() => setMode('stock')} className={modeButton(mode === 'stock')}>From stock</button>
        <button type="button" onClick={() => setMode('custom')} className={modeButton(mode === 'custom')}>Not in stock</button>
      </div>
      <p className="text-[10px] leading-4 text-[#9b9f96]">{mode === 'stock' ? 'Search for what was sold and pick it from the list.' : mode === 'custom' ? 'Type anything you sold that is not tracked in stock, e.g. sodas bought for resale.' : 'Loading stock…'}</p>

      {mode === 'stock' && <div>
        <label className="block"><span className={labelClass}>What was sold <span className="text-[#b75c48]">*</span></span>
          <input autoFocus value={stockQuery} onChange={event => { setStockQuery(event.target.value); setForm(prev => ({ ...prev, stockId: '', name: event.target.value })); setShowMatches(true) }} onFocus={() => setShowMatches(true)} onBlur={() => setShowMatches(false)} maxLength="60" placeholder="Search what was sold, e.g. Beef…" className={inputClass} />
        </label>
        {showMatches && <div className="mt-1.5 max-h-36 overflow-y-auto rounded-lg border border-[#eceee8]" onMouseDown={event => event.preventDefault()}>
          {matches.length ? matches.map(item => <button type="button" key={item._id} onClick={() => pickItem(item)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[11px] font-semibold text-[#3d443a] hover:bg-[#f7f8f5]">
            <span className="min-w-0 truncate">{item.name}</span>
            <span className="shrink-0 text-[9px] font-normal text-[#9b9f96]">{item.plates} {unitDisplay(item.unit, item.customUnit)} left</span>
          </button>) : <p className="px-3 py-2 text-[10px] text-[#9b9f96]">Nothing in stock matches “{stockQuery.trim()}”.</p>}
        </div>}
        {stockQuery.trim() && !matches.length && <button type="button" onClick={() => { setMode('custom'); setShowMatches(false) }} className="mt-1.5 text-[10px] font-semibold text-[#c65d1b] underline">Record “{stockQuery.trim()}” as not in stock instead</button>}
        {selectedItem && <p className="mt-1.5 text-[9px] leading-4 text-[#a0a49b]">{money(selectedItem.price || 0)} per {unitDisplay(selectedItem.unit, selectedItem.customUnit)} · {selectedItem.plates} {unitDisplay(selectedItem.unit, selectedItem.customUnit)} in stock. Recording the sale does not change the stock count.</p>}
      </div>}

      {mode === 'custom' && <label className="block"><span className={labelClass}>What was sold <span className="text-[#b75c48]">*</span></span>
        <input required autoFocus value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} maxLength="60" placeholder="e.g. Fresh milk" className={inputClass} />
      </label>}

      <div>
        <span className={labelClass}>Sold by</span>
        <div className="flex flex-wrap gap-1.5">
          {UNIT_OPTIONS.map(entry => <button type="button" key={entry.key} onClick={() => setUnit(entry.key)} className={unitButton(unit === entry.key)}>{entry.label}</button>)}
        </div>
        {unit === 'other' && <input required value={customUnit} onChange={event => setCustomUnit(event.target.value)} maxLength="20" placeholder="Name the unit, e.g. crate, tray" className={cx(inputClass, 'mt-2')} />}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className={labelClass}>Quantity ({chosenUnit})</span>
          <input type="number" min="0" step={unit === 'kg' ? '0.1' : '1'} value={form.quantity} onChange={event => setQuantity(event.target.value)} placeholder="e.g. 2" className={inputClass} />
        </label>
        <label className="block"><span className={labelClass}>Total amount (UGX) <span className="text-[#b75c48]">*</span></span>
          <input required type="number" min="0" step="1" value={form.amount} onChange={event => { setForm({ ...form, amount: event.target.value }); setAmountTouched(true) }} placeholder="e.g. 10000" className={inputClass} />
        </label>
      </div>
      {overStock && <p className="rounded-lg bg-[#fbf1df] px-2.5 py-2 text-[10px] leading-4 text-[#8c6b35]">Only {selectedItem.plates} {unitDisplay(selectedItem.unit, selectedItem.customUnit)} in stock — you are recording a sale of more than that.</p>}

      <label className="block"><span className={labelClass}>Note — optional</span>
        <input value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} maxLength="200" placeholder="e.g. sold at the market stall" className={inputClass} />
      </label>

      {error && <p className="text-[11px] text-[#b75c48]">{error}</p>}
      <button disabled={busy || mode === null} className="w-full rounded-lg bg-[#c65d1b] py-2.5 text-[11px] font-semibold text-white hover:bg-[#a34b16] disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Recording…' : 'Record sale'}</button>
    </form>
  </Modal>
}

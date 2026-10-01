import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { Boxes, Check, ImagePlus, Plus, Settings2, Trash2, X } from 'lucide-react'
import { API_BASE_URL, api, apiAssetUrl } from '../../lib/api.js'
import { money, cx } from '../../lib/ui.js'
import { Modal } from '../Modal/Modal.jsx'

// Stock is not always counted in plates — gas cylinders, charcoal and boxes
// are counted as items, and dry goods are weighed. The unit decides what the
// number on a card means and what the add/reduce buttons adjust.
const UNITS = [
  { value: 'plates', label: 'Plates', singular: 'plate', plural: 'plates', hint: 'Portions ready to serve, e.g. 20 plates of beef.', step: '1' },
  { value: 'items', label: 'Items', singular: 'item', plural: 'items', hint: 'Counted pieces, e.g. 4 gas cylinders or 200 boxes.', step: '1' },
  { value: 'kg', label: 'Weight (KG)', singular: 'kg', plural: 'kg', hint: 'Weighed stock, e.g. 12.5 kg of charcoal.', step: '0.1' },
]
const unitInfo = value => UNITS.find(entry => entry.value === value) || UNITS[0]

export function StockPage({ user, canManage = true, foodTypes = [] }) {
  const [items, setItems] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [adjusting, setAdjusting] = useState(null) // { item, mode: 'add' | 'reduce' }
  const [adjustAmount, setAdjustAmount] = useState('')
  const [renaming, setRenaming] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [form, setForm] = useState({ name: '', foodType: '', price: '', unit: 'plates', quantity: '' })
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState('')

  const loadStock = async () => {
    try {
      const data = await api('/api/stock')
      setItems(data.items)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadStock()
    if (!user?.hotelId) return undefined
    const socket = io(API_BASE_URL || undefined, { withCredentials: true })
    socket.emit('join_hotel', user.hotelId)
    socket.on('stock_updated', loadStock)
    return () => socket.disconnect()
  }, [user?.hotelId])

  useEffect(() => {
    if (!image) return undefined
    const url = URL.createObjectURL(image)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  const openPopup = () => {
    setForm({ name: '', foodType: '', price: '', unit: 'plates', quantity: '' })
    setImage(null)
    setPreview('')
    setError('')
    setShowForm(true)
  }

  const createStock = async event => {
    event.preventDefault()
    setBusy(true)
    try {
      const data = new FormData()
      data.append('name', form.name)
      data.append('foodType', form.foodType)
      data.append('price', String(Number(form.price || 0)))
      data.append('unit', form.unit)
      data.append('quantity', String(Number(form.quantity || 0)))
      if (image) data.append('image', image)
      await api('/api/stock', { method: 'POST', body: data })
      setShowForm(false)
      setImage(null)
      setPreview('')
      setError('')
      await loadStock()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const adjustStock = async () => {
    const amount = Number(adjustAmount)
    const unit = unitInfo(adjusting?.item?.unit)
    const whole = unit.value === 'kg' ? Math.abs(amount * 100 - Math.round(amount * 100)) < 0.001 : Number.isInteger(amount)
    if (!adjusting || !whole || amount === 0) {
      setError(`Enter a number of ${unit.plural} to ${adjusting?.mode === 'add' ? 'add' : 'reduce'}.`)
      return
    }
    const delta = adjusting.mode === 'add' ? amount : -amount
    setBusy(true)
    try {
      await api(`/api/stock/${adjusting.item._id}/adjust`, { method: 'PATCH', body: JSON.stringify({ delta }) })
      setAdjusting(null)
      setAdjustAmount('')
      await loadStock()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const renameStock = async () => {
    const value = renameValue.trim()
    if (!renaming || !value) return
    setBusy(true)
    try {
      await api(`/api/stock/${renaming._id}`, { method: 'PATCH', body: JSON.stringify({ name: value }) })
      setRenaming(null)
      await loadStock()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const removeStock = async stock => {
    if (!window.confirm(`Remove "${stock.name}" from stock tracking?`)) return
    setBusy(true)
    try {
      await api(`/api/stock/${stock._id}`, { method: 'DELETE' })
      await loadStock()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const lowStock = plates => plates <= 5

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-bold">Kitchen stock</h2>
        <p className="mt-1 text-[12px] text-[#8d9389]">Track what you have in the kitchen — plated portions, counted items, or weighed stock. Adjust the count by hand as you prep and serve.</p>
      </div>
      {canManage && <button onClick={openPopup} className="flex items-center gap-2 rounded-lg bg-[#c65d1b] px-3.5 py-2.5 text-[11px] font-semibold text-white hover:bg-[#a34b16]"><Plus size={15} />Add stock</button>}
    </div>
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-[#fae9e5] px-3 py-2.5 text-[11px] text-[#a44f3d]"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
    {!items.length ? <div className="rounded-2xl border border-dashed border-[#dfe4d9] bg-white px-5 py-12 text-center"><Boxes className="mx-auto text-[#c65d1b]" size={26} /><p className="mt-3 text-[12px] font-semibold">No stock tracked yet</p><p className="mt-1 text-[10px] text-[#8d9389]">{canManage ? 'Click Add stock to record your first batch — pick the food type, how it is counted, price, and quantity.' : 'Stock entries will appear here once the kitchen adds them.'}</p></div> :
      <div className="grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{items.map(item => { const unit = unitInfo(item.unit); return <article key={item._id} className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl border border-[#eceee8] bg-white p-2 transition hover:border-[#dca875] sm:gap-2 sm:p-2.5">
        <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-lg bg-[#f0f1ed] text-[#c0c4b8]">
          {item.imageUrl ? <img src={apiAssetUrl(item.imageUrl)} alt={item.name} className="size-full object-cover" /> : <span className="grid size-full place-items-center"><Boxes size={18} /></span>}
          <span title={item.plates === 0 ? 'Out of stock' : lowStock(item.plates) ? 'Running low' : 'In stock'} className={cx('absolute right-1 top-1 size-2.5 rounded-full ring-2 ring-white', item.plates === 0 ? 'bg-[#d9534f]' : lowStock(item.plates) ? 'bg-[#e0a63c]' : 'bg-[#5aa54f]')} />
        </span>
        {renaming === item ? <div className="flex w-full items-center gap-1">
          <input autoFocus value={renameValue} onChange={event => setRenameValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') renameStock(); if (event.key === 'Escape') setRenaming(null) }} maxLength="60" aria-label={`Rename ${item.name}`} className="min-w-0 flex-1 rounded border border-[#dca875] px-1.5 py-1 text-center text-[10px] outline-none" />
          <button disabled={busy} onClick={renameStock} title="Save name" className="shrink-0 rounded p-1 text-[#a34b16] hover:bg-[#fff1e6]"><Check size={12} /></button>
          <button onClick={() => setRenaming(null)} title="Cancel" className="shrink-0 rounded p-1 text-[#9b9f96] hover:bg-[#f0f1ed]"><X size={12} /></button>
        </div> : <div className="w-full min-w-0 text-center">
          <h3 className="font-display flex items-center justify-center gap-1 text-[10px] font-bold leading-[13px] sm:text-[11px] sm:leading-[15px]">
            <span className="line-clamp-2 break-words">{item.name}</span>
            {canManage && <button onClick={() => { setRenaming(item); setRenameValue(item.name) }} title={`Rename ${item.name}`} className="shrink-0 rounded p-0.5 text-[#b9beb2] hover:bg-[#f0f1ed] hover:text-[#71786d]"><Settings2 size={11} /></button>}
          </h3>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
            {item.foodType && <span className="max-w-full truncate rounded bg-[#fff1e6] px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-[.6px] text-[#a34b16] sm:text-[8px]">{item.foodType}</span>}
            <span className="rounded bg-[#f4f4f0] px-1.5 py-0.5 text-[7px] font-semibold text-[#757c71] sm:text-[8px]">{money(item.price || 0)}</span>
          </div>
          <p className="mt-1 hidden text-[9px] text-[#9b9f96] sm:block">{item.totalAdded} added · {item.totalUsed} served</p>
        </div>}
        <div className="flex w-full items-baseline justify-center gap-1 border-t border-dashed border-[#ebede7] pt-1.5">
          <span className="font-display text-[16px] font-extrabold leading-5 text-[#293128] sm:text-[18px] sm:leading-6">{item.plates}</span>
          <span className="text-[8px] uppercase tracking-[.6px] text-[#a0a49b]">{unit.plural}</span>
        </div>
        {canManage && <div className="flex w-full items-center justify-center gap-1">
          <button disabled={busy} onClick={() => { setAdjusting({ item, mode: 'add' }); setAdjustAmount('') }} aria-label={`Add ${unit.plural} to ${item.name}`} title={`Add ${unit.plural}`} className="grid size-7 place-items-center rounded-lg bg-[#fff1e6] text-[#a34b16] disabled:opacity-60"><Plus size={13} /></button>
          <button disabled={busy || item.plates === 0} onClick={() => { setAdjusting({ item, mode: 'reduce' }); setAdjustAmount('') }} aria-label={`Reduce ${unit.plural} from ${item.name}`} title={`Reduce ${unit.plural}`} className="grid size-7 place-items-center rounded-lg border border-[#eceee8] text-[13px] leading-none text-[#737a70] disabled:opacity-60">−</button>
          <button disabled={busy} onClick={() => removeStock(item)} aria-label={`Remove ${item.name}`} title={`Remove ${item.name}`} className="grid size-7 place-items-center rounded-lg border border-[#eceee8] text-[#a44f3d] disabled:opacity-60"><Trash2 size={12} /></button>
        </div>}
      </article> })}</div>}
    {adjusting && <Modal title={adjusting.mode === 'add' ? `Add ${adjusting.item.name}` : `Reduce ${adjusting.item.name}`} onClose={() => setAdjusting(null)}>
      {(() => { const unit = unitInfo(adjusting.item.unit); return <form className="space-y-3.5" onSubmit={event => { event.preventDefault(); adjustStock() }}>
        <p className="text-[11px] leading-5 text-[#8d9389]">{adjusting.mode === 'add' ? `${unit.label} you have just prepared and added.` : `${unit.label} removed without an order — staff meals, waste, or spoilage.`} Current count: <b>{adjusting.item.plates} {unit.plural}</b>.</p>
        <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#737a70]">{unit.label}</span><input autoFocus required type="number" min="0.1" step={unit.step} value={adjustAmount} onChange={event => setAdjustAmount(event.target.value)} className="w-full rounded-lg border border-[#e6e9e1] bg-white px-3 py-2.5 text-[12px]" /></label>
        <button disabled={busy} className="w-full rounded-lg bg-[#c65d1b] py-2.5 text-[11px] font-semibold text-white disabled:opacity-60">{adjusting.mode === 'add' ? `Add ${unit.plural}` : `Reduce ${unit.plural}`}</button>
      </form> })()}
    </Modal>}
    {showForm && <Modal title="Add stock" onClose={() => setShowForm(false)}>
      <form className="space-y-3.5" onSubmit={createStock}>
        <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#737a70]">Food type <span className="text-[#b75c48]">*</span></span>
          <select required value={form.foodType} onChange={event => setForm({ ...form, foodType: event.target.value })} className="w-full rounded-lg border border-[#e6e9e1] bg-white px-3 py-2.5 text-[12px]">
            <option value="">Click to select food type…</option>
            {foodTypes.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
          <span className="mt-1 block text-[9px] text-[#a0a49b]">Only categories created under Categories → Food type are listed.</span>
          {!foodTypes.length && <span className="mt-1.5 block rounded-lg bg-[#fbf1df] px-2.5 py-2 text-[9px] leading-4 text-[#8c6b35]">No food type categories yet. Close this and add one under Categories → Food type first.</span>}
        </label>
        <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#737a70]">How is it counted? <span className="text-[#b75c48]">*</span></span>
          <select required value={form.unit} onChange={event => setForm({ ...form, unit: event.target.value })} className="w-full rounded-lg border border-[#e6e9e1] bg-white px-3 py-2.5 text-[12px]">
            {UNITS.map(entry => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
          </select>
          <span className="mt-1 block text-[9px] text-[#a0a49b]">{unitInfo(form.unit).hint}</span>
        </label>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#737a70]">Price (UGX) <span className="text-[#b75c48]">*</span></span>
            <input required type="number" min="0" step="1" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} placeholder="e.g. 50000" className="w-full rounded-lg border border-[#e6e9e1] bg-white px-3 py-2.5 text-[12px]" />
          </label>
          <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#737a70]">Number of {unitInfo(form.unit).plural} <span className="text-[#b75c48]">*</span></span>
            <input required type="number" min="0" step={unitInfo(form.unit).step} value={form.quantity} onChange={event => setForm({ ...form, quantity: event.target.value })} placeholder={form.unit === 'kg' ? 'e.g. 12.5' : form.unit === 'items' ? 'e.g. 4' : 'e.g. 20'} className="w-full rounded-lg border border-[#e6e9e1] bg-white px-3 py-2.5 text-[12px]" />
          </label>
        </div>
        <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#737a70]">Stock name <span className="text-[#b75c48]">*</span></span>
          <input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} maxLength="60" placeholder="e.g. Friday beef batch" className="w-full rounded-lg border border-[#e6e9e1] bg-white px-3 py-2.5 text-[12px]" />
        </label>
        <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#737a70]">Photo</span>
          <span className="flex items-center gap-2.5">
            <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#e6e9e1] bg-[#fafbf8] text-[#c0c4b8]">
              {preview ? <img src={preview} alt="Stock preview" className="size-full object-cover" /> : <ImagePlus size={18} />}
            </span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setImage(event.target.files?.[0] || null)} className="block w-full rounded-lg border border-[#e6e9e1] bg-white px-3 py-2 text-[10px] file:mr-3 file:rounded-md file:border-0 file:bg-[#fff1e6] file:px-3 file:py-1.5 file:text-[10px] file:font-semibold file:text-[#c65d1b]" />
          </span>
          <span className="mt-1 block text-[9px] text-[#a0a49b]">JPG, PNG or WebP — maximum 5 MB. Optional.</span>
        </label>
        {error && <p className="text-[11px] text-[#b75c48]">{error}</p>}
        <button disabled={busy || !foodTypes.length} className="w-full rounded-lg bg-[#c65d1b] py-2.5 text-[11px] font-semibold text-white disabled:opacity-60">{busy ? 'Adding…' : 'Add stock'}</button>
      </form>
    </Modal>}
  </div>
}

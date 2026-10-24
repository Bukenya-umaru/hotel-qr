import { useEffect, useRef, useState } from 'react'
import { connectSocket, api, apiAssetUrl } from '../../lib/api.js'
import { Boxes, Check, ImagePlus, Pencil, Plus, Trash2, Wallet, X } from 'lucide-react'
import { hasPermission, money, cx } from '../../lib/ui.js'
import { Modal } from '../Modal/Modal.jsx'
import { ActionProgress } from '../ActionProgress/ActionProgress.jsx'
import { Pagination } from '../Pagination/Pagination.jsx'

const PAGE_SIZE = 10

function StockPhoto({ src, alt, className, fallback }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => { setBroken(false) }, [src])
  if (!src || broken) return fallback
  return <img src={src} alt={alt} className={className} onError={() => setBroken(true)} />
}

const UNITS = [
  { value: 'plates', label: 'Plates', singular: 'plate', plural: 'plates', hint: 'Portions ready to serve, e.g. 20 plates of beef.', step: '1' },
  { value: 'items', label: 'Items', singular: 'item', plural: 'items', hint: 'Counted pieces, e.g. 4 gas cylinders or 200 boxes.', step: '1' },
  { value: 'cups', label: 'Cups', singular: 'cup', plural: 'cups', hint: 'Served by the cup, e.g. 30 cups of milk or porridge.', step: '1' },
  { value: 'kg', label: 'Weight (KG)', singular: 'kg', plural: 'kg', hint: 'Weighed stock, e.g. 12.5 kg of charcoal.', step: '0.01' },
  { value: 'other', label: 'Other', singular: 'unit', plural: 'units', hint: 'Anything else — name the unit yourself, e.g. crate, tray or bottle.', step: '1' },
]
const unitInfo = (value, customUnit = '') => {
  const found = UNITS.find(entry => entry.value === value)
  if (!found) return UNITS[0]
  return found.value === 'other' && customUnit
    ? { ...found, singular: customUnit, plural: customUnit, label: customUnit }
    : found
}
const stockValue = item => Math.round((Number(item.price) || 0) * (Number(item.plates) || 0) * 100) / 100

export function StockPage({ user, canManage = true }) {
  const [items, setItems] = useState([])
  const [foodTypes, setFoodTypes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyAction, setBusyAction] = useState('')
  const [adjusting, setAdjusting] = useState(null)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', foodType: '', price: '', unit: 'plates', customUnit: '', quantity: '' })
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState('')
  const [imageRemoved, setImageRemoved] = useState(false)
  const [page, setPage] = useState(1)
  const fileRef = useRef(null)
  const canApprove = hasPermission(user, 'approve_records')

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
    api('/api/owner/categories').then(data => setFoodTypes(data.categories.map(category => category.name))).catch(() => {})
    if (!user?.hotelId) return undefined
    const socket = connectSocket()
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

  const clearImageInput = () => {
    setImage(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const removePhoto = () => {
    clearImageInput()
    setPreview('')
    setImageRemoved(true)
  }

  const openPopup = () => {
    setEditing(null)
    setForm({ name: '', foodType: '', price: '', unit: 'plates', customUnit: '', quantity: '' })
    clearImageInput()
    setPreview('')
    setImageRemoved(false)
    setError('')
    setShowForm(true)
  }

  const openEdit = item => {
    setEditing(item)
    const quantity = item.approved ? (Number(item.plates) > 0 ? String(item.plates) : '') : String(item.plates ?? '')
    setForm({ name: item.name, foodType: item.foodType || '', price: String(item.price ?? ''), unit: item.unit || 'plates', customUnit: item.customUnit || '', quantity })
    clearImageInput()
    setPreview(item.imageUrl ? apiAssetUrl(item.imageUrl) : '')
    setImageRemoved(false)
    setError('')
    setShowForm(true)
  }

  const submitStock = async event => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setBusyAction('save')
    const previousItems = items
    const pendingId = editing?._id || `pending-${Date.now()}`
    const quantity = editing?.approved && Number(editing.plates) > 0 ? Number(editing.plates) : Number(form.quantity || 0)
    const optimisticItem = {
      ...(editing || {}),
      _id: pendingId,
      name: form.name.trim(),
      foodType: form.foodType,
      price: Number(form.price || 0),
      unit: form.unit,
      customUnit: form.unit === 'other' ? form.customUnit : '',
      plates: quantity,
      totalAdded: editing ? editing.totalAdded : quantity,
      totalUsed: editing ? editing.totalUsed : 0,
      imageUrl: imageRemoved ? '' : (preview || editing?.imageUrl || ''),
      value: stockValue({ price: form.price, plates: quantity }),
      approved: false,
    }
    setItems(previous => editing
      ? previous.map(item => item._id === editing._id ? optimisticItem : item)
      : [optimisticItem, ...previous])
    try {
      const data = new FormData()
      data.append('name', form.name)
      data.append('foodType', form.foodType)
      data.append('price', String(Number(form.price || 0)))
      data.append('unit', form.unit)
      data.append('customUnit', form.unit === 'other' ? form.customUnit : '')
      data.append('quantity', String(quantity))
      if (image) data.append('image', image)
      else if (imageRemoved) data.append('removeImage', 'true')
      const result = await api(editing ? `/api/stock/${editing._id}` : '/api/stock', { method: editing ? 'PATCH' : 'POST', body: data })
      const savedItem = { ...result.item, value: stockValue(result.item), approvedByName: result.item.approvedByName || '', dishes: result.item.dishes || [] }
      setItems(previous => previous.map(item => item._id === pendingId ? savedItem : item))
      if (!editing) setPage(1)
      setShowForm(false)
      setEditing(null)
      clearImageInput()
      setPreview('')
      setImageRemoved(false)
      setError('')
      void loadStock()
    } catch (err) {
      setItems(previousItems)
      setError(err.message)
    } finally {
      setBusy(false)
      setBusyAction('')
    }
  }

  const adjustStock = async () => {
    if (busy) return
    const amount = Number(adjustAmount)
    const unit = unitInfo(adjusting?.item?.unit, adjusting?.item?.customUnit)
    const whole = unit.value === 'kg' ? Math.abs(amount * 100 - Math.round(amount * 100)) < 0.001 : Number.isInteger(amount)
    if (!adjusting || !whole || amount === 0) {
      setError(unit.value === 'kg'
        ? `Enter an amount of ${unit.plural} to ${adjusting?.mode === 'add' ? 'add' : 'reduce'} — up to two decimal places.`
        : `Enter a whole number of ${unit.plural} (e.g. 5 or 20) to ${adjusting?.mode === 'add' ? 'add' : 'reduce'}.`)
      return
    }
    const delta = adjusting.mode === 'add' ? amount : -amount
    setBusy(true)
    setBusyAction('adjust')
    const previousItems = items
    setItems(previous => previous.map(item => item._id === adjusting.item._id
      ? {
          ...item,
          plates: item.plates + delta,
          totalAdded: delta > 0 ? item.totalAdded + delta : item.totalAdded,
          approved: delta > 0 ? false : item.approved,
          approvedByName: delta > 0 ? '' : item.approvedByName,
          approvedAt: delta > 0 ? null : item.approvedAt,
          value: stockValue({ ...item, plates: item.plates + delta }),
        }
      : item))
    try {
      const result = await api(`/api/stock/${adjusting.item._id}/adjust`, { method: 'PATCH', body: JSON.stringify({ delta }) })
      const savedItem = { ...result.item, value: stockValue(result.item), approvedByName: result.item.approvedByName || '', dishes: result.item.dishes || [] }
      setItems(previous => previous.map(item => item._id === adjusting.item._id ? savedItem : item))
      setAdjusting(null)
      setAdjustAmount('')
    } catch (err) {
      setItems(previousItems)
      setError(err.message)
    } finally {
      setBusy(false)
      setBusyAction('')
    }
  }

  const removeStock = async stock => {
    if (busy) return
    if (!window.confirm(`Remove "${stock.name}" from stock tracking?`)) return
    setBusy(true)
    setBusyAction(`delete:${stock._id}`)
    const previousItems = items
    setItems(previous => previous.filter(item => item._id !== stock._id))
    try {
      await api(`/api/stock/${stock._id}`, { method: 'DELETE' })
    } catch (err) {
      setItems(previousItems)
      setError(err.message)
    } finally {
      setBusy(false)
      setBusyAction('')
    }
  }

  const approveStock = async stock => {
    if (busy) return
    setBusy(true)
    setBusyAction(`approve:${stock._id}`)
    const previousItems = items
    setItems(previous => previous.map(item => item._id === stock._id
      ? { ...item, approved: true, approvedByName: '', approvedAt: new Date().toISOString() }
      : item))
    try {
      const result = await api(`/api/stock/${stock._id}/approve`, { method: 'POST' })
      const savedItem = { ...result.item, value: stockValue(result.item), approvedByName: result.item.approvedByName || '', dishes: result.item.dishes || [] }
      setItems(previous => previous.map(item => item._id === stock._id ? savedItem : item))
      setError('')
    } catch (err) {
      setItems(previousItems)
      setError(err.message)
    } finally {
      setBusy(false)
      setBusyAction('')
    }
  }

  const lowStock = plates => plates <= 5
  const typeOptions = form.foodType && !foodTypes.includes(form.foodType) ? [form.foodType, ...foodTypes] : foodTypes
  const formUnit = unitInfo(form.unit, form.customUnit)
  const countLocked = Boolean(editing?.approved && Number(editing.plates) > 0)
  const addingToApproved = Boolean(editing?.approved && Number(editing.plates) === 0)

  const totalValue = items.reduce((sum, item) => sum + stockValue(item), 0)
  const outCount = items.filter(item => item.plates === 0).length
  const lowCount = items.filter(item => item.plates > 0 && lowStock(item.plates)).length
  const totalCount = items.reduce((sum, item) => sum + (Number(item.plates) || 0), 0)
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleItems = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const unitButton = active => cx('rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition', active ? 'border-[#f97316] bg-[#fff4ec] text-[#f97316]' : 'border-[#e7ebf0] bg-white text-[#64748b] hover:border-[#fdba74]')

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-bold">Kitchen stock</h2>
        <p className="mt-1 text-[12px] text-[#94a3b8]">Track what you have in the kitchen — plated portions, counted items, cups of milk, weighed stock, or any unit you name. Adjust the count by hand as you prep and serve.</p>
      </div>
      {canManage && <button onClick={openPopup} className="flex items-center gap-2 rounded-lg bg-[#f97316] px-3.5 py-2.5 text-[11px] font-semibold text-white hover:bg-[#ea580c]"><Plus size={15} />Add stock</button>}
    </div>
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-[#fef2f2] px-3 py-2.5 text-[11px] text-[#dc2626]"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
    {items.length > 0 && <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#fff4ec] px-2 py-1 text-[10px] font-bold text-[#ea580c] sm:px-3 sm:py-2 sm:text-[12px]"><Wallet size={12} className="sm:size-[15px]" />Total income {money(totalValue)}</span>
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#e7ebf0] bg-white px-2 py-1 text-[10px] font-semibold text-[#334155] sm:px-3 sm:py-2 sm:text-[12px]">{items.length} {items.length === 1 ? 'entry' : 'entries'} · {totalCount} in total</span>
      {outCount > 0 && <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#fef2f2] px-2 py-1 text-[10px] font-semibold text-[#dc2626] sm:px-3 sm:py-2 sm:text-[12px]">{outCount} out of stock</span>}
      {lowCount > 0 && <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#fef9ee] px-2 py-1 text-[10px] font-semibold text-[#b45309] sm:px-3 sm:py-2 sm:text-[12px]">{lowCount} running low</span>}
    </div>}
    {items.length > 0 && <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 lg:gap-4 2xl:grid-cols-5">{visibleItems.map(item => { const unit = unitInfo(item.unit, item.customUnit); const canEdit = user?.role === 'OWNER' || String(item.createdById || '') === String(user?._id || '') || hasPermission(user, 'edit_approved_stock') || (!item.approved && hasPermission(user, 'edit_business_stock')); return <article key={item._id} className="flex min-w-0 flex-col items-center gap-1 rounded-xl border border-[#e7ebf0] bg-white p-1.5 transition hover:border-[#fdba74] sm:gap-2.5 sm:p-4">
        <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-lg bg-[#f1f5f9] text-[#e2e8f0] sm:aspect-[16/10] sm:rounded-xl">
          <StockPhoto src={item.imageUrl ? apiAssetUrl(item.imageUrl) : ''} alt={item.name} className="size-full object-cover" fallback={<span className="grid size-full place-items-center"><Boxes size={16} className="sm:size-7" /></span>} />
          <span title={item.plates === 0 ? 'Out of stock' : lowStock(item.plates) ? 'Running low' : 'In stock'} className={cx('absolute right-1 top-1 size-2 rounded-full ring-2 ring-white sm:right-1.5 sm:top-1.5 sm:size-3', item.plates === 0 ? 'bg-[#ef4444]' : lowStock(item.plates) ? 'bg-[#f59e0b]' : 'bg-[#22c55e]')} />
        </span>
        <div className="w-full min-w-0 text-center">
          <h3 className="font-display flex items-center justify-center gap-1 text-[10px] font-bold leading-[13px] sm:gap-1.5 sm:text-[13px] sm:leading-[17px]">
            <span className="line-clamp-2 break-words">{item.name}</span>
            {canEdit && <button onClick={() => openEdit(item)} title={`Edit ${item.name}`} className="shrink-0 rounded p-0.5 text-[#e2e8f0] hover:bg-[#f1f5f9] hover:text-[#64748b] sm:p-1"><Pencil size={11} className="sm:size-3.5" /></button>}
          </h3>
          <div className="mt-0.5 flex flex-wrap items-center justify-center gap-1 sm:mt-1.5 sm:gap-1.5">
            {item.foodType && <span className="max-w-full truncate rounded bg-[#fff4ec] px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-[.6px] text-[#ea580c] sm:px-2 sm:py-1 sm:text-[9px] sm:tracking-[.8px]">{item.foodType}</span>}
            {item.approved
              ? <span className="rounded bg-[#f0fdf4] px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-[.6px] text-[#16a34a] sm:px-2 sm:py-1 sm:text-[9px]">Approved</span>
              : <span className="rounded bg-[#fef9ee] px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-[.6px] text-[#b45309] sm:px-2 sm:py-1 sm:text-[9px]">Pending</span>}
          </div>
          <p className="mt-1 hidden text-[10px] text-[#94a3b8] sm:mt-1.5 sm:block">{item.totalAdded} added · {item.totalUsed} served</p>
          {item.approved && item.approvedByName !== undefined && (item.approvedByName || item.approvedAt) &&
            <p title={item.approvedAt ? new Date(item.approvedAt).toLocaleDateString('en-UG', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : undefined} className="mt-0.5 hidden text-[9px] leading-3 text-[#16a34a] sm:block">Signed off{item.approvedByName ? ` by ${item.approvedByName}` : ''}{item.approvedAt ? ` · ${new Date(item.approvedAt).toLocaleDateString('en-UG', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}</p>}
        </div>
        <div className="w-full border-t border-dashed border-[#e7ebf0] pt-1 text-center sm:pt-2">
          <div className="flex items-baseline justify-center gap-1 sm:gap-1.5">
            <span className="font-display text-[15px] font-extrabold leading-4 text-[#0f172a] sm:text-[24px] sm:leading-7">{item.plates}</span>
            <span className="text-[7px] uppercase tracking-[.6px] text-[#94a3b8] sm:text-[10px] sm:tracking-[.8px]">{unit.plural}</span>
          </div>
          <p title={`${money(stockValue(item))} worth of stock, at ${money(item.price || 0)} per ${unit.singular}`} className="mt-0.5 truncate text-[9px] font-bold leading-3 text-[#16a34a] sm:mt-1 sm:text-[12px] sm:leading-4">{money(stockValue(item))}</p>
          <p className="mt-0.5 hidden text-[9px] leading-3 text-[#94a3b8] sm:mt-0.5 sm:block">{money(item.price || 0)} per {unit.singular}</p>
        </div>
        {(canManage || canEdit) && <div className="flex w-full items-center justify-center gap-1 sm:gap-1.5">
          {canApprove && !item.approved && <button disabled={busy} onClick={() => approveStock(item)} aria-label={busyAction === `approve:${item._id}` ? `Approving ${item.name}` : `Approve ${item.name}`} title="Approve this stock" className="grid size-6 place-items-center rounded-md bg-[#f0fdf4] text-[#16a34a] disabled:opacity-50 sm:size-9 sm:rounded-lg">{busyAction === `approve:${item._id}` ? <ActionProgress><span className="sr-only">Approving stock…</span></ActionProgress> : <Check size={12} className="sm:size-4" />}</button>}
          {canEdit && <>
            <button disabled={busy || (item.approved && item.plates > 0)} onClick={() => { setAdjusting({ item, mode: 'add' }); setAdjustAmount('') }} aria-label={`Add ${unit.plural} to ${item.name}`} title={item.approved && item.plates > 0 ? 'Approved — use this stock down to zero before adding more' : `Add ${unit.plural}`} className="grid size-6 place-items-center rounded-md bg-[#fff4ec] text-[#ea580c] disabled:opacity-60 sm:size-9 sm:rounded-lg"><Plus size={12} className="sm:size-[18px]" /></button>
            <button disabled={busy || item.plates === 0} onClick={() => { setAdjusting({ item, mode: 'reduce' }); setAdjustAmount('') }} aria-label={`Reduce ${unit.plural} from ${item.name}`} title={`Reduce ${unit.plural}`} className="grid size-6 place-items-center rounded-md border border-[#e7ebf0] text-[12px] leading-none text-[#64748b] disabled:opacity-60 sm:size-9 sm:rounded-lg sm:text-[17px]">−</button>
            <button disabled={busy || (item.approved && item.plates > 0)} onClick={() => removeStock(item)} aria-label={busyAction === `delete:${item._id}` ? `Deleting ${item.name}` : `Remove ${item.name}`} title={item.approved && item.plates > 0 ? 'Approved — you can remove it once the count reaches zero' : `Remove ${item.name}`} className="grid size-6 place-items-center rounded-md border border-[#e7ebf0] text-[#dc2626] disabled:opacity-50 sm:size-9 sm:rounded-lg">{busyAction === `delete:${item._id}` ? <ActionProgress><span className="sr-only">Deleting stock…</span></ActionProgress> : <Trash2 size={11} className="sm:size-4" />}</button>
          </>}
        </div>}
      </article> })}</div>}
    {items.length > 0 && <Pagination page={currentPage} pageCount={pageCount} total={items.length} pageSize={PAGE_SIZE} onPageChange={setPage} />}
    {adjusting && <Modal title={adjusting.mode === 'add' ? `Add ${adjusting.item.name}` : `Reduce ${adjusting.item.name}`} onClose={() => setAdjusting(null)}>
      {(() => { const unit = unitInfo(adjusting.item.unit, adjusting.item.customUnit); return <form className="space-y-3.5" onSubmit={event => { event.preventDefault(); adjustStock() }}>
        <p className="text-[11px] leading-5 text-[#94a3b8]">{adjusting.mode === 'add' ? `${unit.label} you have just prepared and added.` : `${unit.label} removed from stock — staff meals, waste, or spoilage.`} Current count: <b>{adjusting.item.plates} {unit.plural}</b>, worth <b>{money(stockValue(adjusting.item))}</b> at {money(adjusting.item.price || 0)} per {unit.singular}.</p>
        <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#64748b]">{unit.label}</span><input autoFocus required type="number" min={unit.step} step={unit.step} value={adjustAmount} onChange={event => setAdjustAmount(event.target.value)} className="w-full rounded-lg border border-[#e7ebf0] bg-white px-3 py-2.5 text-[12px]" /></label>
        <button disabled={busy} className="w-full rounded-lg bg-[#f97316] py-2.5 text-[11px] font-semibold text-white disabled:opacity-60">{busyAction === 'adjust' ? <ActionProgress>{adjusting.mode === 'add' ? 'Adding stock…' : 'Reducing stock…'}</ActionProgress> : adjusting.mode === 'add' ? `Add ${unit.plural}` : `Reduce ${unit.plural}`}</button>
      </form> })()}
    </Modal>}
    {showForm && <Modal title={editing ? `Edit ${editing.name}` : 'Add stock'} onClose={() => { setShowForm(false); setEditing(null) }}>
      <form className="space-y-3.5" onSubmit={submitStock}>
        {editing?.approved && <p className="rounded-lg bg-[#fef9ee] px-3 py-2 text-[10px] leading-4 text-[#b45309]">Saving changes will return this stock to pending approval.</p>}
        <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#64748b]">Food type <span className="text-[#dc2626]">*</span></span>
          <select required value={form.foodType} onChange={event => setForm({ ...form, foodType: event.target.value })} className="w-full rounded-lg border border-[#e7ebf0] bg-white px-3 py-2.5 text-[12px]">
            <option value="">Click to select food type…</option>
            {typeOptions.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
          <span className="mt-1 block text-[9px] text-[#94a3b8]">Only categories created under Categories → Food type are listed.</span>
          {!foodTypes.length && <span className="mt-1.5 block rounded-lg bg-[#fef9ee] px-2.5 py-2 text-[9px] leading-4 text-[#b45309]">No food type categories yet. Close this and add one under Categories → Food type first.</span>}
        </label>
        <div><span className="mb-1.5 block text-[10px] font-semibold text-[#64748b]">How is it counted? <span className="text-[#dc2626]">*</span></span>
          <div className="flex flex-wrap gap-1.5">
            {UNITS.map(entry => <button type="button" key={entry.value} onClick={() => setForm({ ...form, unit: entry.value })} className={unitButton(form.unit === entry.value)}>{entry.label}</button>)}
          </div>
          {form.unit === 'other' && <input required value={form.customUnit} onChange={event => setForm({ ...form, customUnit: event.target.value })} maxLength="20" placeholder="Name the unit, e.g. crate, tray, bottle" className="mt-2 w-full rounded-lg border border-[#e7ebf0] bg-white px-3 py-2.5 text-[12px]" />}
          <span className="mt-1 block text-[9px] text-[#94a3b8]">{formUnit.hint}</span>
        </div>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#64748b]">Price per {formUnit.singular} (UGX) <span className="text-[#dc2626]">*</span></span>
            <input required type="number" min="0" step="1" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} placeholder={form.unit === 'kg' ? 'e.g. 8000 per kg' : form.unit === 'items' ? 'e.g. 45000 per cylinder' : form.unit === 'cups' ? 'e.g. 500 per cup' : form.unit === 'other' ? `per ${form.customUnit || 'unit'}` : 'e.g. 5000 per plate'} className="w-full rounded-lg border border-[#e7ebf0] bg-white px-3 py-2.5 text-[12px]" />
            <span className="mt-1 block text-[9px] leading-4 text-[#94a3b8]">The price of one {formUnit.singular}. Total value is worked out from the number you enter below.</span>
            <span className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-[#f0fdf4] px-2.5 py-2 text-[10px] font-semibold text-[#16a34a]"><Wallet size={12} />Total value {money((Number(form.price) || 0) * (Number(form.quantity) || 0))}</span>
          </label>
          <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#64748b]">{addingToApproved ? 'New stock number' : countLocked ? 'Stock number' : `Number of ${formUnit.plural}`} <span className="text-[#dc2626]">*</span></span>
            <input required disabled={countLocked} type="number" min="0" step={formUnit.step} value={form.quantity} onChange={event => setForm({ ...form, quantity: event.target.value })} placeholder={form.unit === 'kg' ? 'e.g. 12.5' : form.unit === 'items' ? 'e.g. 4' : form.unit === 'cups' ? 'e.g. 30' : 'e.g. 20'} className={cx('w-full rounded-lg border border-[#e7ebf0] px-3 py-2.5 text-[12px]', countLocked ? 'cursor-not-allowed bg-[#f8fafc] text-[#94a3b8]' : 'bg-white')} />
            {countLocked && <span className="mt-1 block rounded-lg bg-[#fef9ee] px-2.5 py-2 text-[9px] leading-4 text-[#b45309]">This stock is approved at {editing.plates} {formUnit.plural}. The number cannot be edited — use it down to zero, then come back here to add a new stock number.</span>}
            {addingToApproved && <span className="mt-1 block rounded-lg bg-[#fff4ec] px-2.5 py-2 text-[9px] leading-4 text-[#c2410c]">This approved stock has reached zero. Enter the new stock number to add a fresh batch — saving will return it to pending approval.</span>}
          </label>
        </div>
        <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#64748b]">Stock name <span className="text-[#dc2626]">*</span></span>
          <input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} maxLength="60" placeholder="e.g. Fresh milk" className="w-full rounded-lg border border-[#e7ebf0] bg-white px-3 py-2.5 text-[12px]" />
        </label>
        <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#64748b]">Photo</span>
          <span className="flex items-center gap-2.5">
            <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#e7ebf0] bg-[#f8fafc] text-[#e2e8f0]">
              <StockPhoto src={preview} alt="Stock preview" className="size-full object-cover" fallback={<ImagePlus size={18} />} />
            </span>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { setImage(event.target.files?.[0] || null); setImageRemoved(false) }} className="block w-full rounded-lg border border-[#e7ebf0] bg-white px-3 py-2 text-[10px] file:mr-3 file:rounded-md file:border-0 file:bg-[#fff4ec] file:px-3 file:py-1.5 file:text-[10px] file:font-semibold file:text-[#f97316]" />
          </span>
          {preview && <button type="button" onClick={removePhoto} className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-[#dc2626] hover:underline"><X size={12} />Remove photo</button>}
          <span className="mt-1 block text-[9px] text-[#94a3b8]">{editing
            ? imageRemoved ? 'The photo will be removed when you save.' : 'JPG, PNG or WebP — maximum 5 MB. Leave empty to keep the current photo.'
            : 'JPG, PNG or WebP — maximum 5 MB. Optional.'}</span>
        </label>
        {error && <p className="text-[11px] text-[#dc2626]">{error}</p>}
        <button disabled={busy || (!editing && !foodTypes.length)} className="w-full rounded-lg bg-[#f97316] py-2.5 text-[11px] font-semibold text-white disabled:opacity-60">{busyAction === 'save' ? <ActionProgress>{image ? 'Uploading stock image…' : editing ? 'Updating stock…' : 'Adding stock…'}</ActionProgress> : editing ? 'Save changes' : 'Add stock'}</button>
      </form>
    </Modal>}
  </div>
}

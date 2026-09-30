import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { Boxes, Check, Link2, Link2Off, Plus, Settings2, Trash2, X } from 'lucide-react'
import { API_BASE_URL, api } from '../../lib/api.js'
import { money, cx } from '../../lib/ui.js'
import { Modal } from '../Modal/Modal.jsx'

export function StockPage({ user, canManage = true }) {
  const [items, setItems] = useState([])
  const [dishes, setDishes] = useState([])
  const [name, setName] = useState('')
  const [plates, setPlates] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [adjusting, setAdjusting] = useState(null) // { item, mode: 'add' | 'reduce' }
  const [adjustAmount, setAdjustAmount] = useState('')
  const [linking, setLinking] = useState(null) // stock item
  const [renaming, setRenaming] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  const loadStock = async () => {
    try {
      const data = await api('/api/stock')
      setItems(data.items)
      setDishes(data.unlinkedDishes || [])
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

  const createStock = async event => {
    event.preventDefault()
    setBusy(true)
    try {
      await api('/api/stock', { method: 'POST', body: JSON.stringify({ name, plates: Number(plates || 0) }) })
      setName('')
      setPlates('')
      await loadStock()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const adjustStock = async () => {
    const amount = Number(adjustAmount)
    if (!adjusting || !Number.isInteger(amount) || amount === 0) {
      setError('Enter a whole number of plates.')
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
    if (!window.confirm(`Remove "${stock.name}" from stock tracking? Dishes linked to it will stop deducting.`)) return
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

  const linkDish = async (stock, dishId) => {
    setBusy(true)
    try {
      await api(`/api/stock/${stock._id}/link`, { method: 'POST', body: JSON.stringify({ menuItemId: dishId }) })
      await loadStock()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const unlinkDish = async (stock, dishName) => {
    setBusy(true)
    try {
      const dish = dishes.find(entry => entry.name === dishName)
      if (!dish) return
      await api(`/api/stock/${stock._id}/unlink`, { method: 'POST', body: JSON.stringify({ menuItemId: dish._id }) })
      await loadStock()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const lowStock = plates => plates <= 5

  return <div className="space-y-5">
    <div>
      <h2 className="font-display text-lg font-bold">Kitchen stock</h2>
      <p className="mt-1 text-[12px] text-[#8d9389]">Track the plates you have ready — beef, chicken, fish, and any other meat or food. Orders for linked dishes reduce the count automatically; add or reduce plates yourself anytime.</p>
    </div>
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-[#fae9e5] px-3 py-2.5 text-[11px] text-[#a44f3d]"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
    {canManage && <form onSubmit={createStock} className="grid gap-3 rounded-2xl border border-[#eceee8] bg-white p-4 sm:grid-cols-[minmax(0,1fr)_minmax(130px,.5fr)_auto] sm:items-end">
      <label className="block text-[10px] font-semibold text-[#737a70]">Stock name<input required maxLength="60" value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Beef plates" className="mt-1.5 block w-full rounded-lg border border-[#e6e9e1] px-3 py-2.5 text-[12px]" /></label>
      <label className="block text-[10px] font-semibold text-[#737a70]">Starting plates<input type="number" min="0" step="1" value={plates} onChange={event => setPlates(event.target.value)} placeholder="0" className="mt-1.5 block w-full rounded-lg border border-[#e6e9e1] px-3 py-2.5 text-[12px]" /></label>
      <button disabled={busy} className="flex min-h-8 items-center justify-center gap-1.5 rounded-lg bg-[#c65d1b] px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-60 sm:min-h-10 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-[11px]"><Plus size={14} />Add stock</button>
    </form>}
    {!items.length ? <div className="rounded-2xl border border-dashed border-[#dfe4d9] bg-white px-5 py-12 text-center"><Boxes className="mx-auto text-[#c65d1b]" size={26} /><p className="mt-3 text-[12px] font-semibold">No stock tracked yet</p><p className="mt-1 text-[10px] text-[#8d9389]">Add the foods you plate ahead — beef, chicken, fish, goat, pork — and keep their counts fresh.</p></div> :
      <div className="grid grid-cols-1 gap-2.5 sm:gap-3 lg:grid-cols-2 xl:grid-cols-3">{items.map(item => <article key={item._id} className="rounded-2xl border border-[#eceee8] bg-white p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {renaming === item ? <div className="flex items-center gap-1"><input autoFocus value={renameValue} onChange={event => setRenameValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') renameStock(); if (event.key === 'Escape') setRenaming(null) }} maxLength="60" className="w-32 rounded border border-[#dca875] px-1.5 py-0.5 text-[11px]" /><button disabled={busy} onClick={renameStock} className="rounded p-1 text-[#a34b16] hover:bg-[#fff1e6]"><Check size={12} /></button><button onClick={() => setRenaming(null)} className="rounded p-1 text-[#9b9f96] hover:bg-[#f0f1ed]"><X size={12} /></button></div>
              : <h3 className="font-display flex items-center gap-1.5 truncate text-[13px] font-bold sm:text-[15px]">{item.name}{canManage && <button onClick={() => { setRenaming(item); setRenameValue(item.name) }} title={`Rename ${item.name}`} className="rounded p-0.5 text-[#b9beb2] hover:bg-[#f0f1ed] hover:text-[#71786d]"><Settings2 size={12} /></button>}</h3>}
            <p className="mt-0.5 text-[9px] text-[#9b9f96]">{item.totalAdded} added · {item.totalUsed} served from orders</p>
          </div>
          <span className={cx('shrink-0 rounded-full px-2.5 py-1 text-[9px] font-semibold', item.plates === 0 ? 'bg-[#fae9e5] text-[#a44f3d]' : lowStock(item.plates) ? 'bg-[#fbf1df] text-[#8c6b35]' : 'bg-[#eef6ec] text-[#3f8f3a]')}>
            {item.plates === 0 ? 'Out of plates' : lowStock(item.plates) ? 'Running low' : 'In stock'}
          </span>
        </div>
        <div className="mt-3 flex items-end justify-between gap-2 border-t border-dashed border-[#ebede7] pt-3">
          <div><p className="text-[9px] uppercase tracking-[.8px] text-[#a0a49b]">Plates ready</p><p className="font-display text-[22px] font-extrabold leading-7 text-[#293128]">{item.plates}</p></div>
          <div className="flex gap-1.5">
            {canManage && <>
              <button disabled={busy} onClick={() => { setAdjusting({ item, mode: 'add' }); setAdjustAmount('') }} className="rounded-lg bg-[#fff1e6] px-2.5 py-1.5 text-[10px] font-semibold text-[#a34b16] disabled:opacity-60">+ Add</button>
              <button disabled={busy || item.plates === 0} onClick={() => { setAdjusting({ item, mode: 'reduce' }); setAdjustAmount('') }} className="rounded-lg border border-[#eceee8] px-2.5 py-1.5 text-[10px] font-semibold text-[#737a70] disabled:opacity-60">− Reduce</button>
              <button disabled={busy} onClick={() => removeStock(item)} aria-label={`Remove ${item.name}`} className="grid size-7 place-items-center rounded-lg border border-[#eceee8] text-[#a44f3d] disabled:opacity-60"><Trash2 size={13} /></button>
            </>}
          </div>
        </div>
        <div className="mt-3 border-t border-dashed border-[#ebede7] pt-3">
          <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[1px] text-[#a6aa9f]"><Link2 size={11} />Dishes that deduct</p>
          {canManage && <>
            {item.dishes.length ? <ul className="mt-1.5 flex flex-wrap gap-1.5">{item.dishes.map(dish => <li key={dish} className="flex items-center gap-1 rounded-lg border border-[#eceee8] bg-[#fafbf8] pl-2.5 pr-1 py-1 text-[10px] font-medium text-[#555e51]">{dish}<button disabled={busy} onClick={() => unlinkDish(item, dish)} title={`Stop ${dish} deducting ${item.name}`} className="rounded p-0.5 text-[#c08b7e] hover:bg-[#fae9e5] hover:text-[#b75c48]"><Link2Off size={10} /></button></li>)}</ul>
              : <p className="mt-1 text-[9px] text-[#9b9f96]">No dish linked yet — orders will not deduct this stock.</p>}
            {linking === item && <div className="mt-2 space-y-1">{dishes.length ? dishes.map(dish => <button key={dish._id} disabled={busy} onClick={() => linkDish(item, dish._id)} className="flex w-full items-center justify-between rounded-lg border border-[#eceee8] px-2.5 py-1.5 text-[10px] font-medium text-[#555e51] hover:bg-[#fff4eb]">{dish.name}<Plus size={11} className="text-[#a34b16]" /></button>)
              : <p className="text-[9px] text-[#9b9f96]">Every dish is already linked somewhere.</p>}
              <button onClick={() => setLinking(null)} className="text-[9px] font-semibold text-[#8d9389]">Done linking</button></div>}
            {linking !== item && <button onClick={() => setLinking(item)} className="mt-1.5 text-[9px] font-semibold text-[#ac571d]">+ Link a dish</button>}
          </>}
        </div>
      </article>)}</div>}
    {adjusting && <Modal title={adjusting.mode === 'add' ? `Add ${adjusting.item.name}` : `Reduce ${adjusting.item.name}`} onClose={() => setAdjusting(null)}>
      <form className="space-y-3.5" onSubmit={event => { event.preventDefault(); adjustStock() }}>
        <p className="text-[11px] leading-5 text-[#8d9389]">{adjusting.mode === 'add' ? 'Plates you have just prepared and added to the pass.' : 'Plates removed without an order — staff meals, waste, or spoilage.'} Current count: <b>{adjusting.item.plates}</b>.</p>
        <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#737a70]">Plates</span><input autoFocus required type="number" min="1" step="1" value={adjustAmount} onChange={event => setAdjustAmount(event.target.value)} className="w-full rounded-lg border border-[#e6e9e1] bg-white px-3 py-2.5 text-[12px]" /></label>
        <button disabled={busy} className="w-full rounded-lg bg-[#c65d1b] py-2.5 text-[11px] font-semibold text-white disabled:opacity-60">{adjusting.mode === 'add' ? 'Add plates' : 'Reduce plates'}</button>
      </form>
    </Modal>}
  </div>
}

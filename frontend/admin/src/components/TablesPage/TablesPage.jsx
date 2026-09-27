import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { Armchair, Check, Plus, Trash2, Users, X } from 'lucide-react'
import { API_BASE_URL, api } from '../../lib/api.js'

export function TablesPage({ user }) {
  const [tables, setTables] = useState([])
  const [tableNumber, setTableNumber] = useState('')
  const [capacity, setCapacity] = useState('4')
  const [editingId, setEditingId] = useState('')
  const [editingCapacity, setEditingCapacity] = useState('')
  const [seatingId, setSeatingId] = useState('')
  const [seatingCount, setSeatingCount] = useState('2')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const loadTables = async () => {
    try {
      const data = await api('/api/owner/tables')
      setTables(data.tables)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadTables()
    if (!user?.hotel?.slug) return undefined
    const socket = io(API_BASE_URL || undefined, { withCredentials: true })
    socket.emit('join_menu', user.hotel.slug)
    socket.on('tables_updated', loadTables)
    return () => socket.disconnect()
  }, [user?.hotel?.slug])

  const createTable = async event => {
    event.preventDefault()
    setSaving(true)
    try {
      await api('/api/owner/tables', {
        method: 'POST',
        body: JSON.stringify({ tableNumber, capacity: Number(capacity) }),
      })
      setTableNumber('')
      setCapacity('4')
      await loadTables()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const saveCapacity = async table => {
    setSaving(true)
    try {
      await api(`/api/owner/tables/${table._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ capacity: Number(editingCapacity) }),
      })
      setEditingId('')
      await loadTables()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Seat walk-in customers that do not order from their own phone.
  const seatParty = async table => {
    const guestCount = Number(seatingCount)
    if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 100) {
      setError('Enter how many people to seat, from 1 to 100.')
      return
    }
    setSaving(true)
    try {
      await api(`/api/tables/${table._id}/seat`, {
        method: 'POST',
        body: JSON.stringify({ guestCount }),
      })
      setSeatingId('')
      await loadTables()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // One party finished eating: set their chairs back to zero people.
  const releaseParty = async (table, visitId, guestCount) => {
    const label = guestCount === 1 ? '1 person' : `${guestCount} people`
    if (!window.confirm(`Set the ${label} at table ${table.tableNumber} to zero?`)) return
    setSaving(true)
    try {
      await api(`/api/tables/${table._id}/parties/${visitId}/release`, { method: 'PATCH' })
      await loadTables()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const clearTable = async table => {
    if (!window.confirm(`Set the occupied seats for table ${table.tableNumber} to zero?`)) return
    setSaving(true)
    try {
      await api(`/api/owner/tables/${table._id}/clear`, { method: 'PATCH' })
      await loadTables()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const removeTable = async table => {
    if (!window.confirm(`Remove table ${table.tableNumber}?`)) return
    setSaving(true)
    try {
      await api(`/api/owner/tables/${table._id}`, { method: 'DELETE' })
      await loadTables()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return <div className="space-y-5">
    <div>
      <h2 className="font-display text-lg font-bold">Dining tables</h2>
      <p className="mt-1 text-[12px] text-[#8d9389]">Set each table’s number and seat limit. Customers check in from their phones; seat walk-ins yourself and release a party’s chairs when they finish.</p>
    </div>
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-[#fae9e5] px-3 py-2.5 text-[11px] text-[#a44f3d]"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
    <form onSubmit={createTable} className="grid gap-3 rounded-2xl border border-[#eceee8] bg-white p-4 sm:grid-cols-[minmax(0,1fr)_minmax(130px,.55fr)_auto] sm:items-end">
      <label className="block text-[10px] font-semibold text-[#737a70]">Table number<input required maxLength="32" value={tableNumber} onChange={event => setTableNumber(event.target.value)} placeholder="e.g. 12 or Patio A" className="mt-1.5 block w-full rounded-lg border border-[#e6e9e1] px-3 py-2.5 text-[12px]" /></label>
      <label className="block text-[10px] font-semibold text-[#737a70]">Maximum seats<input required type="number" min="1" max="100" step="1" value={capacity} onChange={event => setCapacity(event.target.value)} className="mt-1.5 block w-full rounded-lg border border-[#e6e9e1] px-3 py-2.5 text-[12px]" /></label>
      <button disabled={saving} className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#c65d1b] px-4 py-2.5 text-[11px] font-semibold text-white disabled:opacity-60"><Plus size={15} />Add table</button>
    </form>
    {!tables.length ? <div className="rounded-2xl border border-dashed border-[#dfe4d9] bg-white px-5 py-12 text-center"><Armchair className="mx-auto text-[#c65d1b]" size={26} /><p className="mt-3 text-[12px] font-semibold">No tables set up yet</p><p className="mt-1 text-[10px] text-[#8d9389]">Add your tables here so customers can select one when ordering.</p></div> :
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{tables.map(table => <article key={table._id} className="rounded-2xl border border-[#eceee8] bg-white p-4">
        <div className="flex items-start justify-between gap-3"><div><p className="font-display text-[15px] font-bold">Table {table.tableNumber}</p><p className="mt-1 flex items-center gap-1.5 text-[10px] text-[#858b81]"><Users size={13} />{table.occupiedSeats} of {table.capacity} seats occupied</p></div><span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${table.occupiedSeats >= table.capacity ? 'bg-[#fae9e5] text-[#a44f3d]' : 'bg-[#fff1e6] text-[#a34b16]'}`}>{table.capacity - table.occupiedSeats} seats free</span></div>
        {Boolean(table.reservations?.length) && <ul className="mt-3 space-y-1.5 border-t border-dashed border-[#ebede7] pt-3">{table.reservations.map(reservation => <li key={reservation.visitId} className="flex items-center justify-between gap-2 text-[10px]">
          <span className="flex min-w-0 items-center gap-1.5 text-[#555e51]"><Users size={11} className="shrink-0 text-[#bd6424]" />{reservation.guestCount} {reservation.guestCount === 1 ? 'person' : 'people'}<span className="rounded-full bg-[#f1f2ee] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-[#83897e]">{reservation.source === 'CHEF' ? 'Seated by chef' : 'Self check-in'}</span></span>
          <button disabled={saving} onClick={() => releaseParty(table, reservation.visitId, reservation.guestCount)} title="Party finished — set chairs to 0" className="flex shrink-0 items-center gap-1 rounded-lg bg-[#fff1e6] px-2 py-1 text-[9px] font-semibold text-[#a34b16] disabled:opacity-60"><X size={10} />Set to 0</button>
        </li>)}</ul>}
        {editingId === table._id ? <div className="mt-4 flex gap-2"><input aria-label={`New capacity for table ${table.tableNumber}`} type="number" min={Math.max(1, table.occupiedSeats)} max="100" value={editingCapacity} onChange={event => setEditingCapacity(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-[#e6e9e1] px-3 py-2 text-[11px]" /><button disabled={saving} onClick={() => saveCapacity(table)} className="flex items-center gap-1 rounded-lg bg-[#c65d1b] px-3 text-[10px] font-semibold text-white"><Check size={13} />Save</button><button onClick={() => setEditingId('')} className="rounded-lg border border-[#eceee8] px-3 text-[10px]">Cancel</button></div> :
          <div className="mt-4 flex flex-wrap gap-2">
            {seatingId === table._id ? <div className="flex w-full gap-2"><input autoFocus aria-label={`People to seat at table ${table.tableNumber}`} type="number" min="1" max={table.capacity - table.occupiedSeats} value={seatingCount} onChange={event => setSeatingCount(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-[#e6e9e1] px-3 py-2 text-[11px]" /><button disabled={saving} onClick={() => seatParty(table)} className="flex items-center gap-1 rounded-lg bg-[#c65d1b] px-3 text-[10px] font-semibold text-white"><Check size={13} />Seat</button><button onClick={() => setSeatingId('')} className="rounded-lg border border-[#eceee8] px-3 text-[10px]">Cancel</button></div> :
              table.occupiedSeats < table.capacity && <button onClick={() => { setSeatingId(table._id); setSeatingCount('2') }} className="rounded-lg bg-[#fff1e6] px-3 py-2 text-[10px] font-semibold text-[#a34b16]"><Plus size={11} className="mr-1 inline" />Seat walk-in</button>}
            <button onClick={() => { setEditingId(table._id); setEditingCapacity(String(table.capacity)) }} className="rounded-lg border border-[#eceee8] px-3 py-2 text-[10px] font-semibold text-[#737a70]">Edit capacity</button>
            {table.occupiedSeats > 0 ? <button disabled={saving} onClick={() => clearTable(table)} className="rounded-lg bg-[#fff1e6] px-3 py-2 text-[10px] font-semibold text-[#a34b16] disabled:opacity-60">Clear table · set to 0</button> : <button disabled={saving} onClick={() => removeTable(table)} aria-label={`Remove table ${table.tableNumber}`} className="grid size-8 place-items-center rounded-lg border border-[#eceee8] text-[#a44f3d] disabled:opacity-60"><Trash2 size={14} /></button>}
          </div>}
      </article>)}</div>}
  </div>
}

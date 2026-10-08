import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { Armchair, Check, Plus, Trash2, Users, X } from 'lucide-react'
import { API_BASE_URL, api } from '../../lib/api.js'

export function TablesPage({ user, canManage = true }) {
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
      <p className="mt-1 text-[12px] text-[#94a3b8]">Set each table’s number and seat limit. Customers check in from their phones; seat walk-ins yourself and release a party’s chairs when they finish.</p>
    </div>
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-[#fef2f2] px-3 py-2.5 text-[11px] text-[#dc2626]"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
    {canManage && <form onSubmit={createTable} className="grid gap-3 rounded-2xl border border-[#e7ebf0] bg-white p-4 sm:grid-cols-[minmax(0,1fr)_minmax(130px,.55fr)_auto] sm:items-end">
      <label className="block text-[10px] font-semibold text-[#64748b]">Table number<input required maxLength="32" value={tableNumber} onChange={event => setTableNumber(event.target.value)} placeholder="e.g. 12 or Patio A" className="mt-1.5 block w-full rounded-lg border border-[#e7ebf0] px-3 py-2.5 text-[12px]" /></label>
      <label className="block text-[10px] font-semibold text-[#64748b]">Maximum seats<input required type="number" min="1" max="100" step="1" value={capacity} onChange={event => setCapacity(event.target.value)} className="mt-1.5 block w-full rounded-lg border border-[#e7ebf0] px-3 py-2.5 text-[12px]" /></label>
      <button disabled={saving} className="flex min-h-8 items-center justify-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-60 sm:min-h-10 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-[11px]"><Plus size={14} />Add table</button>
    </form>}
    {!tables.length ? <div className="rounded-2xl border border-dashed border-[#dbe1ea] bg-white px-5 py-12 text-center"><Armchair className="mx-auto text-[#f97316]" size={26} /><p className="mt-3 text-[12px] font-semibold">No tables set up yet</p><p className="mt-1 text-[10px] text-[#94a3b8]">Add your tables here so customers can select one when ordering.</p></div> :
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-3">{tables.map(table => <article key={table._id} className="rounded-2xl border border-[#e7ebf0] bg-white p-2.5 sm:p-4">
        <div className="flex items-start justify-between gap-1.5 sm:gap-3"><div className="min-w-0"><h3 className="font-display truncate text-[11px] font-bold leading-4 sm:text-[15px] sm:leading-normal">Table {table.tableNumber}</h3><p className="mt-0.5 flex items-center gap-1 text-[8px] leading-[12px] text-[#94a3b8] sm:mt-1 sm:gap-1.5 sm:text-[10px] sm:leading-normal"><Users size={11} className="shrink-0" />{table.occupiedSeats} of {table.capacity}</p></div><span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[7px] font-semibold leading-[12px] sm:px-2.5 sm:py-1 sm:text-[9px] sm:leading-normal ${table.occupiedSeats >= table.capacity ? 'bg-[#fef2f2] text-[#dc2626]' : 'bg-[#fff4ec] text-[#ea580c]'}`}>{table.occupiedSeats >= table.capacity ? 'Full' : `${table.capacity - table.occupiedSeats} free`}</span></div>
        {Boolean(table.reservations?.length) && <ul className="mt-2 space-y-1 border-t border-dashed border-[#e7ebf0] pt-2 sm:mt-3 sm:space-y-1.5 sm:pt-3">{table.reservations.map(reservation => <li key={reservation.visitId} className="flex items-center justify-between gap-1.5 text-[8px] sm:gap-2 sm:text-[10px]">
          <span className="flex min-w-0 items-center gap-1 text-[#334155] sm:gap-1.5"><Users size={10} className="shrink-0 text-[#f97316] sm:size-[11px]" />{reservation.guestCount} {reservation.guestCount === 1 ? 'person' : 'people'}<span className="hidden rounded-full bg-[#f1f5f9] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-[#94a3b8] sm:inline">{reservation.source === 'CHEF' ? 'Seated by chef' : 'Self check-in'}</span></span>
          {canManage && <button disabled={saving} onClick={() => releaseParty(table, reservation.visitId, reservation.guestCount)} title="Party finished — set chairs to 0" className="flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-lg bg-[#fff4ec] px-1 py-0.5 text-[8px] font-semibold text-[#ea580c] disabled:opacity-60 sm:gap-1 sm:px-2 sm:py-1 sm:text-[9px]"><X size={9} className="sm:size-[10px]" />0</button>}
        </li>)}</ul>}
        {canManage && (editingId === table._id ? <div className="mt-2 flex flex-col gap-1.5 sm:mt-4 sm:flex-row sm:gap-2"><input aria-label={`New capacity for table ${table.tableNumber}`} type="number" min={Math.max(1, table.occupiedSeats)} max="100" value={editingCapacity} onChange={event => setEditingCapacity(event.target.value)} className="w-full rounded-lg border border-[#e7ebf0] px-2.5 py-2 text-[13px] sm:w-auto sm:min-w-0 sm:flex-1 sm:px-3 sm:py-2 sm:text-[11px]" /><button disabled={saving} onClick={() => saveCapacity(table)} className="flex items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-[#f97316] px-3 py-1.5 text-[10px] font-semibold text-white sm:px-3 sm:text-[10px]"><Check size={13} className="sm:size-[13px]" />Save</button><button onClick={() => setEditingId('')} className="whitespace-nowrap rounded-lg border border-[#e7ebf0] px-3 py-1.5 text-[10px] sm:px-3 sm:text-[10px]">Cancel</button></div> :
          <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2">
            {seatingId === table._id ? <div className="flex w-full flex-col gap-1.5 sm:flex-row sm:gap-2"><input autoFocus aria-label={`People to seat at table ${table.tableNumber}`} type="number" min="1" max={table.capacity - table.occupiedSeats} value={seatingCount} onChange={event => setSeatingCount(event.target.value)} className="w-full rounded-lg border border-[#e7ebf0] px-2.5 py-2 text-[13px] sm:w-auto sm:min-w-0 sm:flex-1 sm:px-3 sm:py-2 sm:text-[11px]" /><button disabled={saving} onClick={() => seatParty(table)} className="flex items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-[#f97316] px-3 py-1.5 text-[10px] font-semibold text-white sm:px-3 sm:text-[10px]"><Check size={13} className="sm:size-[13px]" />Seat</button><button onClick={() => setSeatingId('')} className="whitespace-nowrap rounded-lg border border-[#e7ebf0] px-3 py-1.5 text-[10px] sm:px-3 sm:text-[10px]">Cancel</button></div> :
              table.occupiedSeats < table.capacity && <button onClick={() => { setSeatingId(table._id); setSeatingCount('2') }} className="whitespace-nowrap rounded-lg bg-[#fff4ec] px-1.5 py-0.5 text-[8px] font-semibold text-[#ea580c] sm:px-3 sm:py-2 sm:text-[10px]"><Plus size={10} className="mr-0.5 inline sm:mr-1 sm:size-[11px]" />Seat walk-in</button>}
            <button onClick={() => { setEditingId(table._id); setEditingCapacity(String(table.capacity)) }} className="whitespace-nowrap rounded-lg border border-[#e7ebf0] px-1.5 py-0.5 text-[8px] font-semibold text-[#64748b] sm:px-3 sm:py-2 sm:text-[10px]">Edit</button>
            {table.occupiedSeats > 0 ? <button disabled={saving} onClick={() => clearTable(table)} className="whitespace-nowrap rounded-lg bg-[#fff4ec] px-1.5 py-0.5 text-[8px] font-semibold text-[#ea580c] disabled:opacity-60 sm:px-3 sm:py-2 sm:text-[10px]">Clear · 0</button> : <button disabled={saving} onClick={() => removeTable(table)} aria-label={`Remove table ${table.tableNumber}`} className="grid size-6 place-items-center rounded-lg border border-[#e7ebf0] text-[#dc2626] disabled:opacity-60 sm:size-8"><Trash2 size={14} /></button>}
</div>)}
      </article>)}</div>}
  </div>
}

import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import { ArrowRight, Check, ChefHat, CircleHelp, Clock3, Leaf, Mail, MessageCircle, Minus, Phone, Plus, Users, X } from 'lucide-react'
import { API_BASE_URL, apiAssetUrl, request } from '../../lib/api.js'
import { money } from '../../lib/money.js'
import { Brand } from '../Brand/Brand.jsx'
import { OrderProgress } from '../OrderProgress/OrderProgress.jsx'

const visitKey = (hotelId, tableNumber) => `waga-bits-visit:${hotelId}:${tableNumber}`
// Keep only digits for tel: and wa.me links (wa.me requires country format without +).
const telHref = value => `tel:${String(value || '').replace(/[^\d+]/g, '')}`
const waHref = value => {
  const digits = String(value || '').replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : ''
}
const activeOrderKey = hotelId => `waga-bits-active-order:${hotelId}`
const ORDER_STEPS = ['Pending', 'Preparing', 'Ready', 'Served']
const STATUS_COPY = {
  Pending: 'The kitchen has received your order.',
  Preparing: 'The kitchen is preparing your food.',
  Ready: 'Your food is ready — a waiter is bringing it over.',
  Served: 'Enjoy your meal! This order has been served.',
  Cancelled: 'This order was cancelled. Please ask staff for help.',
}

export default function CustomerApp() {
  const params = new URLSearchParams(window.location.search)
  const [slug, setSlug] = useState(params.get('hotel') || '')
  const [selectedTable, setSelectedTable] = useState(params.get('table') || '')
  const [partySize, setPartySize] = useState(1)
  const [visitId, setVisitId] = useState('')
  const [pendingReservation, setPendingReservation] = useState(false)
  const [checkInError, setCheckInError] = useState('')
  const [hotel, setHotel] = useState(null)
  const [menu, setMenu] = useState([])
  const [categoriesFromServer, setCategoriesFromServer] = useState([])
  const [tables, setTables] = useState([])
  const [category, setCategory] = useState('All')
  const [cart, setCart] = useState([])
  const [quantityDraft, setQuantityDraft] = useState({})
  const [order, setOrder] = useState(null)
  const [trackingOpen, setTrackingOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [customerName, setCustomerName] = useState(sessionStorage.getItem('waga-bits-guest-name') || '')
  const [busy, setBusy] = useState(false)
  const [loadingMenu, setLoadingMenu] = useState(true)
  const [error, setError] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)
  const support = hotel?.support || {}

  const loadMenu = async currentSlug => {
    const path = currentSlug ? `/api/menu?hotel=${encodeURIComponent(currentSlug)}` : '/api/menu'
    const response = await request(path)
    setHotel(response.hotel)
    setSlug(response.hotel.slug)
    setMenu(response.items)
    setCategoriesFromServer(Array.isArray(response.categories) ? response.categories : [])
    setTables(response.tables || [])
    setError('')
  }

  useEffect(() => {
    loadMenu(slug)
      .catch(err => setError(err.message))
      .finally(() => setLoadingMenu(false))
  }, [])

  useEffect(() => {
    if (!slug) return undefined
    const socket = io(API_BASE_URL || undefined, { withCredentials: true })
    socket.emit('join_menu', slug)
    const refreshMenu = () => loadMenu(slug).catch(err => setError(err.message))
    socket.on('menu_updated', refreshMenu)
    socket.on('tables_updated', refreshMenu)
    socket.on('support_updated', updatedSupport => setHotel(previous => previous ? { ...previous, support: updatedSupport } : previous))
    return () => socket.disconnect()
  }, [slug])

  // Restore an existing table visit after a refresh; drop it when the chef
  // has cleared the table (it shows zero occupied seats again).
  useEffect(() => {
    if (!hotel?._id || !selectedTable) {
      setVisitId('')
      setPartySize(1)
      return
    }
    const key = visitKey(hotel._id, selectedTable)
    const stored = sessionStorage.getItem(key)
    if (!stored) {
      setVisitId('')
      setPartySize(1)
      return
    }
    let visit
    try {
      visit = JSON.parse(stored)
    } catch {
      sessionStorage.removeItem(key)
      setVisitId('')
      setPartySize(1)
      return
    }
    const guests = Number.isInteger(visit.guestCount) ? visit.guestCount : 1
    const currentTable = tables.find(entry => entry.tableNumber === selectedTable)
    if (visit.id && !pendingReservation && currentTable && currentTable.occupiedSeats === 0) {
      sessionStorage.removeItem(key)
      setVisitId('')
      setPartySize(1)
      return
    }
    setPartySize(guests)
    setVisitId(visit.id || '')
  }, [hotel?._id, selectedTable, tables, pendingReservation])

  useEffect(() => {
    if (!order?._id) return undefined
    const socket = io(API_BASE_URL || undefined, { withCredentials: true })
    socket.emit('join_order', order._id)
    socket.on('order_status', status => setOrder(previous => ({ ...previous, ...status })))
    return () => socket.disconnect()
  }, [order?._id])

  // After a refresh, reconnect to the order the guest placed so they keep
  // seeing where their food has reached.
  useEffect(() => {
    if (!hotel?._id) return undefined
    let stored
    try { stored = JSON.parse(sessionStorage.getItem(activeOrderKey(hotel._id)) || 'null') } catch { stored = null }
    if (!stored?.id) return undefined
    request(`/api/orders/${stored.id}/status`)
      .then(response => {
        setOrder(response.order)
        setTrackingOpen(false)
      })
      .catch(() => sessionStorage.removeItem(activeOrderKey(hotel._id)))
    return undefined
  }, [hotel?._id])

  // Show every category the kitchen created, even ones without any menu items yet.
  const categories = useMemo(() => {
    const fromCategories = (categoriesFromServer && categoriesFromServer.length)
      ? categoriesFromServer
      : [...new Set(menu.map(item => item.category))]
    return ['All', ...fromCategories]
  }, [categoriesFromServer, menu])
  const visibleItems = category === 'All' ? menu : menu.filter(item => item.category === category)
  const itemCount = cart.reduce((total, item) => total + item.quantity, 0)
  const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0)
  const selectedTableInfo = tables.find(entry => entry.tableNumber === selectedTable)
  const enoughSeats = Boolean(selectedTableInfo && (visitId || partySize <= selectedTableInfo.availableSeats))
  const sortedTables = [...tables].sort((left, right) => left.tableNumber.localeCompare(right.tableNumber, undefined, { numeric: true, sensitivity: 'base' }))

  const updateName = value => {
    setCustomerName(value)
    try { sessionStorage.setItem('waga-bits-guest-name', value) } catch { /* storage unavailable */ }
  }

  const changeQuantity = (item, amount) => {
    setQuantityDraft(previous => {
      if (!(item._id in previous)) return previous
      const next = { ...previous }
      delete next[item._id]
      return next
    })
    setCart(previous => {
      const existing = previous.find(entry => entry._id === item._id)
      if (!existing && amount > 0) return [...previous, { ...item, quantity: 1 }]
      return previous.map(entry => entry._id === item._id
        ? { ...entry, quantity: entry.quantity + amount }
        : entry).filter(entry => entry.quantity > 0)
    })
  }

  // The customer types the exact amount they want, e.g. 2 teas or 5 chapati.
  const setQuantity = (item, raw) => {
    setQuantityDraft(previous => ({ ...previous, [item._id]: raw }))
    if (!/^\d+$/.test(raw)) return
    const quantity = Math.min(50, Number(raw))
    setCart(previous => {
      if (quantity === 0) return previous.filter(entry => entry._id !== item._id)
      const existing = previous.find(entry => entry._id === item._id)
      if (!existing) return [...previous, { ...item, quantity }]
      return previous.map(entry => entry._id === item._id ? { ...entry, quantity } : entry)
    })
  }

  const clearQuantityDraft = itemId => setQuantityDraft(previous => {
    if (!(itemId in previous)) return previous
    const next = { ...previous }
    delete next[itemId]
    return next
  })

  const adoptTableState = (previous, tableNumber, table) => previous.map(entry => entry.tableNumber === tableNumber
    ? { ...entry, occupiedSeats: table.occupiedSeats, availableSeats: table.availableSeats }
    : entry)

  // Check in as soon as the guest picks a table so the kitchen sees the party
  // before any food is ordered. Returns the visit id, or '' on failure.
  const checkIn = async (id, guests) => {
    if (!hotel?._id || !selectedTableInfo) {
      setCheckInError('Choose an available table to check in.')
      return ''
    }
    const currentVisitId = id || crypto.randomUUID()
    const guestsToReserve = guests ?? partySize
    const key = visitKey(hotel._id, selectedTable)
    sessionStorage.setItem(key, JSON.stringify({ id: currentVisitId, guestCount: guestsToReserve }))
    setVisitId(currentVisitId)
    setPendingReservation(true)
    try {
      const response = await request('/api/tables/check-in', {
        method: 'POST',
        body: JSON.stringify({
          hotel: slug,
          tableNumber: selectedTable,
          guestCount: guestsToReserve,
          visitId: currentVisitId,
        }),
      })
      setTables(previous => adoptTableState(previous, selectedTable, response.table))
      setCheckInError('')
      return currentVisitId
    } catch (err) {
      sessionStorage.removeItem(key)
      setVisitId('')
      setCheckInError(err.message)
      return ''
    } finally {
      setPendingReservation(false)
    }
  }

  // Switching tables releases the seats held at the previous table first, so
  // no ghost party is left behind there.
  const handleTableSelect = async value => {
    if (value === selectedTable) return
    const previousTable = selectedTable
    setSelectedTable(value)
    setCheckInError('')
    if (!visitId || !previousTable || !hotel?._id) return
    const key = visitKey(hotel._id, previousTable)
    try {
      const response = await request('/api/tables/check-in', {
        method: 'DELETE',
        body: JSON.stringify({ hotel: slug, tableNumber: previousTable, visitId }),
      })
      setTables(previous => adoptTableState(previous, previousTable, response.table))
    } catch {
      // The chef can still release those seats manually from the tables page.
    }
    sessionStorage.removeItem(key)
    setVisitId('')
    setPartySize(1)
    if (!value) return
    const target = tables.find(entry => entry.tableNumber === value)
    if (!target) return
    const guests = Math.max(1, Math.min(partySize, target.capacity))
    setPartySize(guests)
    const currentVisitId = crypto.randomUUID()
    sessionStorage.setItem(visitKey(hotel._id, value), JSON.stringify({ id: currentVisitId, guestCount: guests }))
    setVisitId(currentVisitId)
    setPendingReservation(true)
    try {
      const response = await request('/api/tables/check-in', {
        method: 'POST',
        body: JSON.stringify({ hotel: slug, tableNumber: value, guestCount: guests, visitId: currentVisitId }),
      })
      setTables(previous => adoptTableState(previous, value, response.table))
      setCheckInError('')
    } catch (err) {
      sessionStorage.removeItem(visitKey(hotel._id, value))
      setVisitId('')
      setCheckInError(err.message)
    } finally {
      setPendingReservation(false)
    }
  }

  const changePartySize = async guests => {
    if (!Number.isFinite(guests)) return
    const next = Math.max(1, Math.min(guests, selectedTableInfo?.capacity || 100))
    if (!visitId) {
      setPartySize(next)
      return
    }
    setBusy(true)
    try {
      const response = await request('/api/tables/check-in', {
        method: 'PATCH',
        body: JSON.stringify({ hotel: slug, tableNumber: selectedTable, guestCount: next, visitId }),
      })
      setTables(previous => adoptTableState(previous, selectedTable, response.table))
      setPartySize(next)
      sessionStorage.setItem(visitKey(hotel._id, selectedTable), JSON.stringify({ id: visitId, guestCount: next }))
      setCheckInError('')
    } catch (err) {
      setCheckInError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const submitOrder = async () => {
    if (!selectedTableInfo) {
      setError('Choose an available table to place your order.')
      return
    }
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > selectedTableInfo.capacity || !enoughSeats) {
      setError('This table does not have enough free seats for your group. Choose another table or reduce your party size.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const currentVisitId = visitId || await checkIn('', partySize)
      if (!currentVisitId) {
        setError('We could not reserve your seats. Please try again.')
        return
      }
      const response = await request('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          hotel: slug,
          tableNumber: selectedTable,
          guestCount: partySize,
          visitId: currentVisitId,
          notes,
          customerName: customerName.trim().slice(0, 80),
          items: cart.map(item => ({ menuItem: item._id, quantity: item.quantity })),
        }),
      })
      setTables(previous => previous.map(entry => entry.tableNumber === selectedTable
        ? { ...entry, occupiedSeats: response.table.occupiedSeats, availableSeats: response.table.capacity - response.table.occupiedSeats }
        : entry))
      setOrder(response.order)
      setTrackingOpen(true)
      try { sessionStorage.setItem(activeOrderKey(hotel._id), JSON.stringify({ id: response.order._id })) } catch { /* storage unavailable */ }
      setNotes('')
      setCart([])
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Guest is leaving: release their seats so the table can take new customers.
  const releaseSeats = async () => {
    if (!visitId) return
    setBusy(true)
    try {
      const response = await request('/api/tables/check-in', {
        method: 'DELETE',
        body: JSON.stringify({ hotel: slug, tableNumber: selectedTable, visitId }),
      })
      sessionStorage.removeItem(visitKey(hotel._id, selectedTable))
      setTables(previous => adoptTableState(previous, selectedTable, response.table))
      setVisitId('')
      setPartySize(1)
      setCheckInError('')
    } catch (err) {
      setCheckInError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!hotel) return <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-4 py-6 sm:px-5">
    <Brand />
    <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm">
      {loadingMenu ? <><span className="mx-auto block size-8 animate-spin rounded-full border-2 border-stone-200 border-t-[#c65d1b]" /><h1 className="font-display mt-5 text-xl font-bold">Loading today’s menu…</h1></> : <><h1 className="font-display text-xl font-bold">Menu unavailable</h1><p className="mt-2 text-sm leading-6 text-stone-500">{error || 'The business menu is not available right now.'}</p><button onClick={() => { setLoadingMenu(true); loadMenu(slug).catch(err => setError(err.message)).finally(() => setLoadingMenu(false)) }} className="mt-5 rounded-xl bg-[#c65d1b] px-5 py-3 text-sm font-semibold text-white">Try again</button></>}
    </section>
  </main>

  return <div className="min-h-screen">
    <header className="sticky top-0 z-10 border-b border-[#edeee8] bg-white/95 px-3 py-3 backdrop-blur sm:px-4">
      <div className="mx-auto flex min-w-0 max-w-5xl items-center justify-between gap-3">
        <div className="shrink-0"><Brand /></div>
        <div className="min-w-0 text-right"><p className="truncate text-xs font-semibold">{hotel?.name || 'Loading menu…'}</p><p className="mt-0.5 text-[10px] text-stone-500">{selectedTable ? `Table ${selectedTable}` : 'Choose a table when ordering'}</p></div>
        {(support.phone || support.whatsapp || support.email || support.message) && <button onClick={() => setHelpOpen(true)} aria-label="Help & support" className="grid size-9 shrink-0 place-items-center rounded-full border border-[#f0dfd1] bg-[#fff9f4] text-[#b5571d]"><CircleHelp size={18} /></button>}
      </div>
    </header>
    <main className="mx-auto max-w-5xl px-3 pb-36 pt-4 sm:px-6 sm:pb-32 sm:pt-8">
      <div className="mb-5 sm:mb-7"><p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#bd6424]"><Leaf size={13} /> Fresh from the kitchen</p><h1 className="font-display text-2xl font-extrabold tracking-[-1px] min-[400px]:text-3xl sm:text-4xl">Good food, right<br className="sm:hidden" /> where you are.</h1><p className="mt-2 text-sm text-stone-500">Browse the menu and order straight to your table. The kitchen sees your table the moment you check in.</p></div>
      {error && <div className="mb-4 flex items-center justify-between rounded-xl bg-[#fae9e5] p-3 text-xs text-[#a44f3d]"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss"><X size={15} /></button></div>}
      {order && trackingOpen ? <OrderProgress order={order} table={selectedTable || order.tableNumber} onNewOrder={() => setTrackingOpen(false)} /> : <>
        {order && <button onClick={() => setTrackingOpen(true)} className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-[#f0dfd1] bg-[#fff9f4] p-3 text-left shadow-sm sm:mb-6 sm:p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#b5571d] text-white">{order.status === 'Served' ? <Check size={18} /> : <Clock3 size={18} />}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold">Order #{String(order._id).slice(-6).toUpperCase()} · Table {order.tableNumber}</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-stone-500"><span className={`size-1.5 shrink-0 rounded-full ${order.status === 'Served' ? 'bg-emerald-500' : 'animate-pulse bg-[#c65d1b]'}`} />{STATUS_COPY[order.status] || order.status}</span>
            <span className="mt-2 flex gap-1">{ORDER_STEPS.map((step, index) => <i key={step} className={`h-1 flex-1 rounded-full ${index <= ORDER_STEPS.indexOf(order.status) ? 'bg-[#c65d1b]' : 'bg-[#f0dfd1]'}`} />)}</span>
          </span>
          <ArrowRight size={15} className="shrink-0 text-[#b5571d]" />
        </button>}
        <section className="mb-6 rounded-2xl border border-[#f0dfd1] bg-[#fff9f4] p-4 sm:p-5">
          <h2 className="font-display text-sm font-bold">Choose your table</h2>
          <p className="mt-1 text-[10px] text-stone-500">Pick your table and group size — checking in tells the kitchen you have arrived.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-[10px] font-semibold text-stone-600">Available table
              <select required value={selectedTable} onChange={event => handleTableSelect(event.target.value)} className="mt-1 block w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-[#d08445]">
                <option value="">Select a table</option>
                {sortedTables.map(entry => <option key={entry._id} value={entry.tableNumber} disabled={entry.availableSeats === 0 && !(selectedTable === entry.tableNumber && visitId)}>
                  Table {entry.tableNumber} · {entry.availableSeats} of {entry.capacity} seats free{entry.availableSeats === 0 ? ' · Full' : ''}
                </option>)}
              </select>
              {!tables.length && <span className="mt-1 block text-[9px] font-normal text-[#a44f3d]">No tables are available yet. Please ask staff for help.</span>}
            </label>
            <label className="block text-[10px] font-semibold text-stone-600">Your name (optional)
              <input type="text" maxLength="80" value={customerName} onChange={event => updateName(event.target.value)} placeholder="e.g. Sarah" className="mt-1 block w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-[#d08445]" />
            </label>
            <label className="block text-[10px] font-semibold text-stone-600">People in your group
              <input required type="number" min="1" max={selectedTableInfo?.capacity || 1} step="1" value={partySize} disabled={!selectedTable || pendingReservation || busy} onChange={event => changePartySize(Number(event.target.value))} className="mt-1 block w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-[#d08445] disabled:bg-stone-50" />
              {selectedTableInfo && <span className={`mt-1 block text-[9px] font-normal ${enoughSeats ? 'text-stone-500' : 'text-[#a44f3d]'}`}>{visitId ? `${partySize} ${partySize === 1 ? 'seat is' : 'seats are'} reserved for your table visit.` : enoughSeats ? `${selectedTableInfo.availableSeats} seats currently free.` : 'Not enough free seats for this group. Choose another table or reduce the group size.'}</span>}
            </label>
          </div>
          {checkInError && <div className="mt-3 rounded-lg bg-[#fae9e5] px-3 py-2 text-[10px] text-[#a44f3d]">{checkInError}</div>}
          {visitId && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#fff5ed] px-3 py-2 text-[10px] text-[#a34b16]"><span className="flex items-center gap-1.5"><Users size={12} />{partySize} {partySize === 1 ? 'person is' : 'people are'} seated at table {selectedTable}.</span><button disabled={busy || pendingReservation} onClick={releaseSeats} className="rounded-lg border border-[#ecd9c3] bg-white px-2.5 py-1.5 text-[9px] font-semibold text-[#a34b16] disabled:opacity-60">Leaving — release seats</button></div>}
        </section>
        <div className="scrollbar-hidden mb-4 flex gap-1.5 overflow-x-auto pb-1 sm:mb-5 sm:gap-2">{categories.map(item => <button key={item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-semibold sm:px-4 sm:py-2 sm:text-xs ${item === category ? 'border-[#c65d1b] bg-[#c65d1b] text-white' : 'border-stone-200 bg-white text-stone-600'}`}>{item}</button>)}</div>
        {menu.length === 0 ? <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-5 py-14 text-center"><ChefHat className="mx-auto text-[#d88340]" size={28} /><p className="mt-3 text-sm font-semibold">The menu is being prepared</p><p className="mt-1 text-xs text-stone-500">Please check again in a little while.</p></div> :
          visibleItems.length === 0 ? <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-5 py-14 text-center"><ChefHat className="mx-auto text-[#d88340]" size={28} /><p className="mt-3 text-sm font-semibold">Nothing in {category} yet</p><p className="mt-1 text-xs text-stone-500">The kitchen is still working on this category. Check back soon.</p></div> :
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">{visibleItems.map(item => {
            const quantity = cart.find(entry => entry._id === item._id)?.quantity || 0
            return <article key={item._id} className="flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[0_4px_20px_rgba(40,48,36,.035)]">
              {item.imageUrl ? <img src={apiAssetUrl(item.imageUrl)} alt={item.name} className="h-28 w-full object-cover sm:h-48" /> : <div className="grid h-28 w-full place-items-center bg-[#fff4eb] text-[#b77b52] sm:h-48"><ChefHat className="h-7 w-7 sm:h-[34px] sm:w-[34px]" strokeWidth={1.4} /></div>}
              <div className="flex flex-1 flex-col p-2.5 sm:p-4"><div className="flex items-start justify-between gap-2 sm:gap-3"><div className="min-w-0 flex-1"><span className="text-[8px] font-bold uppercase tracking-[1px] text-[#d88340] sm:text-[9px]">{item.category}</span><h2 className="font-display mt-0.5 break-words text-xs font-bold sm:mt-1 sm:text-sm">{item.name}</h2></div><b className="shrink-0 whitespace-nowrap text-xs font-bold text-[#7a431f] sm:text-sm sm:font-normal sm:text-inherit">{money(item.price)}</b></div><p className="mt-1.5 line-clamp-2 break-words text-[10px] leading-4 text-stone-500 sm:mt-2 sm:line-clamp-none sm:min-h-9 sm:text-xs sm:leading-5">{item.description}</p>
                <div className="mt-auto" />
                {quantity ? <div className="mt-2 flex items-center justify-between rounded-xl bg-[#fff5ed] p-1 sm:mt-3"><button onClick={() => changeQuantity(item, -1)} className="grid size-8 place-items-center rounded-lg bg-white text-[#c65d1b] sm:size-9" aria-label={`Remove ${item.name}`}><Minus size={14} /></button><label className="flex items-center gap-1"><input type="number" min="1" max="50" step="1" inputMode="numeric" value={quantityDraft[item._id] ?? String(quantity)} onChange={event => setQuantity(item, event.target.value)} onBlur={() => clearQuantityDraft(item._id)} aria-label={`Amount of ${item.name}`} className="w-10 rounded-lg border border-[#f0dfd1] bg-white px-1.5 py-1.5 text-center text-xs font-bold text-[#7a431f] outline-none focus:border-[#d08445] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none sm:w-14 sm:px-2" /><span className="hidden text-[9px] font-semibold text-[#a3765a] sm:inline">in order</span></label><button onClick={() => changeQuantity(item, 1)} className="grid size-8 place-items-center rounded-lg bg-[#c65d1b] text-white sm:size-9" aria-label={`Add ${item.name}`}><Plus size={14} /></button></div> :
                  <button onClick={() => changeQuantity(item, 1)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#fff4eb] py-2 text-[11px] font-semibold text-[#c65d1b] hover:bg-[#fff1e6] sm:mt-3 sm:gap-2 sm:py-2.5 sm:text-xs"><Plus size={13} />Add to order</button>}
              </div>
            </article>
          })}</div>}
      </>}
    </main>
    {helpOpen && <HelpSheet support={support} hotelName={hotel.name} onClose={() => setHelpOpen(false)} />}
    {itemCount > 0 && !trackingOpen && <div className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white/95 px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-6px_24px_rgba(40,48,36,.06)] backdrop-blur sm:px-4"><div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-3"><div className="flex w-full items-center gap-2 sm:w-auto sm:max-w-sm sm:flex-col sm:items-stretch sm:gap-3"><label className="min-w-0 flex-1 text-[10px] font-semibold text-stone-500">Name<input type="text" maxLength="80" value={customerName} onChange={event => updateName(event.target.value)} placeholder="Who is this for?" className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-xs outline-none focus:border-[#d08445]" /></label><label className="min-w-0 flex-1 text-[10px] font-semibold text-stone-500">Instructions<textarea rows="1" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Allergies?" className="mt-1 block w-full resize-none rounded-lg border border-stone-200 px-3 py-2 text-xs outline-none focus:border-[#d08445]" /></label></div><div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end sm:gap-4"><div className="min-w-0 text-left sm:text-right"><p className="text-xs font-bold">{itemCount} {itemCount === 1 ? 'item' : 'items'}{selectedTable ? ` · Table ${selectedTable}` : ''}</p><p className="mt-0.5 text-[10px] text-stone-500">{money(subtotal)}</p></div><button disabled={busy || !selectedTableInfo || !enoughSeats} onClick={submitOrder} className="flex shrink-0 items-center gap-2 rounded-xl bg-[#c65d1b] px-4 py-3 text-xs font-semibold text-white disabled:opacity-60">{busy ? 'Sending…' : 'Place order'}<ArrowRight size={15} /></button></div></div></div>}
  </div>
}

// Bottom sheet with the business's help & support details. On phones it docks
// to the bottom like a native app; on larger screens it centers as a dialog.
function HelpSheet({ support, hotelName, onClose }) {
  const contacts = [
    support.phone && { key: 'phone', icon: Phone, label: 'Call the business', value: support.phone, href: telHref(support.phone) },
    support.whatsapp && { key: 'whatsapp', icon: MessageCircle, label: 'WhatsApp us', value: support.whatsapp, href: waHref(support.whatsapp) },
    support.email && { key: 'email', icon: Mail, label: 'Email us', value: support.email, href: `mailto:${support.email}` },
  ].filter(Boolean)
  return <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#1f291d]/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-[#edeee8] bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:pb-4" role="dialog" aria-label="Help and support">
      <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-stone-200 sm:hidden" aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold">Help & support</h2>
          <p className="mt-0.5 truncate text-xs text-stone-500">{hotelName}</p>
        </div>
        <button onClick={onClose} aria-label="Close help" className="grid size-8 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-500"><X size={16} /></button>
      </div>
      {support.message && <p className="mt-3 rounded-xl bg-[#fff9f4] px-3 py-2.5 text-xs leading-5 text-[#7a431f]">{support.message}</p>}
      {contacts.length > 0 && <div className="mt-3 grid gap-2">{contacts.map(({ key, icon: Icon, label, value, href }) => <a key={key} href={href} className="flex items-center gap-3 rounded-xl border border-[#f0dfd1] bg-[#fff9f4] px-3 py-2.5" target={key === 'whatsapp' ? '_blank' : undefined} rel={key === 'whatsapp' ? 'noreferrer' : undefined}>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#c65d1b] text-white"><Icon size={16} /></span>
        <span className="min-w-0 flex-1"><span className="block text-xs font-bold">{label}</span><span className="mt-0.5 block truncate text-[11px] text-stone-500">{value}</span></span>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[9px] font-semibold text-[#a34b16]">Tap to {key === 'phone' ? 'call' : key === 'whatsapp' ? 'chat' : 'email'}</span>
      </a>)}</div>}
      {support.hours && <p className="mt-3 flex items-center gap-1.5 text-[11px] text-stone-500"><Clock3 size={13} className="shrink-0 text-[#bd6424]" />{support.hours}</p>}
      {!contacts.length && !support.message && !support.hours && <p className="mt-2 text-xs text-stone-500">Support details are not available right now. Please ask a member of staff.</p>}
    </div>
  </div>
}

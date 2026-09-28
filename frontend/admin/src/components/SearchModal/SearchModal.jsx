import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Search, ShoppingBag, Utensils, X } from 'lucide-react'
import { money, orderCode, orderTime } from '../../lib/ui.js'

const PAGE_LINKS = ['Chef orders', 'Menu', 'Tables', 'Orders', 'Reports', 'Chefs', 'Overview', 'Help & support']

export function SearchModal({ onClose, onNavigate, menu = [], orders = [], role = 'OWNER' }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  useEffect(() => {
    inputRef.current?.focus()
    const onKeyDown = event => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const trimmed = query.trim().toLowerCase()
  const pages = useMemo(() => (trimmed
    ? PAGE_LINKS.filter(name => name.toLowerCase().includes(trimmed) && !(name === 'Chef orders' && role !== 'KITCHEN') && !(name === 'Chefs' && role !== 'OWNER') && !(name === 'Help & support' && !['OWNER', 'DEVELOPER'].includes(role)))
    : PAGE_LINKS.filter(name => !(name === 'Chef orders' && role !== 'KITCHEN') && !(name === 'Chefs' && role !== 'OWNER') && !(name === 'Help & support' && !['OWNER', 'DEVELOPER'].includes(role)))
  ).slice(0, 4), [trimmed, role])
  const items = useMemo(() => (trimmed
    ? menu.filter(item => item.name?.toLowerCase().includes(trimmed) || item.category?.toLowerCase().includes(trimmed)).slice(0, 5)
    : []), [menu, trimmed])
  const matchedOrders = useMemo(() => (trimmed
    ? orders.filter(order =>
      orderCode(order).toLowerCase().includes(trimmed) ||
      String(order.tableNumber || order.table || '').toLowerCase().includes(trimmed) ||
      order.customerName?.toLowerCase().includes(trimmed)).slice(0, 5)
    : []), [orders, trimmed])

  const results = pages.length + items.length + matchedOrders.length

  return <div className="fixed inset-0 z-50 flex items-start justify-center bg-[#1f291d]/35 p-3 pt-[max(4rem,env(safe-area-inset-top))] backdrop-blur-[2px]" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-[#eceee8] bg-white shadow-2xl">
      <div className="flex items-center gap-2.5 border-b border-[#f0f1ed] px-4 py-3.5">
        <Search size={17} className="shrink-0 text-[#9b9f96]" />
        <input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search menu, orders, table numbers, guest names…" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#a6aa9f]" />
        {query && <button onClick={() => setQuery('')} aria-label="Clear search" className="grid size-6 place-items-center rounded-md text-[#72786d] hover:bg-[#f5f6f2]"><X size={13} /></button>}
        <button onClick={onClose} className="rounded-md border border-[#e7e9e3] px-1.5 py-0.5 text-[9px] font-semibold text-[#9b9f96]">ESC</button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-2">
        {results === 0 && <div className="px-3 py-10 text-center"><Search className="mx-auto text-[#c8ccc2]" size={22} /><p className="mt-2.5 text-[11px] font-semibold text-[#555e51]">{trimmed ? 'Nothing matches that search' : 'Start typing to search'}</p><p className="mt-1 text-[9px] text-[#9b9f96]">Try a dish name, order code, table number, or guest name.</p></div>}
        {pages.length > 0 && <div className="mb-1"><p className="px-3 pb-1 pt-2 text-[9px] font-bold uppercase tracking-[1px] text-[#a6aa9f]">Pages</p>{pages.map(name => <button key={name} onClick={() => { onNavigate(name); onClose() }} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[12px] font-medium text-[#41483e] hover:bg-[#fff4eb]">{name}<ArrowRight size={13} className="text-[#a6aa9f]" /></button>)}</div>}
        {items.length > 0 && <div className="mb-1"><p className="px-3 pb-1 pt-2 text-[9px] font-bold uppercase tracking-[1px] text-[#a6aa9f]">Menu items</p>{items.map(item => <button key={item._id || item.id} onClick={() => { onNavigate('Menu'); onClose() }} className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-[#fff4eb]"><span className="min-w-0"><span className="block truncate text-[12px] font-semibold text-[#293128]">{item.name}</span><span className="block text-[9px] text-[#9b9f96]">{item.category}</span></span><b className="shrink-0 text-[11px] text-[#737a6e]">{money(item.price)}</b></button>)}</div>}
        {matchedOrders.length > 0 && <div><p className="px-3 pb-1 pt-2 text-[9px] font-bold uppercase tracking-[1px] text-[#a6aa9f]">Orders</p>{matchedOrders.map(order => <button key={order._id || order.id} onClick={() => { onNavigate(order.status && ['Pending', 'Preparing', 'Ready'].includes(order.status) && role === 'KITCHEN' ? 'Chef orders' : 'Orders'); onClose() }} className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-[#fff4eb]"><span className="min-w-0"><span className="block truncate text-[12px] font-semibold text-[#293128]">#{orderCode(order)}{order.customerName ? ` · ${order.customerName}` : ''}</span><span className="block text-[9px] text-[#9b9f96]">Table {order.tableNumber || order.table} · {orderTime(order)}</span></span><b className="shrink-0 text-[11px] text-[#737a6e]">{money(order.totalAmount ?? order.total)}</b></button>)}</div>}
      </div>
    </div>
  </div>
}

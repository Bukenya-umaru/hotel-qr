import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Search, X } from 'lucide-react'

const PAGE_LINKS = [
  'Categories', 'Food type', 'Expenses', 'Stock', 'Sales', 'Make sale',
  'Purchase expenses', 'Reports', 'Chefs', 'Overview', 'Help & support',
]

export function SearchModal({ onClose, onNavigate, role = 'OWNER' }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  useEffect(() => {
    inputRef.current?.focus()
    const onKeyDown = event => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const trimmed = query.trim().toLowerCase()
  const pages = useMemo(() => PAGE_LINKS.filter(name =>
    (!trimmed || name.toLowerCase().includes(trimmed)) &&
    !(name === 'Chefs' && role !== 'OWNER') &&
    !(name === 'Help & support' && !['OWNER', 'DEVELOPER'].includes(role)),
  ).slice(0, 7), [trimmed, role])

  return <div className="fixed inset-0 z-50 flex items-start justify-center bg-[#352a24]/35 p-3 pt-[max(4rem,env(safe-area-inset-top))] backdrop-blur-[2px]" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-[#eee4df] bg-white shadow-2xl">
      <div className="flex items-center gap-2.5 border-b border-[#f1eae6] px-4 py-3.5">
        <Search size={17} className="shrink-0 text-[#a19690]" />
        <input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search sales, expenses, stock, and pages…" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#a19690]" />
        {query && <button onClick={() => setQuery('')} aria-label="Clear search" className="grid size-6 place-items-center rounded-md text-[#786d67] hover:bg-[#fff8f5]"><X size={13} /></button>}
        <button onClick={onClose} className="rounded-md border border-[#eee4df] px-1.5 py-0.5 text-[9px] font-semibold text-[#a19690]">ESC</button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-2">
        {pages.length === 0 && <div className="px-3 py-10 text-center"><Search className="mx-auto text-[#c9bcb5]" size={22} /><p className="mt-2.5 text-[11px] font-semibold text-[#635149]">Nothing matches that search</p><p className="mt-1 text-[9px] text-[#a19690]">Try a sales, expense, or stock page.</p></div>}
        <div>{pages.map(name => <button key={name} onClick={() => { onNavigate(name); onClose() }} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[12px] font-medium text-[#635149] hover:bg-[#fff6f2]">{name}<ArrowRight size={13} className="text-[#a19690]" /></button>)}</div>
      </div>
    </div>
  </div>
}

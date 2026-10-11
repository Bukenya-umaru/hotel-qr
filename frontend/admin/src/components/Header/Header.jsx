import { useState } from 'react'
import { Plus, Receipt, Search } from 'lucide-react'
import { hasPermission, today } from '../../lib/ui.js'
import { SearchModal } from '../SearchModal/SearchModal.jsx'

export function Header({ role, page, onLogin, user, titleOverride, hotelName, onNavigate }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const title = titleOverride || (page === 'Overview' ? 'Business overview' : page)
  const initials = user?.name?.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'S'
  return <header className="sticky top-0 z-10 flex min-h-[58px] items-center justify-between gap-3 border-b border-[#eee4df] bg-white px-3 py-2 sm:h-[62px] sm:px-5 sm:py-0 md:px-6">
    {page === 'Overview'
      ? <div className="min-w-0 flex-1">
        <button onClick={() => setSearchOpen(true)} aria-label="Search dashboard" className="flex h-9 w-full max-w-[330px] items-center gap-2 rounded-lg border border-[#eee4df] bg-[#fffdfc] px-2.5 text-left text-[11px] text-[#a19690] transition hover:border-[#e7654b]">
          <Search size={15} /><span>Search anything</span><span className="ml-auto hidden rounded border border-[#eee4df] px-1.5 py-0.5 text-[9px] text-[#a19690] sm:inline">⌘ K</span>
        </button>
      </div>
      : <div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2 text-[10px] text-[#a19690]"><span className="truncate">{hotelName}</span><span>/</span><span className="shrink-0">{page}</span></div><h1 className="font-display mt-0.5 truncate text-[16px] font-bold tracking-[-.6px] text-[#292421] sm:text-[20px]">{title}</h1></div>}
    <div className="flex items-center gap-2.5">
      <span className="hidden text-[10px] text-[#a19690] xl:block">{today}</span>
      {user && ['OWNER', 'KITCHEN'].includes(role) && <div className="hidden items-center gap-2 sm:flex">
        {hasPermission(user, 'manage_sales') && <button onClick={() => onNavigate('Make sale')} className="inline-flex items-center gap-1.5 rounded-lg bg-[#e7654b] px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-[#d95c43]"><Plus size={13} />Record sale</button>}
        {hasPermission(user, 'manage_expenses') && <button onClick={() => onNavigate('Purchase expenses')} className="inline-flex items-center gap-1.5 rounded-lg border border-[#eee4df] bg-white px-3 py-2 text-[10px] font-semibold text-[#655a54] transition hover:border-[#e7654b] hover:text-[#d95c43]"><Receipt size={13} />Add expense</button>}
      </div>}
      {page !== 'Overview' && <button onClick={() => setSearchOpen(true)} aria-label="Search" className="grid size-9 place-items-center rounded-xl border border-[#eee4df] bg-white text-[#786d67] transition hover:bg-[#fff7f4]"><Search size={16} /></button>}
      {user && <div className="hidden items-center gap-2.5 border-l border-[#f0e9e5] pl-3 sm:flex">
        <span className="grid size-8 place-items-center rounded-full bg-[#fff0ea] text-[10px] font-bold text-[#d95c43]">{initials}</span>
        <span className="hidden min-w-0 lg:block"><span className="block max-w-[150px] truncate text-[11px] font-semibold text-[#292421]">{user.name}</span><span className="block max-w-[150px] truncate text-[9px] text-[#a19690]">{user.email}</span></span>
      </div>}
      {!user && <button onClick={onLogin} className="ml-1 rounded-lg bg-[#e7654b] px-3.5 py-2 text-[11px] font-semibold text-white transition hover:bg-[#d95c43]">Sign in</button>}
    </div>
    {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} onNavigate={onNavigate} role={role} />}
  </header>
}

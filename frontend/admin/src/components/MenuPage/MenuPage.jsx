import { useState } from 'react'
import {
  Plus, Settings2, X,
} from 'lucide-react'
import { apiAssetUrl } from '../../lib/api.js'
import { money, cx } from '../../lib/ui.js'
import { Badge } from '../Badge/Badge.jsx'

export function MenuPage({ menu, role, manageable, onAdd, onToggle, onEdit, onDelete, categories = [] }) {
  const [category, setCategory] = useState('All items')
  const filtered = menu.filter(item => category === 'All items' || item.category === category)
  const canManageMenu = manageable

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[12px] text-[#8d9389]">{role === 'KITCHEN' ? 'Add dishes, update prices, and tell customers what is available. Categories are managed on the Categories page.' : 'Manage your dishes, pricing and availability.'}</p></div>{canManageMenu && <button onClick={onAdd} className="flex items-center gap-2 rounded-lg bg-[#c65d1b] px-3.5 py-2.5 text-[11px] font-semibold text-white hover:bg-[#a34b16]"><Plus size={15} />Add menu item</button>}</div>
    <div className="rounded-xl border border-[#eceee8] bg-white px-3 py-2.5">
      <div className="scrollbar-hidden flex min-w-0 gap-1 overflow-x-auto">{['All items', ...categories].map(name => <button key={name} onClick={() => setCategory(name)} className={cx('whitespace-nowrap rounded-lg px-3 py-1.5 text-[10px] font-medium', category === name ? 'bg-[#fff1e6] text-[#c65d1b]' : 'text-[#858b81] hover:bg-[#f7f8f5]')}>{name}</button>)}</div>
    </div>
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-3 xl:gap-4">{filtered.map(item => { const available = item.isAvailable ?? item.available; return <div key={item._id || item.id} className="flex flex-col overflow-hidden rounded-2xl border border-[#eceee8] bg-white transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative h-[84px] bg-[#f0f1ed] sm:h-[126px]">{item.imageUrl ? <img src={apiAssetUrl(item.imageUrl)} alt={item.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[10px] text-[#9ba194] sm:text-[11px]">No photo</div>}<span className="absolute left-2 top-2 sm:left-3 sm:top-3"><Badge tone={available ? 'green' : 'gray'}>{available ? 'Available' : 'Sold out'}</Badge></span>{canManageMenu && <div className="absolute right-2 top-2 flex gap-1 sm:right-3 sm:top-3"><button onClick={() => onEdit(item)} title="Edit menu item" className="grid size-7 place-items-center rounded-lg bg-white/90 text-[#71786d]"><Settings2 size={13} /></button><button onClick={() => onDelete(item)} title="Delete menu item" className="grid size-7 place-items-center rounded-lg bg-white/90 text-[#71786d]"><X size={13} /></button></div>}</div>
      <div className="flex flex-1 flex-col p-2.5 sm:p-4"><div className="flex items-start justify-between gap-1.5 sm:gap-2"><div className="min-w-0 flex-1"><span className="block truncate text-[8px] font-semibold uppercase tracking-[.9px] text-[#b77b52] sm:text-[9px]">{item.category}</span><h3 className="font-display mt-0.5 break-words text-[11px] font-bold leading-4 sm:mt-1 sm:text-[13px] sm:leading-5">{item.name}</h3></div><strong className="shrink-0 whitespace-nowrap text-[11px] text-[#7a431f] sm:text-[12px] sm:text-inherit">{money(item.price)}</strong></div><p className="mt-1 line-clamp-2 break-words text-[9px] leading-[14px] text-[#979c93] sm:mt-1.5 sm:line-clamp-none sm:min-h-[30px] sm:text-[10px] sm:leading-5">{item.description}</p>
        <div className="mt-auto" /><div className="mt-2 flex items-center justify-between border-t border-[#f0f1ed] pt-2 sm:mt-3 sm:pt-3">{role === 'OWNER' ? <div className="min-w-0"><p className="text-[8px] text-[#a0a49b] sm:text-[9px]">Item cost</p><p className="mt-0.5 truncate text-[9px] font-semibold sm:text-[10px]">{money(item.costPrice ?? 0)}</p></div> : <span className="text-[8px] text-[#a0a49b] sm:text-[9px]">Availability</span>}<button onClick={() => onToggle(item)} disabled={!['OWNER', 'KITCHEN'].includes(role)} className={cx('relative h-[19px] w-[34px] shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 sm:h-[21px] sm:w-[37px]', available ? 'bg-[#cf6a1e]' : 'bg-[#dadcd6]')} aria-label={`${available ? 'Disable' : 'Enable'} ${item.name}`}><i className={cx('absolute top-[2px] size-[15px] rounded-full bg-white transition-all', available ? 'left-[16px] sm:left-[19px]' : 'left-[2px] sm:left-[3px]')} /></button></div>
      </div>
    </div>})}
      {canManageMenu && <button onClick={onAdd} className="flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#dfe4d9] bg-[#fafbf8] text-[#b77b52] hover:border-[#dca875] hover:bg-[#fff6ef] sm:min-h-[275px] sm:gap-3"><span className="grid size-9 place-items-center rounded-full bg-white"><Plus size={16} /></span><span className="text-[10px] font-semibold sm:text-[11px]">Add another dish</span></button>}
    </div>
  </div>
}

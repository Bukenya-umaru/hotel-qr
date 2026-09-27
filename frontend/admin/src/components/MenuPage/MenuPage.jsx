import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Check, ChefHat, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, Clock3, Coffee, Command, CreditCard, Download,
  Eye, EyeOff, Filter, Globe2, Hotel, LayoutDashboard, Leaf, LogOut, Menu, MoreHorizontal,
  Package, Plus, QrCode, Search, Settings2, ShieldCheck, ShoppingBag, SlidersHorizontal,
  Sparkles, TrendingUp, Users, Utensils, Wallet, X,
} from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts'
import { api, apiAssetUrl } from '../../lib/api.js'
import { money, today, cx, orderCode, orderTime, navItems } from '../../lib/ui.js'
import { Badge } from '../Badge/Badge.jsx'

export function MenuPage({ menu, role, onAdd, onToggle, onEdit, onDelete }) {
  const [category, setCategory] = useState('All items')
  const categories = ['All items', ...new Set(menu.map(item => item.category))]
  const filtered = menu.filter(item => category === 'All items' || item.category === category)
  const canManageMenu = ['OWNER', 'KITCHEN'].includes(role)
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[12px] text-[#8d9389]">{role === 'KITCHEN' ? 'Add dishes and categories, update prices, and tell customers what is available.' : 'Manage your dishes, pricing and availability.'}</p></div>{canManageMenu && <button onClick={onAdd} className="flex items-center gap-2 rounded-lg bg-[#c65d1b] px-3.5 py-2.5 text-[11px] font-semibold text-white hover:bg-[#a34b16]"><Plus size={15} />Add menu item</button>}</div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#eceee8] bg-white px-3 py-2.5"><div className="scrollbar-hidden flex min-w-0 flex-1 gap-1 overflow-x-auto">{categories.map(name => <button key={name} onClick={() => setCategory(name)} className={cx('whitespace-nowrap rounded-lg px-3 py-1.5 text-[10px] font-medium', category === name ? 'bg-[#fff1e6] text-[#c65d1b]' : 'text-[#858b81] hover:bg-[#f7f8f5]')}>{name}</button>)}</div><button className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#eceee8] px-2.5 py-1.5 text-[10px] text-[#747b70]"><SlidersHorizontal size={13} />Filter</button></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filtered.map(item => { const available = item.isAvailable ?? item.available; return <div key={item._id || item.id} className="overflow-hidden rounded-2xl border border-[#eceee8] bg-white transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative h-[126px] bg-[#f0f1ed]">{item.imageUrl ? <img src={apiAssetUrl(item.imageUrl)} alt={item.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[11px] text-[#9ba194]">No photo</div>}<span className="absolute left-3 top-3"><Badge tone={available ? 'green' : 'gray'}>{available ? 'Available' : 'Sold out'}</Badge></span>{canManageMenu && <div className="absolute right-3 top-3 flex gap-1"><button onClick={() => onEdit(item)} title="Edit menu item" className="grid size-7 place-items-center rounded-lg bg-white/90 text-[#71786d]"><Settings2 size={14} /></button><button onClick={() => onDelete(item)} title="Delete menu item" className="grid size-7 place-items-center rounded-lg bg-white/90 text-[#71786d]"><X size={14} /></button></div>}</div>
      <div className="p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><span className="text-[9px] font-semibold uppercase tracking-[.9px] text-[#b77b52]">{item.category}</span><h3 className="font-display mt-1 break-words text-[13px] font-bold">{item.name}</h3></div><strong className="shrink-0 text-[12px]">{money(item.price)}</strong></div><p className="mt-1.5 min-h-[30px] break-words text-[10px] leading-5 text-[#979c93]">{item.description}</p>
        <div className="mt-3 flex items-center justify-between border-t border-[#f0f1ed] pt-3">{role === 'OWNER' ? <div><p className="text-[9px] text-[#a0a49b]">Item cost</p><p className="mt-0.5 text-[10px] font-semibold">{money(item.costPrice ?? 0)}</p></div> : <span className="text-[9px] text-[#a0a49b]">Availability</span>}<button onClick={() => onToggle(item)} disabled={!['OWNER', 'KITCHEN'].includes(role)} className={cx('relative h-[21px] w-[37px] rounded-full transition disabled:cursor-not-allowed disabled:opacity-60', available ? 'bg-[#cf6a1e]' : 'bg-[#dadcd6]')} aria-label={`${available ? 'Disable' : 'Enable'} ${item.name}`}><i className={cx('absolute top-[3px] size-[15px] rounded-full bg-white transition-all', available ? 'left-[19px]' : 'left-[3px]')} /></button></div>
      </div>
    </div>})}
      {canManageMenu && <button onClick={onAdd} className="flex min-h-[275px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#dfe4d9] bg-[#fafbf8] text-[#b77b52] hover:border-[#dca875] hover:bg-[#fff6ef]"><span className="grid size-10 place-items-center rounded-full bg-white"><Plus size={18} /></span><span className="text-[11px] font-semibold">Add another dish</span></button>}
    </div>
  </div>
}

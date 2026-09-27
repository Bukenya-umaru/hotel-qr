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

export function MenuPage({ menu, role, onAdd, onToggle, onEdit, onDelete, categories = [], managedCategories = [], onCreateCategory, onRenameCategory, onDeleteCategory }) {
  const [category, setCategory] = useState('All items')
  const [newCategory, setNewCategory] = useState('')
  const [renaming, setRenaming] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [categoryBusy, setCategoryBusy] = useState(false)
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  // Every category stays selectable: managed sections merged with any
  // category already in use on dishes (older free-text ones included).
  const allCategories = categories.length
    ? categories
    : [...new Set(menu.map(item => item.category).filter(Boolean))]
  const managedSet = new Set(managedCategories.map(name => name.toLowerCase()))
  const categoryList = ['All items', ...allCategories]
  const filtered = menu.filter(item => category === 'All items' || item.category === category)
  const canManageMenu = ['OWNER', 'KITCHEN'].includes(role)

  const addCategory = async event => {
    event.preventDefault()
    const name = newCategory.trim()
    if (!name) return
    if (allCategories.some(name_ => name_.toLowerCase() === name.toLowerCase())) {
      setCategoryError('That category already exists.')
      return
    }
    setCategoryBusy(true)
    try {
      await onCreateCategory(name)
      setNewCategory('')
      setCategoryError('')
    } catch (err) {
      setCategoryError(err.message)
    } finally {
      setCategoryBusy(false)
    }
  }

  const renameCategory = async () => {
    const name = renameValue.trim()
    if (!renaming || !name) return
    setCategoryBusy(true)
    try {
      await onRenameCategory(renaming, name)
      setRenaming(null)
      setCategoryError('')
    } catch (err) {
      setCategoryError(err.message)
    } finally {
      setCategoryBusy(false)
    }
  }

  const removeCategory = async name => {
    if (!window.confirm(`Remove the "${name}" section? Dishes keep their category but it will no longer be a managed section.`)) return
    setCategoryBusy(true)
    try {
      await onDeleteCategory(name)
      setCategoryError('')
    } catch (err) {
      setCategoryError(err.message)
    } finally {
      setCategoryBusy(false)
    }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[12px] text-[#8d9389]">{role === 'KITCHEN' ? 'Add dishes and categories, update prices, and tell customers what is available.' : 'Manage your dishes, pricing and availability.'}</p></div>{canManageMenu && <button onClick={onAdd} className="flex items-center gap-2 rounded-lg bg-[#c65d1b] px-3.5 py-2.5 text-[11px] font-semibold text-white hover:bg-[#a34b16]"><Plus size={15} />Add menu item</button>}</div>
    <div className="rounded-xl border border-[#eceee8] bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="scrollbar-hidden flex min-w-0 flex-1 gap-1 overflow-x-auto">{categoryList.map(name => <button key={name} onClick={() => setCategory(name)} className={cx('whitespace-nowrap rounded-lg px-3 py-1.5 text-[10px] font-medium', category === name ? 'bg-[#fff1e6] text-[#c65d1b]' : 'text-[#858b81] hover:bg-[#f7f8f5]')}>{name}</button>)}</div>
        {canManageMenu && <button onClick={() => setShowCategoryManager(previous => !previous)} className={cx('flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-medium', showCategoryManager ? 'border-[#dca875] bg-[#fff6ef] text-[#a34b16]' : 'border-[#eceee8] text-[#747b70] hover:bg-[#f7f8f5]')}><SlidersHorizontal size={13} />Sections</button>}
      </div>
      {canManageMenu && showCategoryManager && <div className="mt-3 border-t border-dashed border-[#ebede7] pt-3">
        <p className="text-[9px] font-bold uppercase tracking-[1px] text-[#a6aa9f]">Menu sections</p>
        <p className="mt-0.5 text-[9px] text-[#9b9f96]">Create the sections your menu is grouped into; dishes are filed under them when ordering.</p>
        <form onSubmit={addCategory} className="mt-2 flex flex-wrap gap-2"><input value={newCategory} onChange={event => setNewCategory(event.target.value)} maxLength="60" placeholder="New section, e.g. Breakfast" className="min-w-0 flex-1 rounded-lg border border-[#e6e9e1] px-3 py-2 text-[11px]" /><button disabled={categoryBusy} className="flex items-center gap-1.5 rounded-lg bg-[#c65d1b] px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-60"><Plus size={13} />Add section</button></form>
        <ul className="mt-2.5 flex flex-wrap gap-1.5">{allCategories.map(name => managedSet.has(name.toLowerCase())
          ? <li key={name} className="flex items-center gap-1 rounded-lg border border-[#eceee8] bg-[#fafbf8] pl-2.5 pr-1 py-1 text-[10px] font-medium text-[#555e51]">
            {renaming === name ? <><input autoFocus value={renameValue} onChange={event => setRenameValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') renameCategory(); if (event.key === 'Escape') setRenaming(null) }} maxLength="60" className="w-28 rounded border border-[#dca875] px-1.5 py-0.5 text-[10px]" /><button disabled={categoryBusy} onClick={renameCategory} className="rounded p-1 text-[#a34b16] hover:bg-[#fff1e6]"><Check size={11} /></button><button onClick={() => setRenaming(null)} className="rounded p-1 text-[#9b9f96] hover:bg-[#f0f1ed]"><X size={11} /></button></> : <>
              {name}
              <button onClick={() => { setRenaming(name); setRenameValue(name) }} title={`Rename ${name}`} className="rounded p-1 text-[#9b9f96] hover:bg-[#f0f1ed] hover:text-[#71786d]"><Settings2 size={11} /></button>
              <button disabled={categoryBusy} onClick={() => removeCategory(name)} title={`Remove ${name}`} className="rounded p-1 text-[#c08b7e] hover:bg-[#fae9e5] hover:text-[#b75c48]"><X size={11} /></button>
            </>}
          </li>
          : <li key={name} className="flex items-center gap-1 rounded-lg border border-dashed border-[#e6e9e1] bg-white pl-2.5 pr-1 py-1 text-[10px] font-medium text-[#858b81]" title="In use on dishes — add it as a section to manage it">{name}</li>)}</ul>
        {categoryError && <p className="mt-2 text-[10px] text-[#b75c48]">{categoryError}</p>}
      </div>}
    </div>
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

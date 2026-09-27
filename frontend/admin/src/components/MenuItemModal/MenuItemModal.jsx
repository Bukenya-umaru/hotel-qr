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
import { Modal } from '../Modal/Modal.jsx'
import { TextField } from '../TextField/TextField.jsx'

export function MenuItemModal({ onClose, onSubmit, initial, categories = [], role = 'OWNER' }) {
  const [form, setForm] = useState(initial ? {
    name: initial.name,
    description: initial.description || '',
    category: initial.category,
    price: initial.price,
    costPrice: initial.costPrice ?? '',
  } : { name: '', description: '', category: '', price: '', costPrice: '' })
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(apiAssetUrl(initial?.imageUrl) || '')
  const [error, setError] = useState('')
  useEffect(() => {
    if (!image) return undefined
    const url = URL.createObjectURL(image)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [image])
  return <Modal title={initial ? 'Edit menu item' : 'Add a menu item'} onClose={onClose}><form className="space-y-3.5" onSubmit={async e => { e.preventDefault(); const data = new FormData(); Object.entries(form).filter(([key]) => role === 'OWNER' || key !== 'costPrice').forEach(([key, value]) => data.append(key, value)); if (image) data.append('image', image); try { await onSubmit(data) } catch (err) { setError(err.message) } }}><TextField label="Dish name" placeholder="e.g. Coconut fish curry" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><TextField label="Description" placeholder="Describe the dish for your guests" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /><label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#737a70]">Food category</span><input list="menu-categories" required maxLength="60" className="w-full rounded-lg border border-[#e6e9e1] bg-white px-3 py-2.5 text-[12px]" placeholder="Type a category or choose an existing one" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /><datalist id="menu-categories">{categories.map(name => <option key={name} value={name} />)}</datalist><span className="mt-1 block text-[9px] text-[#a0a49b]">Enter a new category or select one already used on your menu.</span></label><div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2"><TextField label="Selling price (UGX)" type="number" min="0" step="1" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />{role === 'OWNER' && <TextField label="Cost per item (UGX)" type="number" min="0" step="1" value={form.costPrice} onChange={e => setForm({ ...form, costPrice: e.target.value })} />}</div>{role === 'KITCHEN' && <p className="text-[9px] text-[#a0a49b]">The business owner manages item costs and profit reports.</p>}<label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#737a70]">Food photo {!initial?.imageUrl && <span className="text-[#b75c48]">*</span>}</span><input required={!initial?.imageUrl} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setImage(event.target.files?.[0] || null)} className="block w-full rounded-lg border border-[#e6e9e1] bg-white px-3 py-2 text-[10px] file:mr-3 file:rounded-md file:border-0 file:bg-[#fff1e6] file:px-3 file:py-1.5 file:text-[10px] file:font-semibold file:text-[#c65d1b]" /><span className="mt-1 block text-[9px] text-[#a0a49b]">JPG, PNG or WebP · maximum 5 MB</span></label>{preview && <img src={preview} alt="Menu item preview" className="h-32 w-full rounded-lg object-cover" />}{error && <p className="text-[11px] text-[#b75c48]">{error}</p>}<button className="w-full rounded-lg bg-[#c65d1b] py-2.5 text-[11px] font-semibold text-white">{initial ? 'Save changes' : 'Add dish to menu'}</button></form></Modal>
}

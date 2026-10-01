import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Check, ChefHat, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, Clock3, Coffee, Command, CreditCard, Download,
  Eye, EyeOff, Filter, Globe2, Hotel, KeyRound, LayoutDashboard, Leaf, LogOut, Menu, MoreHorizontal,
  Package, Plus, QrCode, Search, Settings2, ShieldCheck, ShoppingBag, SlidersHorizontal,
  Sparkles, TrendingUp, Users, Utensils, Wallet, X,
} from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts'
import { api } from '../../lib/api.js'
import { money, today, cx, orderCode, orderTime, navItems } from '../../lib/ui.js'
import { Brand } from '../Brand/Brand.jsx'

export function Sidebar({ role, page, setPage, user, onLogin, onLogout, onChangePassword, hotelName, items: itemsProp }) {
  const items = itemsProp || navItems[role] || navItems.OWNER
  const labels = { OWNER: 'Owner portal', KITCHEN: 'Chef portal', DEVELOPER: 'Developer support' }
  // The Categories accordion opens by itself when one of its subsections is
  // the active page. Single-open: expanding another section collapses this one.
  const [openGroups, setOpenGroups] = useState(() => new Set())
  useEffect(() => {
    const active = items.find(item => item.children?.some(child => child.label === page))
    if (active) setOpenGroups(previous => previous.has(active.label) && previous.size === 1 ? previous : new Set([active.label]))
  }, [page, items])
  const toggleGroup = label => setOpenGroups(previous => previous.has(label) ? new Set() : new Set([label]))
  return <aside className="fixed inset-y-0 left-0 z-20 hidden w-[250px] flex-col overflow-y-auto border-r border-[#eaece6] bg-white px-4 py-5 lg:flex">
    <div className="px-2"><Brand /></div>
    <button className="mt-8 flex items-center gap-3 rounded-xl border border-[#eceee8] p-2.5 text-left transition hover:bg-[#fafbf8]">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#f2efe7] text-[#84785e]"><Hotel size={17} /></div>
      <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-semibold">{hotelName}</div><div className="mt-0.5 text-[10px] text-[#999d94]">WAGA BITS business</div></div>
      <ChevronDown size={15} className="text-[#a5a99f]" />
    </button>
    <p className="mb-2 mt-8 px-2 text-[10px] font-bold uppercase tracking-[1.3px] text-[#a3a79d]">{labels[role]}</p>
    <nav className="space-y-1">
      {items.map(item => item.children
        ? <div key={item.label}>
          <button onClick={() => toggleGroup(item.label)} className={cx('group flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-medium transition', item.children.some(child => child.label === page) ? 'bg-[#fff1e6] text-[#a34b16]' : 'text-[#70776d] hover:bg-[#f7f8f5] hover:text-[#394337]')}>
            <item.icon size={17} strokeWidth={1.8} /><span className="flex-1">{item.label}</span>
            <ChevronDown size={14} className={cx('shrink-0 text-[#a5a99f] transition-transform', openGroups.has(item.label) ? '' : '-rotate-90')} />
          </button>
          {openGroups.has(item.label) && <div className="ml-[26px] mt-0.5 space-y-0.5 border-l border-[#eaece6] pl-3">
            {item.children.map(child => <button key={child.label} onClick={() => setPage(child.label)} className={cx('flex w-full items-center rounded-lg px-3 py-2 text-left text-[12px] transition', page === child.label ? 'bg-[#fff1e6] font-semibold text-[#a34b16]' : 'text-[#70776d] hover:bg-[#f7f8f5] hover:text-[#394337]')}>{child.label}</button>)}
          </div>}
        </div>
        : <button key={item.label} onClick={() => setPage(item.label)} className={cx('group flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-medium transition', page === item.label ? 'bg-[#fff1e6] text-[#a34b16]' : 'text-[#70776d] hover:bg-[#f7f8f5] hover:text-[#394337]')}>
          <item.icon size={17} strokeWidth={1.8} /><span className="flex-1">{item.label}</span>{item.badge && <span className={cx('rounded-md px-1.5 py-0.5 text-[10px] font-semibold', page === item.label ? 'bg-white text-[#c65d1b]' : 'bg-[#f0f1ed] text-[#787e73]')}>{item.badge}</span>}
        </button>)}
    </nav>
    {role === 'OWNER' && <div className="mt-8 rounded-xl bg-[#f7f8f4] p-3.5">
      <div className="flex items-center justify-between"><span className="text-[11px] font-semibold text-[#656d60]">Weekly target</span><span className="text-[10px] text-[#8b9286]">72%</span></div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#e6e9e1]"><div className="h-full w-[72%] rounded-full bg-[#d88340]" /></div>
      <p className="mt-2 text-[10px] text-[#969b91]">On track for this week</p>
    </div>}
    <div className="mt-auto">
      <div className="mb-4 rounded-xl border border-[#eceee8] p-3">
        <div className="flex items-center gap-2.5"><div className="grid size-8 place-items-center rounded-full bg-[#fff1e6] text-[11px] font-bold text-[#a75720]">{role === 'DEVELOPER' ? 'D' : role === 'KITCHEN' ? 'C' : 'S'}</div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold">{user?.name || 'Staff portal'}</p><p className="mt-0.5 text-[10px] text-[#999d94]">{user?.email || 'Sign in to continue'}</p></div><MoreHorizontal size={16} className="text-[#a1a59c]" /></div>
      </div>
      <div className="space-y-0.5">
        {user && <button onClick={onChangePassword} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[12px] text-[#777d73] hover:bg-[#f7f8f5]"><KeyRound size={15} />Change password</button>}
        {user ? <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[12px] text-[#777d73] hover:bg-[#f7f8f5]"><LogOut size={15} />Sign out</button> : <button onClick={onLogin} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[12px] text-[#777d73] hover:bg-[#f7f8f5]"><ShieldCheck size={15} />Sign in</button>}
        {role === 'OWNER' && <button onClick={() => setPage('Help & support')} className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[12px]', page === 'Help & support' ? 'bg-[#fff1e6] text-[#a34b16]' : 'text-[#777d73] hover:bg-[#f7f8f5]')}><CircleHelp size={15} />Help & support</button>}
      </div>
    </div>
  </aside>
}

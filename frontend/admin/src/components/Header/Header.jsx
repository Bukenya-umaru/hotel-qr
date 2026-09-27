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
import { api } from '../../lib/api.js'
import { money, today, cx, orderCode, orderTime, navItems } from '../../lib/ui.js'

export function Header({ role, page, onLogin, user, titleOverride, hotelName }) {
  const title = titleOverride || (page === 'Overview' ? 'Business overview' : page)
  return <header className="sticky top-0 z-10 flex min-h-[68px] items-center justify-between gap-3 border-b border-[#eaece6] bg-[#f7f7f4]/90 px-3 py-2 backdrop-blur-md sm:h-[76px] sm:px-5 sm:py-0 md:px-9">
    <div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2 text-[10px] text-[#989d93]"><span className="truncate">{hotelName}</span><span>/</span><span className="shrink-0">{page}</span></div><h1 className="font-display mt-0.5 truncate text-[16px] font-bold tracking-[-.6px] text-[#293128] sm:text-[20px]">{title}</h1></div>
    <div className="flex items-center gap-2.5">
      <span className="hidden text-[11px] text-[#9b9f96] sm:block">{today}</span>
      <button aria-label="Search" className="hidden size-9 place-items-center rounded-xl border border-[#e7e9e3] bg-white text-[#767e71] hover:bg-[#f8f9f6] sm:grid"><Search size={16} /></button>
      <button aria-label="Notifications" className="relative grid size-9 shrink-0 place-items-center rounded-xl border border-[#e7e9e3] bg-white text-[#767e71] hover:bg-[#f8f9f6]"><Bell size={16} /><i className="absolute right-[8px] top-[7px] size-1.5 rounded-full bg-[#d17b5c]" /></button>
      {!user && <button onClick={onLogin} className="ml-1 rounded-lg bg-[#c65d1b] px-3.5 py-2 text-[11px] font-semibold text-white hover:bg-[#a34b16]">Sign in</button>}
    </div>
  </header>
}

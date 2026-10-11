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
import { money, today, cx, navItems } from '../../lib/ui.js'

export function Modal({ title, onClose, children }) {
  return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0f172a]/35 p-3 pt-[max(.75rem,env(safe-area-inset-top))] backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><div className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-[440px] overflow-y-auto rounded-2xl border border-[#e7ebf0] bg-white p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:p-6"><div className="mb-5 flex items-center justify-between gap-3"><h2 className="font-display min-w-0 text-[16px] font-bold">{title}</h2><button onClick={onClose} aria-label="Close dialog" className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f8fafc] text-[#64748b]"><X size={16} /></button></div>{children}</div></div>
}

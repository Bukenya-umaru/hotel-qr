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
import { Badge } from '../Badge/Badge.jsx'

export function MetricCard({ title, value, change, icon: Icon, detail, inverse = false }) {
  return <div className={cx('min-w-0 rounded-2xl border p-3 sm:p-[18px]', inverse ? 'border-[#c65d1b] bg-[#c65d1b] text-white' : 'border-[#eceee8] bg-white')}>
    <div className="flex items-start justify-between gap-2"><span className={cx('min-w-0 text-[11px] font-medium', inverse ? 'text-white/65' : 'text-[#83897e]')}>{title}</span><span className={cx('grid size-8 shrink-0 place-items-center rounded-[10px]', inverse ? 'bg-white/10 text-white' : 'bg-[#fff4eb] text-[#a75720]')}><Icon size={16} strokeWidth={1.8} /></span></div>
    <div className="mt-3 flex min-w-0 flex-wrap items-end gap-1.5"><strong className={cx('font-display max-w-full break-words text-[clamp(1.1rem,5vw,1.5625rem)] font-bold leading-tight tracking-[-.7px]', inverse ? 'text-white' : 'text-[#252d24]')}>{value}</strong>{change && <Badge tone={inverse ? 'gray' : 'green'}><ArrowUpRight size={11} />{change}</Badge>}</div>
    <p className={cx('mt-1.5 break-words text-[10px]', inverse ? 'text-white/55' : 'text-[#a0a49b]')}>{detail}</p>
  </div>
}

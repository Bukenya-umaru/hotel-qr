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
    <div className="flex items-start justify-between gap-1.5 sm:gap-2"><span className={cx('min-w-0 break-words text-[10px] font-medium leading-4 sm:text-[11px]', inverse ? 'text-white/65' : 'text-[#83897e]')}>{title}</span><span className={cx('grid size-7 shrink-0 place-items-center rounded-[9px] sm:size-8 sm:rounded-[10px]', inverse ? 'bg-white/10 text-white' : 'bg-[#fff4eb] text-[#a75720]')}><Icon size={15} strokeWidth={1.8} className="sm:hidden" /><Icon size={16} strokeWidth={1.8} className="hidden sm:block" /></span></div>
    <div className="mt-2 flex min-w-0 flex-wrap items-end gap-1 sm:mt-3 sm:gap-1.5"><strong className={cx('font-display max-w-full break-words text-[15px] font-bold leading-tight tracking-[-.4px] min-[420px]:text-[17px] sm:text-[clamp(1.1rem,5vw,1.5625rem)] sm:tracking-[-.7px]', inverse ? 'text-white' : 'text-[#252d24]')}>{value}</strong>{change && <Badge tone={inverse ? 'gray' : 'green'}><ArrowUpRight size={11} />{change}</Badge>}</div>
    <p className={cx('mt-1 break-words text-[9px] leading-4 sm:mt-1.5 sm:text-[10px]', inverse ? 'text-white/55' : 'text-[#a0a49b]')}>{detail}</p>
  </div>
}

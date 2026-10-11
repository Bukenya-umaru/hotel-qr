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

export function Badge({ children, tone = 'green', className = '' }) {
  const tones = {
    green: 'bg-[#fff4ec] text-[#ea580c]',
    amber: 'bg-[#fef9ee] text-[#b45309]',
    gray: 'bg-[#f1f5f9] text-[#64748b]',
    red: 'bg-[#fef2f2] text-[#dc2626]',
    blue: 'bg-[#e7ebf0] text-[#3b82f6]',
  }
  return <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[11px]', tones[tone], className)}>{children}</span>
}

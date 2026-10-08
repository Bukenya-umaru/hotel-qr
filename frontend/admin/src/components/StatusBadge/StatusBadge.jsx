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

export function StatusBadge({ status }) {
  const tone = { Pending: 'amber', Preparing: 'blue', Ready: 'green', Served: 'gray', Cancelled: 'red' }[status] || 'gray'
  return <Badge tone={tone}><span className={cx('size-1.5 rounded-full', tone === 'amber' ? 'bg-[#f59e0b]' : tone === 'blue' ? 'bg-[#3b82f6]' : tone === 'green' ? 'bg-[#f97316]' : tone === 'red' ? 'bg-[#f87171]' : 'bg-[#94a3b8]')} />{status}</Badge>
}

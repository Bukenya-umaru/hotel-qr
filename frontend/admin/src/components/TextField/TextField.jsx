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

export function TextField({ label, ...props }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#64748b]">{label}</span><input {...props} required className="w-full rounded-lg border border-[#e7ebf0] bg-white px-3 py-2.5 text-[12px] outline-none transition placeholder:text-[#a8b3c4] focus:border-[#fb923c] focus:ring-2 focus:ring-[#fff4ec]" /></label>
}

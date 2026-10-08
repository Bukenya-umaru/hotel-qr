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

export function AccessCard({ onLogin }) {
  return <section className="mx-auto mt-12 max-w-lg rounded-2xl border border-[#e7ebf0] bg-white p-7 text-center soft-shadow sm:p-9"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#fff4ec] text-[#f97316]"><ShieldCheck size={23} /></span><h2 className="font-display mt-4 text-xl font-bold">Staff & developer sign in</h2><p className="mt-2 text-xs leading-5 text-[#94a3b8]">Use the same secure sign-in form for the owner, chef, and platform developer accounts. Your role determines the dashboard you can access.</p><button onClick={onLogin} className="mt-5 rounded-lg bg-[#f97316] px-5 py-2.5 text-xs font-semibold text-white">Sign in to WAGA BITS</button></section>
}

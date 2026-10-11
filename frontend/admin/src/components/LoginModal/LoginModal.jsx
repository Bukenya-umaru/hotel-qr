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
import { Modal } from '../Modal/Modal.jsx'
import { TextField } from '../TextField/TextField.jsx'

export function LoginModal({ onClose, onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  return <Modal title="Welcome back" onClose={onClose}><form className="space-y-4" onSubmit={async e => { e.preventDefault(); setLoading(true); setError(''); try { await onLogin(email, password) } catch (err) { setError(err.message) } finally { setLoading(false) } }}><div className="mb-5 text-[11px] text-[#94a3b8]">Sign in to your WAGA BITS workspace.</div><TextField label="Email address" type="email" autoComplete="username" placeholder="you@business.com" value={email} onChange={e => setEmail(e.target.value)} /><TextField label="Password" type="password" autoComplete="current-password" placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)} />{error && <p className="text-[11px] text-[#dc2626]">{error}</p>}<button disabled={loading} className="w-full rounded-lg bg-[#f97316] py-2.5 text-[11px] font-semibold text-white disabled:opacity-60">{loading ? 'Signing in…' : 'Sign in'}</button><p className="text-center text-[10px] text-[#94a3b8]">Protected with secure, role-based access</p></form></Modal>
}

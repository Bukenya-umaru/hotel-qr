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
import { Modal } from '../Modal/Modal.jsx'
import { TextField } from '../TextField/TextField.jsx'

export function ResetPasswordModal({ account, onClose, onSubmit }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  return <Modal title={`Reset ${account.name}'s password`} onClose={onClose}><form className="space-y-3.5" onSubmit={async event => { event.preventDefault(); try { await onSubmit(password) } catch (err) { setError(err.message) } }}><TextField label="New temporary password" type="password" minLength="8" placeholder="At least 8 characters" value={password} onChange={event => setPassword(event.target.value)} />{error && <p className="text-[11px] text-[#b75c48]">{error}</p>}<button className="w-full rounded-lg bg-[#c65d1b] py-2.5 text-[11px] font-semibold text-white">Reset password</button></form></Modal>
}

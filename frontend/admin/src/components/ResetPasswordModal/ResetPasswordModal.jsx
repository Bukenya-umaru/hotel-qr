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
import { isStrongPassword, money, PASSWORD_RULE, today, cx, navItems } from '../../lib/ui.js'
import { PasswordStrengthMeter } from '../PasswordStrengthMeter/PasswordStrengthMeter.jsx'
import { Modal } from '../Modal/Modal.jsx'
import { TextField } from '../TextField/TextField.jsx'
import { ActionProgress } from '../ActionProgress/ActionProgress.jsx'

export function ResetPasswordModal({ account, onClose, onSubmit }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  return <Modal title={`Reset ${account.name}'s password`} onClose={onClose}>
    <form className="space-y-3.5" onSubmit={async event => {
      event.preventDefault()
      if (saving) return
      if (!isStrongPassword(password)) { setError(`New password: ${PASSWORD_RULE}.`); return }
      setSaving(true)
      setError('')
      try { await onSubmit(password) } catch (err) { setError(err.message) } finally { setSaving(false) }
    }}>
      <div><TextField label="New temporary password" type="password" placeholder={PASSWORD_RULE} value={password} onChange={event => setPassword(event.target.value)} /><PasswordStrengthMeter password={password} /></div>
      {error && <p className="text-[11px] text-[#dc2626]">{error}</p>}
      <button disabled={saving} className="w-full rounded-lg bg-[#f97316] py-2.5 text-[11px] font-semibold text-white disabled:cursor-wait disabled:opacity-60">{saving ? <ActionProgress>Resetting password…</ActionProgress> : 'Reset password'}</button>
    </form>
  </Modal>
}

import { useState } from 'react'
import { Modal } from '../Modal/Modal.jsx'
import { TextField } from '../TextField/TextField.jsx'
import { cx, isStrongPassword, PASSWORD_RULE, PERMISSIONS } from '../../lib/ui.js'
import { PasswordStrengthMeter } from '../PasswordStrengthMeter/PasswordStrengthMeter.jsx'
import { ActionProgress } from '../ActionProgress/ActionProgress.jsx'

const ALL_KEYS = PERMISSIONS.map(permission => permission.key)

export function AccountModal({ onClose, onSubmit, viewerRole = 'OWNER', businessConfigured = true }) {
  const isDeveloper = viewerRole === 'DEVELOPER'
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'KITCHEN', permissions: [...ALL_KEYS] })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const togglePermission = key => setForm(previous => ({
    ...previous,
    permissions: previous.permissions.includes(key)
      ? previous.permissions.filter(permission => permission !== key)
      : [...previous.permissions, key],
  }))
  const isChef = form.role !== 'OWNER'
  const needsBusinessSetup = isDeveloper && !businessConfigured && form.role === 'OWNER'
  return <Modal title={isDeveloper ? 'Create a business account' : 'Create a chef account'} onClose={onClose}><form className="space-y-3.5" onSubmit={async event => { event.preventDefault(); if (saving || !isStrongPassword(form.password)) { if (!saving) setError(`Temporary password: ${PASSWORD_RULE}.`); return } setSaving(true); setError(''); try { await onSubmit(form) } catch (err) { setError(err.message) } finally { setSaving(false) } }}>
    <p className="text-[11px] leading-5 text-[#94a3b8]">{isDeveloper
      ? needsBusinessSetup
        ? 'Creating the first owner also sets up the business. The owner can then add their own chefs.'
        : 'Create a business owner or chef account. The owner can also add chefs from their account.'
      : 'Choose whether this chef can manage food items, sales, expenses, and stock. You can change these permissions later.'}</p>
    {isDeveloper && <fieldset><legend className="mb-1.5 text-[10px] font-semibold text-[#64748b]">Role</legend><div className="grid grid-cols-2 gap-1.5">{[['OWNER', 'Business owner'], ['KITCHEN', 'Chef']].map(([value, label]) => <label key={value} className={cx('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2', form.role === value ? 'border-[#f97316] bg-[#fff4ec]' : 'border-[#e7ebf0]')}><input type="radio" name="account-role" checked={form.role === value} onChange={() => setForm(previous => ({ ...previous, role: value }))} className="size-3.5 accent-[#f97316]" /><span className="text-[11px] font-medium text-[#334155]">{label}</span></label>)}</div></fieldset>}
    <TextField label="Full name" placeholder="Full name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
    <TextField label="Email address" type="email" placeholder="name@business.com" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
    <div><TextField label="Temporary password" type="password" placeholder={PASSWORD_RULE} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /><PasswordStrengthMeter password={form.password} /></div>
    {isChef && <fieldset><legend className="mb-1.5 text-[10px] font-semibold text-[#64748b]">Permissions</legend><div className="grid gap-1.5">{PERMISSIONS.map(permission => <label key={permission.key} className="flex items-center gap-2 rounded-lg border border-[#e7ebf0] px-3 py-2"><input type="checkbox" checked={form.permissions.includes(permission.key)} onChange={() => togglePermission(permission.key)} className="size-3.5 accent-[#f97316]" /><span className="text-[11px] font-medium text-[#334155]">{permission.label}</span></label>)}</div></fieldset>}
    {error && <p className="text-[11px] text-[#dc2626]">{error}</p>}
    <button disabled={saving} className="mt-2 w-full rounded-lg bg-[#f97316] py-2.5 text-[11px] font-semibold text-white disabled:cursor-wait disabled:opacity-60">{saving ? <ActionProgress>{isDeveloper ? 'Creating account…' : 'Creating chef account…'}</ActionProgress> : isDeveloper ? 'Create account' : 'Create chef account'}</button>
  </form></Modal>
}

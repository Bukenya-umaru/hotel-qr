import { useState } from 'react'
import { Modal } from '../Modal/Modal.jsx'
import { TextField } from '../TextField/TextField.jsx'
import { isStrongPassword, PASSWORD_RULE, PERMISSIONS } from '../../lib/ui.js'
import { PasswordStrengthMeter } from '../PasswordStrengthMeter/PasswordStrengthMeter.jsx'

const ALL_KEYS = PERMISSIONS.map(permission => permission.key)

export function AccountModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', permissions: [...ALL_KEYS] })
  const [error, setError] = useState('')
  const togglePermission = key => setForm(previous => ({
    ...previous,
    permissions: previous.permissions.includes(key)
      ? previous.permissions.filter(permission => permission !== key)
      : [...previous.permissions, key],
  }))
  return <Modal title="Create a chef account" onClose={onClose}><form className="space-y-3.5" onSubmit={async event => { event.preventDefault(); if (!isStrongPassword(form.password)) { setError(`Temporary password: ${PASSWORD_RULE}.`); return } try { await onSubmit(form) } catch (err) { setError(err.message) } }}>
    <p className="text-[11px] leading-5 text-[#94a3b8]">Pick what this chef may do. They always receive incoming kitchen orders; anything else you grant below can be changed later.</p>
    <TextField label="Full name" placeholder="Full name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
    <TextField label="Email address" type="email" placeholder="name@business.com" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
    <div><TextField label="Temporary password" type="password" placeholder={PASSWORD_RULE} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /><PasswordStrengthMeter password={form.password} /></div>
    <fieldset><legend className="mb-1.5 text-[10px] font-semibold text-[#64748b]">Permissions</legend><div className="grid gap-1.5">{PERMISSIONS.map(permission => <label key={permission.key} className="flex items-center gap-2 rounded-lg border border-[#e7ebf0] px-3 py-2"><input type="checkbox" checked={form.permissions.includes(permission.key)} onChange={() => togglePermission(permission.key)} className="size-3.5 accent-[#f97316]" /><span className="text-[11px] font-medium text-[#334155]">{permission.label}</span></label>)}</div></fieldset>
    {error && <p className="text-[11px] text-[#dc2626]">{error}</p>}
    <button className="mt-2 w-full rounded-lg bg-[#f97316] py-2.5 text-[11px] font-semibold text-white">Create chef account</button>
  </form></Modal>
}
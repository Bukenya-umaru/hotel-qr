import { useState } from 'react'
import { Modal } from '../Modal/Modal.jsx'
import { TextField } from '../TextField/TextField.jsx'
import { PERMISSIONS } from '../../lib/ui.js'
import { ActionProgress } from '../ActionProgress/ActionProgress.jsx'

const ALL_KEYS = PERMISSIONS.map(permission => permission.key)

export function AccountEditModal({ account, onClose, onSubmit }) {
  const isChef = account.role === 'KITCHEN'
  const [form, setForm] = useState({
    name: account.name,
    email: account.email,
    permissions: isChef ? (account.permissions || ALL_KEYS) : [],
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const togglePermission = key => setForm(previous => ({
    ...previous,
    permissions: previous.permissions.includes(key)
      ? previous.permissions.filter(permission => permission !== key)
      : [...previous.permissions, key],
  }))
  return <Modal title="Edit account" onClose={onClose}><form className="space-y-3.5" onSubmit={async event => { event.preventDefault(); if (saving) return; setSaving(true); setError(''); try { await onSubmit(form) } catch (err) { setError(err.message) } finally { setSaving(false) } }}><TextField label="Full name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /><TextField label="Email address" type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />{isChef && <fieldset><legend className="mb-1.5 text-[10px] font-semibold text-[#64748b]">Permissions</legend><div className="grid gap-1.5">{PERMISSIONS.map(permission => <label key={permission.key} className="flex items-center gap-2 rounded-lg border border-[#e7ebf0] px-3 py-2"><input type="checkbox" checked={form.permissions.includes(permission.key)} onChange={() => togglePermission(permission.key)} className="size-3.5 accent-[#f97316]" /><span className="text-[11px] font-medium text-[#334155]">{permission.label}</span></label>)}</div></fieldset>}{error && <p className="text-[11px] text-[#dc2626]">{error}</p>}<button disabled={saving} className="w-full rounded-lg bg-[#f97316] py-2.5 text-[11px] font-semibold text-white disabled:cursor-wait disabled:opacity-60">{saving ? <ActionProgress>Updating account…</ActionProgress> : 'Save changes'}</button></form></Modal>
}
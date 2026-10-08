import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { isStrongPassword, PASSWORD_RULE } from '../../lib/ui.js'
import { Modal } from '../Modal/Modal.jsx'
import { TextField } from '../TextField/TextField.jsx'
import { PasswordStrengthMeter } from '../PasswordStrengthMeter/PasswordStrengthMeter.jsx'

// Lets any signed-in user (owner, chef, or developer) change their own
// password. The current password must be confirmed first.
export function ChangePasswordModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [show, setShow] = useState({ current: false, next: false, confirm: false })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const visibilityIcon = field => (
    <button type="button" tabIndex={-1} aria-label={show[field] ? 'Hide password' : 'Show password'}
      onClick={() => setShow(previous => ({ ...previous, [field]: !previous[field] }))}
      className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center text-[#94a3b8]">
      {show[field] ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  )
  const passwordField = (label, field, placeholder) => (
    <div className="relative">
      <TextField label={label} type={show[field] ? 'text' : 'password'} minLength="8" autoComplete="new-password"
        placeholder={placeholder} value={form[field]}
        onChange={event => setForm(previous => ({ ...previous, [field]: event.target.value }))} />
      {visibilityIcon(field)}
    </div>
  )

  return <Modal title="Change your password" onClose={onClose}>
    <form className="space-y-3.5" onSubmit={async event => {
      event.preventDefault()
      if (!isStrongPassword(form.next)) { setError(`New password: ${PASSWORD_RULE}.`); return }
      if (form.next !== form.confirm) { setError('The new passwords do not match.'); return }
      setSaving(true)
      try { await onSubmit({ currentPassword: form.current, newPassword: form.next }) }
      catch (err) { setError(err.message) }
      finally { setSaving(false) }
    }}>
      <div className="relative">{passwordField('Current password', 'current', 'Enter your current password')}</div>
      <div>
        {passwordField('New password', 'next', PASSWORD_RULE)}
        <PasswordStrengthMeter password={form.next} />
      </div>
      {passwordField('Confirm new password', 'confirm', 'Repeat the new password')}
      {error && <p className="text-[11px] text-[#dc2626]">{error}</p>}
      <button disabled={saving} className="w-full rounded-lg bg-[#f97316] py-2.5 text-[11px] font-semibold text-white disabled:opacity-60">
        {saving ? 'Updating…' : 'Update password'}
      </button>
    </form>
  </Modal>
}

import { useState } from 'react'
import { Modal } from '../Modal/Modal.jsx'
import { TextField } from '../TextField/TextField.jsx'

export function AccountModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  return <Modal title="Create a chef account" onClose={onClose}><form className="space-y-3.5" onSubmit={async event => { event.preventDefault(); try { await onSubmit(form) } catch (err) { setError(err.message) } }}>
    <p className="text-[11px] leading-5 text-[#8d9389]">The chef can manage the customer menu, food categories, prices and availability, and receive incoming orders.</p>
    <TextField label="Full name" placeholder="Full name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
    <TextField label="Email address" type="email" placeholder="name@business.com" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
    <TextField label="Temporary password" type="password" minLength="8" placeholder="At least 8 characters" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} />
    {error && <p className="text-[11px] text-[#b75c48]">{error}</p>}
    <button className="mt-2 w-full rounded-lg bg-[#c65d1b] py-2.5 text-[11px] font-semibold text-white">Create chef account</button>
  </form></Modal>
}

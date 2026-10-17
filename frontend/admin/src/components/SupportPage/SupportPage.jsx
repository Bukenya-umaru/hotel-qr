import { useEffect, useState } from 'react'
import { CircleCheck, CircleHelp, Mail, MessageCircle, Phone, Save, Clock3 } from 'lucide-react'
import { api } from '../../lib/api.js'
import { ActionProgress } from '../ActionProgress/ActionProgress.jsx'

const FIELDS = [
  { key: 'phone', label: 'Phone number', placeholder: 'e.g. +256 700 123 456', icon: Phone },
  { key: 'whatsapp', label: 'WhatsApp number', placeholder: 'e.g. +256 700 123 456', icon: MessageCircle },
  { key: 'email', label: 'Email address', placeholder: 'e.g. help@yourbusiness.com', icon: Mail },
  { key: 'hours', label: 'Opening hours', placeholder: 'e.g. Mon–Sun · 7:00 am – 10:00 pm', icon: Clock3 },
]

const EMPTY = { phone: '', whatsapp: '', email: '', hours: '', message: '' }

export function SupportPage() {
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [businessConfigured, setBusinessConfigured] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    api('/api/developer/support')
      .then(data => {
        if (!active) return
        setForm({ ...EMPTY, ...data.support })
        setBusinessConfigured(data.businessConfigured !== false)
      })
      .catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!saved) return undefined
    const timeout = window.setTimeout(() => setSaved(false), 3200)
    return () => window.clearTimeout(timeout)
  }, [saved])

  const setField = (key, value) => setForm(previous => ({ ...previous, [key]: value }))

  const save = async event => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const data = await api('/api/developer/support', {
        method: 'PATCH',
        body: JSON.stringify(form),
      })
      setForm({ ...EMPTY, ...data.support })
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="rounded-2xl border border-[#e7ebf0] bg-white p-8 text-center text-[11px] text-[#94a3b8]">Loading help & support details…</div>

  return <div className="space-y-5">
    <div>
      <h2 className="font-display text-lg font-bold">Help & support</h2>
      <p className="mt-1 text-[12px] text-[#94a3b8]">
        Maintain the help & support details shown to customers on the menu page for this business.
      </p>
    </div>

    {saved && <div className="flex items-center gap-2 rounded-lg bg-[#f0fdf4] px-3 py-2.5 text-[11px] font-medium text-[#16a34a]"><CircleCheck size={15} />Help & support details updated — customers see them right away.</div>}
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-[#fef2f2] px-3 py-2.5 text-[11px] text-[#dc2626]"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}

    {!businessConfigured
      ? <div className="rounded-xl border border-[#e7ebf0] bg-white p-5 text-[12px] leading-6 text-[#64748b]">
          No business is active yet, so support details cannot be edited. Go to Accounts and create the business owner; that will set up the business without a database seed.
        </div>
      : <form onSubmit={save} className="space-y-4">
      <section className="grid gap-4 rounded-2xl border border-[#e7ebf0] bg-white p-4 sm:grid-cols-2 sm:p-5">
        {FIELDS.map(({ key, label, placeholder, icon: Icon }) => <label key={key} className="block text-[10px] font-semibold text-[#64748b]">
          <span className="flex items-center gap-1.5"><Icon size={13} className="text-[#f97316]" />{label}</span>
          <input
            value={form[key]}
            onChange={event => setField(key, event.target.value)}
            placeholder={placeholder}
            maxLength={key === 'email' ? 120 : 40}
            className="mt-1.5 block w-full rounded-lg border border-[#e7ebf0] bg-white px-3 py-2.5 text-[12px] outline-none transition placeholder:text-[#a8b3c4] focus:border-[#fb923c] focus:ring-2 focus:ring-[#fff4ec]"
          />
        </label>)}
      </section>

      <section className="rounded-2xl border border-[#e7ebf0] bg-white p-4 sm:p-5">
        <label className="block text-[10px] font-semibold text-[#64748b]">
          <span className="flex items-center gap-1.5"><CircleHelp size={13} className="text-[#f97316]" />Short help message</span>
          <textarea
            rows={3}
            value={form.message}
            onChange={event => setField('message', event.target.value)}
            maxLength={400}
            placeholder="e.g. For allergies or special requests, talk to any waiter or call the front desk."
            className="mt-1.5 block w-full resize-none rounded-lg border border-[#e7ebf0] bg-white px-3 py-2.5 text-[12px] outline-none transition placeholder:text-[#a8b3c4] focus:border-[#fb923c] focus:ring-2 focus:ring-[#fff4ec]"
          />
          <span className="mt-1 block text-right text-[9px] font-normal text-[#94a3b8]">{form.message.length}/400</span>
        </label>
      </section>

      <div className="flex items-center justify-end gap-3">
        <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2.5 text-[11px] font-semibold text-white disabled:opacity-60">{saving ? <ActionProgress>Saving details…</ActionProgress> : <><Save size={14} />Save details</>}</button>
      </div>
    </form>}
  </div>
}

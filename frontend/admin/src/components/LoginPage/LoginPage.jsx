import { useEffect, useState } from 'react'
import { Eye, EyeOff, Headset, MessageCircle, Phone, ShieldCheck } from 'lucide-react'
import { Brand } from '../Brand/Brand.jsx'
import { api } from '../../lib/api.js'

export function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Contact details come straight from the Help & support section, so an
  // updated number is reflected on this form automatically on refresh.
  const [support, setSupport] = useState(null)

  useEffect(() => {
    api('/api/support').then(data => {
      const support = data?.support
      setSupport(support?.phone || support?.whatsapp || support?.email ? support : null)
    }).catch(() => { /* the sign-in flow must not depend on this card */ })
  }, [])

  const submit = async event => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await onLogin(email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#eeeeed] px-4 py-8 sm:px-6">
    <section className="flex min-h-[min(760px,calc(100dvh-4rem))] w-full max-w-[400px] flex-col rounded-[28px] border border-[#e8e7e5] bg-white px-6 py-8 shadow-[0_18px_55px_rgba(40,35,30,.08)] sm:px-8">
      <div className="flex justify-center">
        <Brand />
      </div>

      <div className="mt-8">
        <h1 className="font-display text-[21px] font-semibold tracking-[-.4px] text-[#211f1e]">Welcome back!</h1>
        <p className="mt-1 text-[13px] text-[#85817e]">Log in to your account to get started.</p>
      </div>

      <form className="mt-7 flex flex-1 flex-col" onSubmit={submit}>
        <div>
          <label htmlFor="login-email" className="mb-1 block text-[13px] text-[#77726e]">Email address</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            required
            placeholder="Enter your email address"
            value={email}
            onChange={event => setEmail(event.target.value)}
            className="h-11 w-full rounded-[7px] border border-[#e9e8e7] bg-[#f5f5f5] px-3 text-[13px] text-[#252220] outline-none transition placeholder:text-[#999592] focus:border-[#a93216] focus:ring-1 focus:ring-[#a93216]"
          />
        </div>

        <div className="mt-5">
          <label htmlFor="login-password" className="mb-1 block text-[13px] text-[#77726e]">Password</label>
          <div className="flex h-11 overflow-hidden rounded-[7px] border border-[#e9e8e7] bg-[#f5f5f5] transition focus-within:border-[#a93216] focus-within:ring-1 focus-within:ring-[#a93216]">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              placeholder="Enter your password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              className="min-w-0 flex-1 bg-transparent px-3 text-[13px] text-[#252220] outline-none placeholder:text-[#999592]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(value => !value)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="grid w-11 shrink-0 place-items-center border-l border-[#e9e8e7] bg-[#f1f1f1] text-[#292421] hover:bg-[#e9e8e7]"
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        <div className="mt-7 flex items-start gap-2.5 text-[12px] leading-[1.6] text-[#85817e]">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#a93216]" />
          <p>Secure sign-in for authorized staff and platform administrators.</p>
        </div>

        {error && <p role="alert" className="mt-4 text-[12px] text-[#dc2626]">{error}</p>}

        <button
          disabled={loading}
          className="mt-6 h-11 w-full rounded-full bg-[#a93216] text-[14px] font-medium text-white transition hover:bg-[#922b13] disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Log In'}
        </button>

        {support && <div className="mt-4 rounded-[14px] bg-[#fdf6f3] px-4 py-3.5">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[#a93216]">
            <Headset size={14} />
            Forgot your password?
          </div>
          <p className="mt-1 text-[12px] leading-[1.6] text-[#77726e]">Call the number saved in Help &amp; support to reach the business owner or developer.</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {support.phone && <a href={`tel:${support.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#a93216] hover:underline"><Phone size={13} />{support.phone}</a>}
            {support.whatsapp && (support.whatsapp.replace(/\D/g, '').startsWith('0')
              ? <span className="text-[12px] text-[#77726e]">WhatsApp: {support.whatsapp}</span>
              : <a href={`https://wa.me/${support.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#a93216] hover:underline"><MessageCircle size={13} />WhatsApp: {support.whatsapp}</a>)}
            {support.email && <span className="text-[12px] text-[#77726e]">{support.email}</span>}
          </div>
          {support.hours && <p className="mt-1 text-[11px] text-[#8b8783]">{support.hours}</p>}
        </div>}

        <div className="mt-auto pt-8 text-center text-[12px] text-[#8b8783]">
          Protected with secure, role-based access
        </div>
      </form>
    </section>
  </main>
}

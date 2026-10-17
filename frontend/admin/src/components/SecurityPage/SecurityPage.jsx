import { useEffect, useState } from 'react'
import { Activity, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Badge } from '../Badge/Badge.jsx'
import { api } from '../../lib/api.js'
import { cx } from '../../lib/ui.js'

// How each recorded event reads on screen. Types come from the backend's
// SecurityEvent enum; unknown types still show their raw key.
const TYPES = {
  login_failed: { label: 'Sign-in failed', tone: 'amber', text: 'Wrong credentials were submitted' },
  password_change_failed: { label: 'Password change blocked', tone: 'red', text: 'Wrong current password on a signed-in session' },
  login_bruteforce: { label: 'Sign-in flood (IP)', tone: 'red', text: 'Too many sign-in attempts from one IP address' },
  account_bruteforce: { label: 'Sign-in flood (account)', tone: 'red', text: 'Too many sign-in attempts against one account' },
  rate_limited: { label: 'API flood', tone: 'red', text: 'An IP exceeded the API request limit' },
  token_rejected: { label: 'Tampered token', tone: 'red', text: 'A session token failed signature verification' },
  access_denied: { label: 'Forbidden access', tone: 'red', text: 'A signed-in user probed an endpoint outside their role' },
  password_revealed: { label: 'Password revealed', tone: 'blue', text: 'A stored password was decrypted for viewing' },
  account_created: { label: 'Account created', tone: 'green', text: 'A business owner or chef account was created' },
}

const labelFor = event => TYPES[event.type]?.label || event.type
const textFor = event => event.detail || TYPES[event.type]?.text || ''
const toneFor = event => event.severity === 'high' ? TYPES[event.type]?.tone || 'red' : 'gray'

export function SecurityPage() {
  const [data, setData] = useState({ events: [], summary: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    api('/api/developer/security?limit=120')
      .then(data => { setData(data); setError('') })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const attackCount = data.events.filter(event => event.severity === 'high').length
  const flaggedTypes = ['login_bruteforce', 'account_bruteforce', 'rate_limited', 'token_rejected', 'access_denied', 'password_revealed', 'password_change_failed']
  const summaryOf = type => data.summary.find(entry => entry.type === type)?.count || 0

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[12px] text-[#94a3b8]">Every failed sign-in, brute-force flood, tampered token, and forbidden access attempt is recorded here the moment it is blocked.</p>
      <button onClick={load} className="flex items-center gap-2 rounded-lg border border-[#f0e8e4] px-3.5 py-2.5 text-[11px] font-semibold text-[#ea580c]"><RefreshCw size={14} className={cx(loading && 'animate-spin')} />Refresh</button>
    </div>
    {error && <div role="alert" className="rounded-lg bg-[#fef2f2] px-3 py-2.5 text-[11px] text-[#dc2626]">{error}</div>}
    <div className="grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-2 min-[360px]:gap-3 xl:grid-cols-4">
      <MetricBlock tone="red" icon={ShieldAlert} title="Attack signals" value={attackCount} detail="High-severity events in view" />
      <MetricBlock tone="amber" icon={ShieldCheck} title="Failed sign-ins" value={summaryOf('login_failed')} detail="Wrong credentials submitted" />
      <MetricBlock tone="blue" icon={Activity} title="Revealed passwords" value={summaryOf('password_revealed')} detail="Support password decrypts" />
      <MetricBlock tone="green" icon={ShieldCheck} title="Accounts created" value={summaryOf('account_created')} detail="Owner & chef accounts" />
    </div>
    <section className="overflow-hidden rounded-2xl border border-[#e7ebf0] bg-white">
      <div className="flex flex-wrap gap-1.5 border-b border-[#f1f5f9] px-3 py-3 sm:px-4">{flaggedTypes.map(type => <span key={type} className="max-w-full break-words rounded-md bg-[#f1f4f9] px-2 py-1 text-[9px] font-medium text-[#64748b]">{TYPES[type]?.label || type}: {summaryOf(type)}</span>)}</div>
      {data.events.length ? <ul className="divide-y divide-[#f1f4f9]">
        {data.events.map(event => (
          <li key={event._id} className="grid min-w-0 gap-2 px-3 py-3.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start sm:gap-3 sm:px-5">
            <Badge tone={toneFor(event)}>{event.severity === 'high' ? '⚠ ' : ''}{labelFor(event)}</Badge>
            <span className="min-w-0 break-words text-[11px] text-[#334155]">{textFor(event)}</span>
            <span className="flex min-w-0 flex-wrap gap-x-2 gap-y-1 break-all text-[9px] text-[#94a3b8] sm:justify-end">
              {event.email && <span>{event.email}</span>}
              {event.ip && <span>{event.ip}</span>}
              <time className="basis-full sm:basis-auto" dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
            </span>
          </li>
        ))}
      </ul> : <p className="px-5 py-10 text-center text-[11px] text-[#94a3b8]">{loading ? 'Loading security activity…' : 'No suspicious activity recorded yet — nothing unusual has reached the server.'}</p>}
    </section>
  </div>
}

function MetricBlock({ title, value, detail, tone = 'green', icon: Icon }) {
  const tones = {
    green: 'bg-[#eaf7ef] text-[#55a978]',
    amber: 'bg-[#fef9ee] text-[#b45309]',
    blue: 'bg-[#e7ebf0] text-[#3b82f6]',
    red: 'bg-[#fef2f2] text-[#dc2626]',
  }
  return <div className="rounded-2xl border border-[#f0e8e4] bg-white p-3.5">
    <div className="flex items-center justify-between gap-2"><span className="truncate text-[12px] font-medium text-[#655a54]">{title}</span><span className={cx('grid size-9 shrink-0 place-items-center rounded-full', tones[tone])}><Icon size={17} strokeWidth={1.8} /></span></div>
    <strong className="font-display mt-2 block text-[20px] font-bold leading-none text-[#292421]">{value}</strong>
    <p className="mt-1 truncate text-[9px] text-[#8d817b]">{detail}</p>
  </div>
}

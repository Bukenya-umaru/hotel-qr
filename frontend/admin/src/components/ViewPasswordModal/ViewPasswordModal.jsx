import { useEffect, useState } from 'react'
import { Eye, Loader2 } from 'lucide-react'
import { api } from '../../lib/api.js'
import { Modal } from '../Modal/Modal.jsx'

const VIEW_SECONDS = 15

// Developer-only: reveals an account's actual password for 15 seconds,
// then hides it and closes.
export function ViewPasswordModal({ account, onClose }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(VIEW_SECONDS)

  useEffect(() => {
    let active = true
    api(`/api/developer/users/${account._id}/password`)
      .then(data => { if (active) setPassword(data.password) })
      .catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [account._id])

  useEffect(() => {
    if (loading || error) return undefined
    const timer = window.setInterval(() => setSecondsLeft(previous => previous - 1), 1000)
    return () => window.clearInterval(timer)
  }, [loading, error])

  useEffect(() => {
    if (!loading && !error && secondsLeft <= 0) onClose()
  }, [loading, error, secondsLeft, onClose])

  return <Modal title={`${account.name}'s password`} onClose={onClose}>
    {loading && <p className="flex items-center gap-2 text-[11px] text-[#757c71]"><Loader2 size={14} className="animate-spin" />Decrypting password…</p>}
    {error && <p className="text-[11px] leading-5 text-[#b75c48]">{error}</p>}
    {!loading && !error && <>
      <p className="text-[11px] text-[#757c71]">Share this privately with {account.role === 'OWNER' ? 'the business owner' : 'the chef'} and help them update it after signing in.</p>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[#f7f8f5] px-4 py-3">
        <code className="min-w-0 flex-1 select-all break-all text-[13px] font-semibold tracking-wide">{password}</code>
        <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold text-[#a75720]"><Eye size={13} />{secondsLeft}s</span>
      </div>
      <p className="mt-3 text-[10px] text-[#999e94]">For security this view closes automatically after {VIEW_SECONDS} seconds.</p>
    </>}
  </Modal>
}

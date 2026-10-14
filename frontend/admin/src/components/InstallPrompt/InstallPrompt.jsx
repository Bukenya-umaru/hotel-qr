import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

// Browsers fire beforeinstallprompt once they judge the app installable; we
// hold the event so a custom popup — shown as the site opens — can trigger
// Chrome's own install dialog on the user's tap rather than racing them.
// "Once, then quiet": dismissing hides the popup for that browser forever
// unless the storage is cleared; installing marks it standalone so it never
// shows again.
const DISMISS_KEY = 'wagabits-install-dismissed'

const alreadyInstalled = () => window.matchMedia('(display-mode: standalone)').matches
  || Boolean(window.navigator.standalone)

export function InstallPrompt() {
  const [event, setEvent] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const available = !alreadyInstalled() && localStorage.getItem(DISMISS_KEY) !== '1'
    const onPrompt = nativeEvent => {
      nativeEvent.preventDefault()
      setEvent(nativeEvent)
      if (localStorage.getItem(DISMISS_KEY) !== '1') setVisible(true)
    }
    const onInstalled = () => { setVisible(false); setEvent(null) }
    if (available) window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!visible || !event) return null

  const install = async () => {
    setVisible(false)
    try { await event.prompt(); await event.userChoice } catch { /* the dialog was closed — the popup simply stays away */ }
    setEvent(null)
  }
  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* private mode may block storage — still hide the popup */ }
    setVisible(false)
  }

  return <div role="dialog" aria-label="Install app" className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-3 right-3 z-[70] mx-auto flex max-w-[430px] items-start gap-3 rounded-2xl border border-[#f0e0da] bg-white p-4 shadow-[0_18px_50px_rgba(40,30,25,.16)] sm:right-5 sm:left-auto">
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#fff0ea] text-[#a93216]"><Download size={18} /></span>
    <div className="min-w-0 flex-1">
      <p className="text-[12px] font-bold text-[#292421]">Install WAGA BITES</p>
      <p className="mt-1 text-[11px] leading-5 text-[#786d67]">Add the dashboard to your home screen — it opens instantly, full screen, like the app it is.</p>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={install} className="rounded-full bg-[#a93216] px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-[#922b13]">Install</button>
        <button onClick={dismiss} className="rounded-full px-3 py-2 text-[11px] font-medium text-[#8d817b] transition hover:text-[#292421]">Not now</button>
      </div>
    </div>
    <button onClick={dismiss} aria-label="Dismiss install prompt" className="shrink-0 rounded-full p-1 text-[#c9bcb5] transition hover:text-[#a93216]"><X size={14} /></button>
  </div>
}

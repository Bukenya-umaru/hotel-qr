import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

// Every section/subsection switch shows the full-screen loading overlay for
// AT LEAST five seconds (a deliberate beat, per the owner's request), then
// hands over to the section — held longer if its data is still loading.
const MINIMUM_MS = 5000

// The gate counts one beat per switch: a change of sectionKey restarts it.
export function SectionGate({ sectionKey, ready, children }) {
  const [beat, setBeat] = useState(0)
  const [elapsed, setElapsed] = useState(true)

  useEffect(() => {
    // New section entered: show the overlay and start the 5s minimum.
    setElapsed(false)
    const timer = window.setTimeout(() => setElapsed(true), MINIMUM_MS)
    setBeat(current => current + 1)
    return () => window.clearTimeout(timer)
  }, [sectionKey])

  // The overlay stays until the minimum has elapsed AND the section's data
  // is ready (App derives `ready` from live fetch states).
  const gating = !elapsed || ready === false

  return (
    <>
      {gating && (
        <div key={beat} role="status" aria-label="Loading section" className="fixed inset-0 z-[80] grid place-items-center bg-[#fbf8f6]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={34} className="animate-spin text-[#e7654b]" />
            <p className="text-[12px] font-semibold text-[#786d67]">Loading {sectionKey}…</p>
          </div>
        </div>
      )}
      <div aria-hidden={gating} className={gating ? 'pointer-events-none opacity-0' : ''}>{children}</div>
    </>
  )
}

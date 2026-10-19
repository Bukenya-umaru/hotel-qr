import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

// Section switches show the full-screen loading overlay for at least five
// seconds, then hand over to the section — held longer if its data is loading.
const MINIMUM_MS = 5000

// The gate applies to navigation after the initial dashboard has mounted.
export function SectionGate({ sectionKey, ready, children }) {
  const [beat, setBeat] = useState(0)
  const [elapsed, setElapsed] = useState(true)
  const previousSectionKey = useRef(sectionKey)

  useEffect(() => {
    if (previousSectionKey.current === sectionKey) {
      return undefined
    }
    previousSectionKey.current = sectionKey

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
        <div key={beat} role="status" aria-label="Loading section" className="absolute inset-0 z-20 grid place-items-center bg-[#fbf8f6] lg:z-[80]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={34} className="animate-spin text-[#e7654b]" />
            <p className="text-[12px] font-semibold text-[#786d67]">Loading {sectionKey}…</p>
          </div>
        </div>
      )}
      <div aria-hidden={gating}>{children}</div>
    </>
  )
}

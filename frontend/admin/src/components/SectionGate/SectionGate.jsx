import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

// Section switches show an in-place loading skeleton in the content area for
// at least five seconds, then hand over to the section — held longer if its
// data is still arriving. Nothing covers the page or the navigation.
const MINIMUM_MS = 5000

const Bar = ({ className = '' }) => <span className={`block animate-pulse rounded bg-[#eef1f5] ${className}`} />

// The skeleton mirrors the shape of the section's items — cards, table rows,
// form fields or a simple list — so the loading state sits exactly where the
// fetched content will appear.
function SectionSkeleton({ sectionKey }) {
  const variant = sectionKey === 'Stock'
    ? 'cards'
    : ['Sales', 'Purchase expenses', 'Purchase damages', 'Chefs', 'Accounts'].includes(sectionKey)
      ? 'table'
      : sectionKey === 'Make sale'
        ? 'form'
        : ['Overview', 'Reports', 'Platform overview'].includes(sectionKey)
          ? 'metrics'
          : 'list'

  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading {sectionKey}…</span>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <Bar className="h-4 w-44" />
          <Bar className="h-2.5 w-64 max-w-full" />
        </div>
        <Bar className="h-9 w-28 rounded-lg" />
      </div>
      {variant === 'metrics' && <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map(index => <div key={index} className="h-[88px] animate-pulse rounded-2xl border border-[#eef1f5] bg-white" />)}
      </div>}
      {variant === 'cards' && <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 lg:gap-4 2xl:grid-cols-5">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(index => <div key={index} className="rounded-xl border border-[#eef1f5] bg-white p-1.5 sm:p-3">
          <div className="aspect-[4/3] w-full animate-pulse rounded-lg bg-[#f1f4f8] sm:aspect-[16/10]" />
          <Bar className="mx-auto mt-2 h-2.5 w-2/3" />
          <Bar className="mx-auto mt-1.5 h-2 w-1/3" />
        </div>)}
      </div>}
      {variant === 'table' && <div className="overflow-hidden rounded-2xl border border-[#e7ebf0] bg-white">
        {[0, 1, 2, 3, 4, 5].map(index => <div key={index} className="flex items-center gap-3 border-b border-[#f1f5f9] px-4 py-3.5 last:border-0">
          <Bar className="size-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Bar className="h-2.5 w-1/3" />
            <Bar className="h-2 w-1/4" />
          </div>
          <Bar className="h-2.5 w-16" />
        </div>)}
      </div>}
      {variant === 'form' && <div className="space-y-3 rounded-2xl border border-[#e7ebf0] bg-white p-4">
        {[0, 1, 2].map(index => <div key={index} className="space-y-1.5">
          <Bar className="h-2.5 w-24" />
          <Bar className="h-10 w-full rounded-lg" />
        </div>)}
        <Bar className="h-10 w-full rounded-lg bg-[#fff4ec]" />
      </div>}
      {variant === 'list' && <div className="grid gap-2">
        {[0, 1, 2, 3, 4].map(index => <div key={index} className="flex items-center gap-3 rounded-xl border border-[#eef1f5] bg-white px-4 py-3">
          <Bar className="size-8 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Bar className="h-2.5 w-1/3" />
            <Bar className="h-2 w-1/5" />
          </div>
        </div>)}
      </div>}
      <p className="flex items-center justify-center gap-2 pt-1 text-[10px] font-medium text-[#94a3b8]">
        <Loader2 size={13} className="animate-spin text-[#e7654b]" />
        Loading {sectionKey}…
      </p>
    </div>
  )
}

// The gate applies to navigation after the initial dashboard has mounted.
export function SectionGate({ sectionKey, ready, children }) {
  const [elapsed, setElapsed] = useState(true)
  const previousSectionKey = useRef(sectionKey)

  useEffect(() => {
    if (previousSectionKey.current === sectionKey) {
      return undefined
    }
    previousSectionKey.current = sectionKey

    setElapsed(false)
    const timer = window.setTimeout(() => setElapsed(true), MINIMUM_MS)
    return () => window.clearTimeout(timer)
  }, [sectionKey])

  // The skeleton stays until the minimum has elapsed AND the section's data
  // is ready (App derives `ready` from live fetch states).
  const gating = !elapsed || ready === false

  // Children are mounted (so their fetches start immediately) but hidden while
  // the skeleton fills the same content area; they appear when loading ends.
  return (
    <div aria-busy={gating}>
      {gating && <SectionSkeleton key={sectionKey} sectionKey={sectionKey} />}
      <div hidden={gating}>{children}</div>
    </div>
  )
}

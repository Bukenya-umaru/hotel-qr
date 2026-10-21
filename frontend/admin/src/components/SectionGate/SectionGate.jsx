import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { loadSnapshot, subscribeLoads } from '../../lib/api.js'

// Section switches show an in-place loading skeleton in the content area for
// at least five seconds, then hand over to the section — held longer if its
// data is still arriving. Nothing covers the page or the navigation.
const MINIMUM_MS = 5000

const Bar = ({ className = '' }) => <span className={`block animate-pulse rounded bg-[#eef1f5] ${className}`} />

const Metrics = ({ count, columns }) => <div className={columns}>
  {Array.from({ length: count }, (_, index) => <div key={index} className="h-[88px] animate-pulse rounded-2xl border border-[#eef1f5] bg-white" />)}
</div>

const PageHeader = ({ actions = 1 }) => <div className="flex flex-wrap items-center justify-between gap-3">
  <div className="min-w-0 space-y-2">
    <Bar className="h-4 w-40" />
    <Bar className="h-2.5 w-64 max-w-full" />
  </div>
  {actions > 0 && <div className="flex flex-wrap items-center gap-2">
    {Array.from({ length: actions }, (_, index) => <Bar key={index} className="h-9 w-24 rounded-lg" />)}
  </div>}
</div>

// Dashboard: title and period controls, six metric cards, then the 5-column
// chart/report grid next to the 300px activity sidebar.
function OverviewSkeleton() {
  return <div className="space-y-4">
    <PageHeader actions={2} />
    <Metrics count={6} columns="grid grid-cols-2 gap-2.5 xl:grid-cols-4 xl:gap-3.5" />
    <div className="flex flex-col gap-3.5 xl:flex-row">
      <div className="grid min-w-0 flex-1 gap-3.5 lg:grid-cols-5">
        <div className="h-[290px] animate-pulse border border-[#f0e8e4] bg-white lg:col-span-3" />
        <div className="h-[290px] animate-pulse border border-[#f0e8e4] bg-white lg:col-span-2" />
        <div className="h-16 animate-pulse border border-[#f0e8e4] bg-white lg:col-span-5" />
        <div className="h-60 animate-pulse border border-[#f0e8e4] bg-white lg:col-span-3" />
        <div className="h-60 animate-pulse border border-[#f0e8e4] bg-white lg:col-span-2" />
        <div className="h-28 animate-pulse border border-[#f0e8e4] bg-white lg:col-span-5" />
      </div>
      <div className="grid min-w-0 gap-3.5 xl:w-[300px] xl:shrink-0">
        <div className="h-52 animate-pulse border border-[#f0e8e4] bg-white" />
        <div className="h-72 animate-pulse border border-[#f0e8e4] bg-white" />
      </div>
    </div>
  </div>
}

// Reports: filter and export row, four metric cards, a wide chart panel, then
// the sales/expenses/damage record lists.
function ReportsSkeleton() {
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Bar className="h-3 w-64 max-w-full" />
      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        <Bar className="h-9 w-16 rounded-lg" />
        <Bar className="h-9 w-28 rounded-lg" />
        {[0, 1, 2].map(index => <Bar key={index} className="h-9 w-16 rounded-lg" />)}
        <Bar className="h-9 w-28 rounded-lg" />
      </div>
    </div>
    <Metrics count={4} columns="grid grid-cols-2 gap-2.5 min-[420px]:gap-3 lg:grid-cols-3" />
    <div className="border border-[#eee4df] bg-white p-4 sm:p-5">
      <Bar className="h-3.5 w-40" />
      <Bar className="mt-2 h-2.5 w-32" />
      <div className="mt-6 h-[220px] animate-pulse rounded bg-[#f8f6f5] sm:h-[290px]" />
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      {[0, 1].map(index => <div key={index} className="border border-[#eee4df] bg-white">
        <div className="border-b border-[#f1eae6] px-4 py-3"><Bar className="h-3.5 w-36" /><Bar className="mt-2 h-2.5 w-28" /></div>
        <div className="space-y-3 p-4">
          {[0, 1, 2, 3].map(row => <div key={row} className="flex items-center gap-3">
            <Bar className="size-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5"><Bar className="h-2.5 w-1/2" /><Bar className="h-2 w-1/3" /></div>
            <Bar className="h-2.5 w-12" />
          </div>)}
        </div>
      </div>)}
      <div className="border border-[#eee4df] bg-white xl:col-span-2">
        <div className="border-b border-[#f1eae6] px-4 py-3"><Bar className="h-3.5 w-36" /><Bar className="mt-2 h-2.5 w-60 max-w-full" /></div>
        <div className="space-y-3 p-4">
          {[0, 1, 2, 3].map(row => <div key={row} className="flex items-center gap-3">
            <Bar className="size-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5"><Bar className="h-2.5 w-1/3" /><Bar className="h-2 w-1/4" /></div>
            <Bar className="h-2.5 w-16" />
          </div>)}
        </div>
      </div>
    </div>
  </div>
}

// Stock: title plus Add stock, the totals chips, then the photo card grid and
// pagination.
function StockSkeleton() {
  return <div className="space-y-5">
    <PageHeader actions={1} />
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
      {[0, 1, 2, 3].map(index => <Bar key={index} className="h-7 w-24 rounded-lg sm:h-9 sm:w-32" />)}
    </div>
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 lg:gap-4 2xl:grid-cols-5">
      {Array.from({ length: 10 }, (_, index) => <div key={index} className="rounded-xl border border-[#e7ebf0] bg-white p-1.5 sm:p-4">
        <div className="aspect-[4/3] w-full animate-pulse rounded-lg bg-[#f1f4f8] sm:aspect-[16/10] sm:rounded-xl" />
        <Bar className="mx-auto mt-2 h-3 w-2/3" />
        <div className="mt-1.5 flex justify-center gap-1"><Bar className="h-3 w-9" /><Bar className="h-3 w-9" /></div>
        <Bar className="mx-auto mt-2 h-5 w-12" />
        <Bar className="mx-auto mt-1.5 h-3 w-16" />
        <div className="mt-2 flex justify-center gap-1">
          {[0, 1, 2, 3].map(control => <Bar key={control} className="size-6 rounded-md sm:size-9" />)}
        </div>
      </div>)}
    </div>
    <div className="flex justify-center"><Bar className="h-8 w-64 max-w-full rounded-lg" /></div>
  </div>
}

// Make sale: one record-sale card holding item lines, customer fields and the
// total/save footer.
function MakeSaleSkeleton() {
  return <div className="mx-auto w-full max-w-2xl rounded-xl border border-[#e7ebf0] bg-white p-4">
    <Bar className="h-3.5 w-32" />
    <Bar className="mt-2 h-2.5 w-full max-w-md" />
    <div className="mt-4 space-y-3">
      {[0, 1, 2].map(index => <div key={index} className="rounded-lg border border-[#eef1f5] p-2.5">
        <div className="flex items-center gap-2"><Bar className="h-7 flex-1" /><Bar className="size-7 shrink-0 rounded-md" /></div>
        <div className="mt-2 grid grid-cols-3 gap-2">{[0, 1, 2].map(field => <Bar key={field} className="h-7 rounded-md" />)}</div>
      </div>)}
      <div className="grid gap-2 sm:grid-cols-2"><Bar className="h-9 rounded-md" /><Bar className="h-9 rounded-md" /></div>
      <Bar className="h-9 rounded-md" />
    </div>
    <div className="mt-4 flex items-center justify-between border-t border-[#f1f5f9] pt-3">
      <Bar className="h-3 w-28" /><Bar className="h-9 w-28 rounded-lg" />
    </div>
  </div>
}

// Sales, expenses and damage records: header chips, the From/To filter row,
// then rows (or two-column cards for expenses) and pagination.
function RecordsSkeleton({ cards = false }) {
  return <div className="rounded-xl border border-[#e7ebf0] bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2"><Bar className="h-4 w-36" /><Bar className="h-5 w-8 rounded-full" /></div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Bar className="h-6 w-24 rounded-full" /><Bar className="h-6 w-24 rounded-full" /><Bar className="h-9 w-32 rounded-lg" />
      </div>
    </div>
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      <Bar className="h-8 w-24 rounded-md" /><Bar className="h-8 w-24 rounded-md" />
      {[0, 1, 2, 3].map(index => <Bar key={index} className="h-8 w-14 rounded-md" />)}
    </div>
    {cards ? <div className="mt-4 grid gap-3 md:grid-cols-2">
      {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl border border-[#eef1f5] bg-white" />)}
    </div> : <div className="mt-3 divide-y divide-[#f1f5f9]">
      {Array.from({ length: 6 }, (_, index) => <div key={index} className="flex items-center gap-3 py-2.5">
        <Bar className="size-7 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-1.5"><Bar className="h-2.5 w-1/2" /><Bar className="h-2 w-2/3" /></div>
        <Bar className="h-2.5 w-16" /><Bar className="size-6 shrink-0 rounded-md" />
      </div>)}
    </div>}
    <div className="mt-4 flex justify-center"><Bar className="h-8 w-64 max-w-full rounded-lg" /></div>
  </div>
}

// Categories > Food type / Expenses: add-category form and the grid of
// category tiles.
function CategoriesSkeleton() {
  return <div className="space-y-5">
    <PageHeader actions={0} />
    <div className="rounded-xl border border-[#e7ebf0] bg-white p-4">
      <div className="flex items-center gap-2"><Bar className="h-4 w-40" /><Bar className="h-5 w-8 rounded-full" /></div>
      <div className="mt-3 flex w-full max-w-sm gap-2"><Bar className="h-9 flex-1 rounded-lg" /><Bar className="h-9 w-16 rounded-lg" /></div>
      <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(145px,1fr))] gap-3">
        {Array.from({ length: 8 }, (_, index) => <div key={index} className="min-h-36 animate-pulse rounded-2xl border border-[#e7ebf0] bg-white" />)}
      </div>
    </div>
  </div>
}

// Chefs and Accounts: description with the create action, then the account
// table with its role, permissions and status columns.
function AccountsSkeleton() {
  return <div className="space-y-5">
    <PageHeader actions={1} />
    <div className="overflow-hidden rounded-2xl border border-[#e7ebf0] bg-white">
      <div className="border-b border-[#f1f5f9] px-5 py-3"><Bar className="h-2.5 w-full max-w-md" /></div>
      {Array.from({ length: 6 }, (_, index) => <div key={index} className="flex items-center gap-3 border-b border-[#f1f4f9] px-5 py-3.5 last:border-0">
        <Bar className="size-8 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1.5"><Bar className="h-2.5 w-1/3" /><Bar className="h-2 w-1/4" /></div>
        <Bar className="hidden h-5 w-16 rounded-full sm:block" />
        <Bar className="hidden h-2.5 w-24 sm:block" />
        <Bar className="h-6 w-20 rounded" />
      </div>)}
    </div>
  </div>
}

// Profile: heading with the edit action, the identity banner and the account
// field grid.
function ProfileSkeleton() {
  return <div className="mx-auto max-w-2xl">
    <div className="mb-6 flex items-center justify-between gap-3">
      <div className="space-y-2"><Bar className="h-5 w-32" /><Bar className="h-2.5 w-56 max-w-full" /></div>
      <Bar className="h-9 w-28 rounded-lg" />
    </div>
    <div className="overflow-hidden rounded-2xl border border-[#eee4df] bg-white">
      <div className="flex flex-col items-center gap-2 border-b border-[#eee4df] bg-[#fbf8f6] px-6 py-8">
        <Bar className="size-20 rounded-full" />
        <Bar className="mt-2 h-4 w-32" /><Bar className="h-3 w-44 max-w-full" />
      </div>
      <div className="grid gap-6 p-6 sm:grid-cols-2">
        {[0, 1, 2, 3].map(index => <div key={index} className="space-y-2">
          <Bar className="h-2.5 w-24" /><Bar className="h-3.5 w-32" />
        </div>)}
      </div>
    </div>
  </div>
}

// Security: the four signal counters above the filtered event list.
function SecuritySkeleton() {
  return <div className="space-y-5">
    <PageHeader actions={1} />
    <div className="grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-2 min-[360px]:gap-3 xl:grid-cols-4">
      {[0, 1, 2, 3].map(index => <div key={index} className="h-[96px] animate-pulse rounded-2xl border border-[#f0e8e4] bg-white" />)}
    </div>
    <div className="overflow-hidden rounded-2xl border border-[#e7ebf0] bg-white">
      <div className="flex flex-wrap gap-1.5 border-b border-[#f1f5f9] px-3 py-3 sm:px-4">
        {[0, 1, 2, 3, 4, 5, 6].map(index => <Bar key={index} className="h-5 w-20 rounded-md" />)}
      </div>
      <div className="divide-y divide-[#f1f5f9]">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="grid gap-2 px-3 py-3.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start sm:gap-3 sm:px-5">
          <Bar className="h-5 w-24 rounded-full" />
          <Bar className="h-2.5 w-full max-w-sm" />
          <div className="flex gap-2"><Bar className="h-2 w-20" /><Bar className="h-2 w-16" /></div>
        </div>)}
      </div>
    </div>
  </div>
}

// Help & support: the contact field grid, the message box and the save row.
function SupportSkeleton() {
  return <div className="space-y-5">
    <PageHeader actions={0} />
    <div className="grid gap-4 rounded-2xl border border-[#e7ebf0] bg-white p-4 sm:grid-cols-2 sm:p-5">
      {[0, 1, 2, 3].map(index => <div key={index} className="space-y-1.5">
        <Bar className="h-2.5 w-28" /><Bar className="h-10 w-full rounded-lg" />
      </div>)}
    </div>
    <div className="rounded-2xl border border-[#e7ebf0] bg-white p-4 sm:p-5">
      <Bar className="h-2.5 w-32" /><Bar className="mt-1.5 h-20 w-full rounded-lg" />
    </div>
    <div className="flex justify-end"><Bar className="h-10 w-32 rounded-lg" /></div>
  </div>
}

// Developer platform overview: the system status line, three counters and the
// business/health panels.
function PlatformSkeleton() {
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Bar className="h-3 w-64 max-w-full" /><Bar className="h-6 w-28 rounded-full" />
    </div>
    <Metrics count={3} columns="grid grid-cols-2 gap-2.5 min-[420px]:gap-3 xl:grid-cols-3" />
    <div className="grid gap-4 xl:grid-cols-2">
      {[0, 1].map(index => <div key={index} className="rounded-2xl border border-[#e7ebf0] bg-white p-5">
        <Bar className="h-3.5 w-32" /><Bar className="mt-2 h-2.5 w-56 max-w-full" />
        <div className="mt-5 space-y-3">{[0, 1, 2].map(row => <Bar key={row} className="h-8 w-full rounded-lg" />)}</div>
      </div>)}
    </div>
  </div>
}

function ListSkeleton() {
  return <div className="space-y-4">
    <PageHeader actions={1} />
    <div className="grid gap-2">
      {Array.from({ length: 5 }, (_, index) => <div key={index} className="flex items-center gap-3 rounded-xl border border-[#eef1f5] bg-white px-4 py-3">
        <Bar className="size-8 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-1.5"><Bar className="h-2.5 w-1/3" /><Bar className="h-2 w-1/5" /></div>
      </div>)}
    </div>
  </div>
}

// Each skeleton mirrors the shape of the section it replaces — cards, table
// rows, form fields or record lists — so the loading state sits exactly where
// the fetched content will appear.
export function SectionSkeleton({ sectionKey }) {
  const body = sectionKey === 'Overview' ? <OverviewSkeleton />
    : sectionKey === 'Platform overview' ? <PlatformSkeleton />
      : sectionKey === 'Reports' ? <ReportsSkeleton />
        : sectionKey === 'Stock' ? <StockSkeleton />
          : sectionKey === 'Make sale' ? <MakeSaleSkeleton />
            : sectionKey === 'Sales' ? <RecordsSkeleton />
              : sectionKey === 'Purchase expenses' ? <RecordsSkeleton cards />
                : sectionKey === 'Purchase damages' ? <RecordsSkeleton />
                  : ['Food type', 'Expenses'].includes(sectionKey) ? <CategoriesSkeleton />
                    : ['Chefs', 'Accounts'].includes(sectionKey) ? <AccountsSkeleton />
                      : sectionKey === 'Profile' ? <ProfileSkeleton />
                        : sectionKey === 'Security' ? <SecuritySkeleton />
                          : sectionKey === 'Help & support' ? <SupportSkeleton />
                            : <ListSkeleton />

  return <div role="status" aria-live="polite" className="space-y-4">
    <span className="sr-only">Loading {sectionKey}…</span>
    {body}
    <p className="flex items-center justify-center gap-2 pt-1 text-[10px] font-medium text-[#94a3b8]">
      <Loader2 size={13} className="animate-spin text-[#e7654b]" />
      Loading {sectionKey}…
    </p>
  </div>
}

// The gate applies to navigation after the initial dashboard has mounted.
export function SectionGate({ sectionKey, ready, children }) {
  // `key` is the section behind the skeleton. Comparing it during render means
  // a switch shows the skeleton immediately, without a flash of new content.
  const [state, setState] = useState({ key: sectionKey, elapsed: true, lost: false, busy: false, attempt: 0 })
  // Captured during render (before the new section's effects start its
  // fetches), so only requests started by this section keep the skeleton up.
  const baseline = useRef(null)
  if (!baseline.current) baseline.current = { key: sectionKey, ...loadSnapshot() }
  const switched = state.key !== sectionKey
  if (switched && baseline.current.key !== sectionKey) {
    baseline.current = { key: sectionKey, ...loadSnapshot() }
  }

  // A fresh section gets a fresh minimum window and forgets any earlier
  // connection failure.
  useEffect(() => {
    if (state.key === sectionKey) return
    setState({ key: sectionKey, elapsed: false, lost: false, busy: false, attempt: 0 })
  }, [sectionKey, state.key])

  // Hold the skeleton for the minimum window (and again after a retry).
  useEffect(() => {
    if (state.elapsed) return undefined
    const timer = window.setTimeout(() => {
      setState(previous => previous.key === sectionKey ? { ...previous, elapsed: true } : previous)
    }, MINIMUM_MS)
    return () => window.clearTimeout(timer)
  }, [state.elapsed, state.key, sectionKey])

  const gating = switched || !state.elapsed || ready === false || state.lost || state.busy

  // Watch the requests this section started: a pending one keeps the skeleton
  // up until the data is ready, and one that never reached the server keeps it
  // loading instead of revealing a section with no data.
  useEffect(() => {
    if (!gating || state.lost) return undefined
    const startedWith = baseline.current
    const sync = snapshot => {
      if (snapshot.networkFailures > startedWith.networkFailures) {
        setState(previous => previous.lost ? previous : { ...previous, lost: true })
        return
      }
      const busy = snapshot.pending > startedWith.pending
      setState(previous => previous.busy === busy ? previous : { ...previous, busy })
    }
    sync(loadSnapshot())
    return subscribeLoads(sync)
  }, [gating, state.lost])

  // When the connection returns, remount the section so its requests retry and
  // the skeleton can finish normally.
  useEffect(() => {
    if (!state.lost) return undefined
    const retry = () => {
      baseline.current = { key: sectionKey, ...loadSnapshot() }
      setState(previous => ({ ...previous, lost: false, busy: false, elapsed: false, attempt: previous.attempt + 1 }))
    }
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [state.lost])

  // Children are mounted (so their fetches start immediately) but hidden while
  // the skeleton fills the same content area; they appear when loading ends.
  return (
    <div aria-busy={gating}>
      {gating && <SectionSkeleton key={`${sectionKey}:${state.attempt}`} sectionKey={sectionKey} />}
      <div hidden={gating}>
        <div key={`${sectionKey}:${state.attempt}`}>{children}</div>
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ActionProgress } from '../ActionProgress/ActionProgress.jsx'

// Kampala calendar day as YYYY-MM-DD, independent of the device timezone.
const bigDay = value => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(value)

export function DateCalendar({ from, to, onApply, onClose }) {
  const today = bigDay(new Date())
  const [view, setView] = useState(() => {
    const base = from ? new Date(`${from}T12:00:00`) : new Date()
    return { year: base.getFullYear(), month: base.getMonth() }
  })
  const [draftStart, setDraftStart] = useState(from)
  const [applyingDay, setApplyingDay] = useState('')

  const grid = useMemo(() => {
    const first = new Date(view.year, view.month, 1)
    // Monday-first grid; getDay() counts from Sunday.
    const startOffset = (first.getDay() + 6) % 7
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let day = 1; day <= daysInMonth; day++) {
      const value = new Date(Date.UTC(view.year, view.month, day, 12))
      cells.push(bigDay(value))
    }
    return cells
  }, [view])

  const shiftMonth = delta => setView(previous => {
    const next = new Date(previous.year, previous.month + delta, 1)
    return { year: next.getFullYear(), month: next.getMonth() }
  })

  const pick = async day => {
    if (applyingDay) return
    if (!draftStart || day <= draftStart) {
      setDraftStart(day)
      setApplyingDay(day)
      try { await onApply(day, day) } finally { setApplyingDay('') }
      return
    }
    setApplyingDay(day)
    try {
      await onApply(draftStart, day)
      setDraftStart(null)
      onClose()
    } finally { setApplyingDay('') }
  }

  const monthLabel = new Date(view.year, view.month, 1)
    .toLocaleDateString('en-UG', { month: 'long', year: 'numeric' })
  const inDraft = day => draftStart && day >= draftStart && (!to || day <= to)

  return <div className="w-[236px]">
    <div className="flex items-center justify-between px-2 pb-2">
      <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className="grid size-6 place-items-center rounded-md text-[#8d817b] transition hover:bg-[#fff8f5] hover:text-[#d95c43]"><ChevronLeft size={13} /></button>
      <span className="text-[10px] font-semibold text-[#292421]">{monthLabel}</span>
      <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className="grid size-6 place-items-center rounded-md text-[#8d817b] transition hover:bg-[#fff8f5] hover:text-[#d95c43]"><ChevronRight size={13} /></button>
    </div>
    <div className="grid grid-cols-7 gap-y-0.5 border-t border-[#f1eae6] pt-2">
      {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(day => <span key={day} className="grid h-5 place-items-center text-[8px] font-semibold text-[#a19690]">{day}</span>)}
      {grid.map((day, index) => day
        ? <button key={day} type="button" disabled={Boolean(applyingDay)} onClick={() => pick(day)} aria-label={applyingDay === day ? `Loading ${day}` : undefined} className={`mx-auto grid size-6 place-items-center rounded-md text-[9px] transition disabled:cursor-wait disabled:opacity-60 ${day === today ? 'bg-[#fde3da] font-bold text-[#d95c43]' : inDraft(day) ? 'bg-[#fff0ea] text-[#d95c43]' : 'text-[#655a54] hover:bg-[#fff8f5]'}`}>{applyingDay === day ? <ActionProgress><span className="sr-only">Loading date…</span></ActionProgress> : Number(day.slice(-2))}</button>
        : <span key={`gap-${index}`} />)}
    </div>
    <p className="mt-2 border-t border-[#f1eae6] pt-2 text-center text-[8px] text-[#a19690]">Tap a day for that date · tap two days for a range</p>
  </div>
}

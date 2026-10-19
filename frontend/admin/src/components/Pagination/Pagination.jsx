import { ChevronLeft, ChevronRight } from 'lucide-react'

const visiblePages = (page, pageCount) => {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1)
  if (page <= 4) return [1, 2, 3, 4, 5, 'ellipsis-end', pageCount]
  if (page >= pageCount - 3) return [1, 'ellipsis-start', ...Array.from({ length: 5 }, (_, index) => pageCount - 4 + index)]
  return [1, 'ellipsis-start', page - 1, page, page + 1, 'ellipsis-end', pageCount]
}

export function Pagination({ page, pageCount, total, pageSize, onPageChange }) {
  if (pageCount <= 1) return null

  const firstItem = (page - 1) * pageSize + 1
  const lastItem = Math.min(page * pageSize, total)
  const buttonClass = 'grid size-8 place-items-center rounded-lg border border-[#e7ebf0] text-[11px] font-semibold text-[#64748b] transition hover:border-[#fdba74] hover:bg-[#fff7f4] disabled:cursor-not-allowed disabled:opacity-40'

  return <nav aria-label="List pages" className="flex flex-col gap-3 border-t border-[#f1f5f9] pt-3 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-center text-[10px] text-[#94a3b8] sm:text-left">Showing {firstItem}–{lastItem} of {total}</p>
    <div className="flex items-center justify-center gap-1">
      <button type="button" onClick={() => onPageChange(page - 1)} disabled={page === 1} aria-label="Previous page" className={buttonClass}><ChevronLeft size={14} /></button>
      {visiblePages(page, pageCount).map((number, index) => typeof number === 'number'
        ? <button key={number} type="button" onClick={() => onPageChange(number)} aria-label={`Page ${number}`} aria-current={page === number ? 'page' : undefined} className={`${buttonClass} ${page === number ? 'border-[#f97316] bg-[#fff4ec] text-[#ea580c]' : ''}`}>{number}</button>
        : <span key={`${number}-${index}`} aria-hidden="true" className="px-1 text-[11px] text-[#94a3b8]">…</span>)}
      <button type="button" onClick={() => onPageChange(page + 1)} disabled={page === pageCount} aria-label="Next page" className={buttonClass}><ChevronRight size={14} /></button>
    </div>
  </nav>
}

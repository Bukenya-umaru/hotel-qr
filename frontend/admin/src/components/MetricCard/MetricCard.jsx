import { ChevronDown } from 'lucide-react'
import { cx } from '../../lib/ui.js'

export function MetricCard({ title, value, change, icon: Icon, detail, inverse = false }) {
  return <div className={cx('flex h-full min-h-[104px] min-w-0 flex-col justify-between border p-3.5 sm:min-h-[108px]', inverse ? 'border-[#f2ddd4] bg-[#fffbf9]' : 'border-[#f0e8e4] bg-white')}>
    <div className="flex items-center justify-between gap-2">
      <span className="min-w-0 truncate text-[12px] font-medium text-[#655a54]">{title}</span>
      <span className="grid size-5 shrink-0 place-items-center rounded-full border border-[#eee4df] text-[#8d817b]"><ChevronDown size={12} /></span>
    </div>
    <div className="flex min-w-0 items-center gap-3">
      <span className={cx('grid size-9 shrink-0 place-items-center rounded-full', inverse ? 'bg-[#fde3da] text-[#db6248]' : 'bg-[#fde6dc] text-[#e7654b]')}><Icon size={18} strokeWidth={1.8} /></span>
      <strong className="font-display min-w-0 break-words text-[20px] font-bold leading-none tracking-[-.5px] text-[#292421] sm:text-[clamp(1.2rem,2vw,1.5rem)]">{value}</strong>
    </div>
    <div className="flex min-h-[18px] min-w-0 items-center gap-1.5">
      {change && <span className="rounded-full bg-[#eaf7ef] px-2 py-0.5 text-[9px] font-semibold text-[#55a978]">{change}</span>}
      <p className="min-w-0 truncate text-[9px] leading-4 text-[#8d817b]">{detail}</p>
    </div>
  </div>
}

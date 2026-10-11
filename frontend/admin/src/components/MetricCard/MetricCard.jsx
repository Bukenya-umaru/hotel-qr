import { ChevronDown } from 'lucide-react'
import { cx } from '../../lib/ui.js'

export function MetricCard({ title, value, change, icon: Icon, detail, inverse = false }) {
  return <div className={cx('flex h-full min-h-[96px] min-w-0 flex-col justify-between border p-2.5 sm:min-h-[100px] sm:p-3', inverse ? 'border-[#f0ddd5] bg-[#fffaf8]' : 'border-[#eee4df] bg-white')}>
    <div className="flex items-center justify-between gap-2">
      <span className="min-w-0 truncate text-[10px] font-medium text-[#786d67] sm:text-[11px]">{title}</span>
      <span className="grid size-5 shrink-0 place-items-center rounded-full border border-[#e8ded9] text-[#8d817b]"><ChevronDown size={12} /></span>
    </div>
    <div className="flex min-w-0 items-center gap-2.5">
      <span className={cx('grid size-9 shrink-0 place-items-center rounded-full', inverse ? 'bg-[#fff0ea] text-[#db6248]' : 'bg-[#fff0ea] text-[#e7654b]')}><Icon size={17} strokeWidth={1.8} /></span>
      <strong className="font-display min-w-0 break-words text-[17px] font-bold leading-tight tracking-[-.5px] text-[#292421] min-[420px]:text-[19px] sm:text-[clamp(1.1rem,2vw,1.45rem)]">{value}</strong>
    </div>
    <div className="flex min-h-[18px] min-w-0 items-center gap-1.5">
      {change && <span className="rounded-full bg-[#eaf7ef] px-2 py-0.5 text-[9px] font-semibold text-[#55a978]">{change}</span>}
      <p className="min-w-0 truncate text-[9px] leading-4 text-[#8d817b]">{detail}</p>
    </div>
  </div>
}

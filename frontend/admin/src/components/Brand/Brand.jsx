import { ConciergeBell } from 'lucide-react'

export function Brand({ compact = false }) {
  return <div className="flex items-center gap-2.5">
    <div className="grid size-9 place-items-center rounded-full bg-[#fff0ea] text-[#d95c43]"><ConciergeBell size={20} strokeWidth={1.8} /></div>
    {!compact && <span className="font-display text-[18px] font-extrabold tracking-[-1px] text-[#4b3a33]">WAGA <span className="text-[#d95c43]">BITES</span></span>}
  </div>
}

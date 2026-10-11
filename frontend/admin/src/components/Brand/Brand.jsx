import { ChefHat } from 'lucide-react'

export function Brand({ compact = false }) {
  return <div className="flex items-center gap-2.5">
    <div className="grid size-9 place-items-center rounded-full bg-[#fff0ea] text-[#d95c43]"><ChefHat size={20} strokeWidth={1.8} /></div>
    {!compact && <span className="font-display text-[19px] font-extrabold tracking-[-1px] text-[#635149]">WAGA <span className="text-[#d95c43]">BITS</span></span>}
  </div>
}

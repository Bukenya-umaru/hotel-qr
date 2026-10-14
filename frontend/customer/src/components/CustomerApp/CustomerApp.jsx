import { ArrowRight, ChartNoAxesCombined, Receipt, ShoppingBag, Boxes } from 'lucide-react'
import { InstallPrompt } from '../InstallPrompt/InstallPrompt.jsx'

export default function CustomerApp() {
  const managementUrl = import.meta.env.VITE_ADMIN_URL || (import.meta.env.DEV ? 'http://localhost:5173' : '/admin')
  return <main className="grid min-h-screen place-items-center bg-[#fbf8f6] px-5 py-12 text-[#292421]">
    <InstallPrompt />
    <section className="w-full max-w-[540px] border border-[#eee4df] bg-white p-7 shadow-sm sm:p-10">
      <div className="grid size-11 place-items-center rounded-full bg-[#fff0ea] text-[#d95c43]"><ChartNoAxesCombined size={22} /></div>
      <p className="mt-6 text-[10px] font-bold uppercase tracking-[1.5px] text-[#d95c43]">WAGA BITES</p>
      <h1 className="mt-2 font-display text-[25px] font-extrabold tracking-[-.8px] sm:text-[30px]">Business management</h1>
      <p className="mt-3 text-[13px] leading-6 text-[#786d67]">Manage your food items, record sales and expenses, and keep track of stock in one place.</p>
      <div className="mt-7 grid grid-cols-3 gap-2">
        {[
          { label: 'Food items', icon: ShoppingBag },
          { label: 'Sales', icon: Receipt },
          { label: 'Stock', icon: Boxes },
        ].map(({ label, icon: Icon }) => <div key={label} className="grid min-h-[84px] place-items-center content-center gap-2 border border-[#f1eae6] bg-[#fffdfc] p-2 text-center text-[10px] font-medium text-[#655a54]"><Icon size={17} className="text-[#d95c43]" />{label}</div>)}
      </div>
      <a href={managementUrl} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#e7654b] px-4 py-3 text-[12px] font-semibold text-white transition hover:bg-[#d95c43]">Open management dashboard <ArrowRight size={15} /></a>
    </section>
  </main>
}

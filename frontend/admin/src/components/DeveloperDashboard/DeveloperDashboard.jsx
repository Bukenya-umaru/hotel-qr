import { ArrowRight, Building2, Database, Settings2, Users } from 'lucide-react'
import { Badge } from '../Badge/Badge.jsx'
import { MetricCard } from '../MetricCard/MetricCard.jsx'

export function DeveloperDashboard({ users, onNavigate, overview }) {
  const business = overview.business
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[12px] text-[#94a3b8]">Support the WAGA BITES business and its team.</p><Badge><i className="pulse-dot size-1.5 rounded-full bg-[#f97316]" />System online</Badge></div>
    <div className="grid grid-cols-2 gap-2.5 min-[420px]:gap-3 xl:grid-cols-3">
      <MetricCard title="Business" value={business ? 'Active' : 'Not configured'} icon={Building2} detail={business?.name || 'Run the business-owner setup once'} />
      <MetricCard title="Team accounts" value={overview.userCount ?? users.length} icon={Users} detail="Business owner and chefs" />
      <MetricCard title="Database" value={overview.databaseStatus || 'Unknown'} icon={Database} detail="Business records and activity" inverse />
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-2xl border border-[#e7ebf0] bg-white p-5">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-[14px] font-bold">Business</h2><p className="mt-1 text-[10px] text-[#94a3b8]">Single business monitored by WAGA BITES support</p></div></div>
        {business ? <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#fff8f0] p-4"><Building2 className="shrink-0 text-[#ea580c]" size={19} /><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-semibold">{business.name}</p><p className="mt-1 text-[10px] text-[#94a3b8]">{business.city || 'UGX business account'}</p></div><Badge>Active</Badge></div> : <p className="mt-5 rounded-xl bg-[#f8fafc] p-4 text-[11px] leading-5 text-[#94a3b8]">Initialize the business owner account with <code>npm run seed:business-owner</code>.</p>}
      </section>
      <section className="rounded-2xl border border-[#e7ebf0] bg-white p-5">
        <div className="flex items-center justify-between"><div><h2 className="font-display text-[14px] font-bold">Support & system health</h2><p className="mt-1 text-[10px] text-[#94a3b8]">Account assistance and service checks</p></div><Settings2 size={16} className="text-[#94a3b8]" /></div>
        <div className="mt-5 space-y-4">{[['API service', 'Online'], ['Database', overview.databaseStatus || 'Connected'], ['Business account', business ? 'Ready' : 'Setup required']].map(([label, value]) => <div key={label} className="flex items-center justify-between"><span className="text-[10px] text-[#64748b]">{label}</span><span className="flex items-center gap-1.5 text-[10px] font-semibold text-[#ea580c]"><i className="size-1.5 rounded-full bg-[#f97316]" />{value}</span></div>)}</div>
        <button onClick={() => onNavigate('Accounts')} className="mt-5 w-full rounded-lg border border-[#e7ebf0] px-3 py-2.5 text-left text-[10px] font-semibold text-[#ea580c]">Help with account access <ArrowRight size={12} className="float-right" /></button>
      </section>
    </div>
  </div>
}

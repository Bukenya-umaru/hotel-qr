import { Activity, ArrowRight, Building2, Settings2, ShoppingBag, Users } from 'lucide-react'
import { Badge } from '../Badge/Badge.jsx'
import { MetricCard } from '../MetricCard/MetricCard.jsx'
import { OrdersTable } from '../OrdersTable/OrdersTable.jsx'

export function DeveloperDashboard({ users, orders, onNavigate, overview }) {
  const business = overview.business
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[12px] text-[#8d9389]">Support the WAGA BITS business and its team.</p><Badge><i className="pulse-dot size-1.5 rounded-full bg-[#bd641f]" />System online</Badge></div>
    <div className="grid grid-cols-2 gap-2.5 min-[420px]:gap-3 xl:grid-cols-3">
      <MetricCard title="Business" value={business ? 'Active' : 'Not configured'} icon={Building2} detail={business?.name || 'Run the business-owner setup once'} />
      <MetricCard title="Team accounts" value={overview.userCount ?? users.length} icon={Users} detail="Business owner and chefs" />
      <MetricCard title="Active orders" value={overview.activeOrdersCount ?? 0} icon={ShoppingBag} detail="Orders currently being served" inverse />
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-2xl border border-[#eceee8] bg-white p-5">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-[14px] font-bold">Business</h2><p className="mt-1 text-[10px] text-[#999e94]">Single business monitored by WAGA BITS support</p></div></div>
        {business ? <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#fff6ef] p-4"><Building2 className="shrink-0 text-[#b65a1d]" size={19} /><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-semibold">{business.name}</p><p className="mt-1 text-[10px] text-[#8d9389]">{business.city || 'UGX business account'}</p></div><Badge>Active</Badge></div> : <p className="mt-5 rounded-xl bg-[#f7f8f5] p-4 text-[11px] leading-5 text-[#858b81]">Initialize the business owner account with <code>npm run seed:business-owner</code>.</p>}
      </section>
      <section className="rounded-2xl border border-[#eceee8] bg-white p-5">
        <div className="flex items-center justify-between"><div><h2 className="font-display text-[14px] font-bold">Support & system health</h2><p className="mt-1 text-[10px] text-[#999e94]">Account assistance and service checks</p></div><Settings2 size={16} className="text-[#9aa095]" /></div>
        <div className="mt-5 space-y-4">{[['API service', 'Online'], ['Database', overview.databaseStatus || 'Connected'], ['Order updates', 'Realtime']].map(([label, value]) => <div key={label} className="flex items-center justify-between"><span className="text-[10px] text-[#7f867b]">{label}</span><span className="flex items-center gap-1.5 text-[10px] font-semibold text-[#aa541b]"><i className="size-1.5 rounded-full bg-[#c66a24]" />{value}</span></div>)}</div>
        <button onClick={() => onNavigate('Accounts')} className="mt-5 w-full rounded-lg border border-[#eceee8] px-3 py-2.5 text-left text-[10px] font-semibold text-[#a75720]">Help with account access <ArrowRight size={12} className="float-right" /></button>
      </section>
    </div>
    <OrdersTable orders={orders} compact onViewAll={() => onNavigate('Orders')} />
  </div>
}

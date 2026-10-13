import { Plus } from 'lucide-react'
import { Badge } from '../Badge/Badge.jsx'
import { PERMISSIONS } from '../../lib/ui.js'

const SHORT_LABELS = { view_sales: 'Sales', manage_menu: 'Food items', manage_stock: 'Stock', manage_expenses: 'Expenses', manage_sales: 'Record sales' }
const ALL_KEYS = PERMISSIONS.map(permission => permission.key)

export function AccountsPage({ users, role, passwordViewable, onCreate, onToggle, onReset, onEdit, onView }) {
  const isOwner = role === 'OWNER'
  const canCreate = isOwner
  const accountLabel = user => user.role === 'OWNER' ? 'Business owner' : 'Chef'
  const permissionKeys = user => (user.permissions === undefined ? ALL_KEYS : user.permissions).filter(key => key !== 'manage_tables')
  const permissionSummary = user => permissionKeys(user).map(key => SHORT_LABELS[key] || key).join(' · ') || 'No permissions'

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[12px] text-[#94a3b8]">{isOwner ? 'Create and manage chefs and choose what each one can do — manage food items, sales, expenses, and stock.' : 'Help the business owner with account access and passwords.'}</p>
      {canCreate && <button onClick={onCreate} className="flex items-center gap-2 rounded-lg bg-[#f97316] px-3.5 py-2.5 text-[11px] font-semibold text-white"><Plus size={15} />Create chef account</button>}
    </div>
    <section className="overflow-hidden rounded-2xl border border-[#e7ebf0] bg-white">
      <div className="divide-y divide-[#f1f5f9] md:hidden">{users.map(user => <article key={user._id || user.email} className="space-y-3 p-4">
        <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[12px] font-semibold">{user.name}</p><p className="mt-1 break-all text-[10px] text-[#94a3b8]">{user.email}</p></div><Badge tone={user.isActive === false ? 'gray' : 'green'}>{user.isActive === false ? 'Inactive' : 'Active'}</Badge></div>
        <div className="flex flex-wrap items-center gap-1.5"><Badge tone={user.role === 'OWNER' ? 'green' : 'blue'}>{accountLabel(user)}</Badge>{user.role === 'KITCHEN' && <span className="rounded-md bg-[#f1f4f9] px-2 py-1 text-[9px] font-medium text-[#64748b]">{permissionSummary(user)}</span>}</div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-[#f1f5f9] pt-3">
          {isOwner ? <>
            {user.role === 'KITCHEN' && <button onClick={() => onEdit(user)} className="text-[10px] font-semibold text-[#ea580c]">Permissions</button>}
            {user.role === 'KITCHEN' && passwordViewable && <button onClick={() => onView(user)} disabled={!user.hasViewablePassword} title={user.hasViewablePassword ? undefined : 'Reset the password once to make it viewable'} className="text-[10px] font-semibold text-[#ea580c] disabled:text-[#e2e8f0] disabled:opacity-60">{user.hasViewablePassword ? 'View password' : 'View password*'}</button>}
            <button onClick={() => onToggle(user)} className="text-[10px] font-semibold text-[#ea580c]">{user.isActive === false ? 'Reactivate' : 'Deactivate'}</button>
          </> : <><button onClick={() => onEdit(user)} className="text-[10px] font-semibold text-[#ea580c]">Edit account</button>{passwordViewable && <button onClick={() => onView(user)} disabled={!user.hasViewablePassword} title={user.hasViewablePassword ? undefined : 'Reset the password once to make it viewable'} className="text-[10px] font-semibold text-[#ea580c] disabled:text-[#e2e8f0] disabled:opacity-60">{user.hasViewablePassword ? 'View password' : 'View password*'}</button>}<button onClick={() => onReset(user)} className="text-[10px] font-semibold text-[#ea580c]">Reset password</button><button onClick={() => onToggle(user)} className="text-[10px] font-semibold text-[#ea580c]">{user.isActive === false ? 'Reactivate' : 'Deactivate'}</button></>}
        </div>
      </article>)}</div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[620px] text-left"><thead><tr className="border-b border-[#f1f5f9] text-[9px] font-semibold uppercase tracking-[.8px] text-[#94a3b8]"><th className="px-5 py-3">Account</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Permissions</th><th className="px-4 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody>{users.map(user => <tr key={user._id || user.email} className="border-b border-[#f1f4f9] last:border-0">
        <td className="px-5 py-3.5"><p className="text-[11px] font-semibold">{user.name}</p><p className="mt-1 text-[9px] text-[#94a3b8]">{user.email}</p></td>
        <td className="px-4 py-3.5"><Badge tone={user.role === 'OWNER' ? 'green' : 'blue'}>{accountLabel(user)}</Badge></td>
        <td className="px-4 py-3.5">{user.role === 'KITCHEN' ? <span className="inline-block rounded-md bg-[#f1f4f9] px-2 py-1 text-[9px] font-medium text-[#64748b]">{permissionSummary(user)}</span> : <span className="text-[10px] text-[#94a3b8]">Full access</span>}</td>
        <td className="px-4 py-3.5"><Badge tone={user.isActive === false ? 'gray' : 'green'}>{user.isActive === false ? 'Inactive' : 'Active'}</Badge></td>
        <td className="space-x-3 px-5 py-3.5 text-right">{isOwner ? <>
          {user.role === 'KITCHEN' && <button onClick={() => onEdit(user)} className="text-[10px] font-semibold text-[#ea580c]">Permissions</button>}
          {user.role === 'KITCHEN' && passwordViewable && <button onClick={() => onView(user)} disabled={!user.hasViewablePassword} title={user.hasViewablePassword ? undefined : 'Reset the password once to make it viewable'} className="text-[10px] font-semibold text-[#ea580c] disabled:text-[#e2e8f0] disabled:opacity-60">{user.hasViewablePassword ? 'View password' : 'View password*'}</button>}
          <button onClick={() => onToggle(user)} className="text-[10px] font-semibold text-[#ea580c]">{user.isActive === false ? 'Reactivate' : 'Deactivate'}</button>
        </> : <><button onClick={() => onEdit(user)} className="text-[10px] font-semibold text-[#ea580c]">Edit</button>{passwordViewable && <button onClick={() => onView(user)} disabled={!user.hasViewablePassword} title={user.hasViewablePassword ? undefined : 'Reset the password once to make it viewable'} className="text-[10px] font-semibold text-[#ea580c] disabled:text-[#e2e8f0] disabled:opacity-60">{user.hasViewablePassword ? 'View password' : 'View password*'}</button>}<button onClick={() => onReset(user)} className="text-[10px] font-semibold text-[#ea580c]">Reset password</button><button onClick={() => onToggle(user)} className="text-[10px] font-semibold text-[#ea580c]">{user.isActive === false ? 'Reactivate' : 'Deactivate'}</button></>}</td>
      </tr>)}</tbody></table></div>
      {!users.length && <p className="px-5 py-10 text-center text-[11px] text-[#94a3b8]">{isOwner ? 'No chef accounts yet. Create one to manage food items, sales, expenses, and stock.' : 'No accounts are available to support yet.'}</p>}
      {users.length > 0 && passwordViewable && <p className="px-5 py-3 text-[10px] text-[#94a3b8]">* Reset the password once for an account to make its current password viewable.</p>}
    </section>
  </div>
}
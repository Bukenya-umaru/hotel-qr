import { useEffect, useState } from 'react'
import { User, Mail, Shield, Hotel, Edit3, Save, X } from 'lucide-react'
import { api } from '../../lib/api.js'
import { cx } from '../../lib/ui.js'

export function ProfilePage({ user, role, onNavigate }) {
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({ ...user })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (role !== 'DEVELOPER') return
    setLoading(true)
    setError('')
    try {
      const data = await api(`/api/developer/users/${user._id}`, {
        method: 'PATCH',
        body: JSON.stringify(formData),
      })
      setFormData(data.user)
      setIsEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#292421]">My Profile</h1>
          <p className="text-[12px] text-[#938780]">View and manage your account details</p>
        </div>
        {role === 'DEVELOPER' && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 rounded-lg bg-[#e7654b] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#d95c43]"
          >
            <Edit3 size={14} /> Edit Profile
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#eee4df] bg-white shadow-sm">
        <div className="bg-[#fbf8f6] px-6 py-8 text-center border-b border-[#eee4df]">
          <div className="mx-auto grid size-20 shrink-0 place-items-center rounded-full bg-[#fde3da] text-2xl font-bold text-[#d95c43]">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <h2 className="mt-4 text-xl font-bold text-[#292421]">{user?.name}</h2>
          <p className="text-[12px] text-[#938780]">{user?.email}</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[11px] font-medium text-[#a19690] uppercase tracking-wider">
                <User size={14} /> Full Name
              </label>
              {isEditing && role === 'DEVELOPER' ? (
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-[#eee4df] bg-[#fbf8f6] px-3 py-2 text-[13px] outline-none focus:border-[#e7654b]"
                />
              ) : (
                <p className="text-[14px] font-semibold text-[#292421]">{user?.name}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[11px] font-medium text-[#a19690] uppercase tracking-wider">
                <Mail size={14} /> Email Address
              </label>
              {isEditing && role === 'DEVELOPER' ? (
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg border border-[#eee4df] bg-[#fbf8f6] px-3 py-2 text-[13px] outline-none focus:border-[#e7654b]"
                />
              ) : (
                <p className="text-[14px] font-semibold text-[#292421]">{user?.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[11px] font-medium text-[#a19690] uppercase tracking-wider">
                <Shield size={14} /> Account Role
              </label>
              <p className="text-[14px] font-semibold text-[#292421]">{user?.role}</p>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[11px] font-medium text-[#a19690] uppercase tracking-wider">
                <Hotel size={14} /> Business
              </label>
              <p className="text-[14px] font-semibold text-[#292421]">{user?.hotel?.name || 'N/A'}</p>
            </div>
          </div>

          {isEditing && role === 'DEVELOPER' && (
            <div className="flex items-center justify-end gap-3 border-t border-[#eee4df] pt-6">
              <button
                onClick={() => { setIsEditing(false); setFormData({ ...user }); }}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-[12px] font-medium text-[#786d67] transition hover:bg-[#fbf8f6]"
              >
                <X size={14} /> Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className={cx(
                  'flex items-center gap-2 rounded-lg bg-[#e7654b] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#d95c43]',
                  loading && 'cursor-wait opacity-60'
                )}
              >
                {loading ? 'Saving...' : <><Save size={14} /> Save Changes</>}
              </button>
            </div>
          )}

          {error && <p className="text-center text-[12px] text-red-500 font-medium">{error}</p>}
        </div>
      </div>
    </div>
  )
}

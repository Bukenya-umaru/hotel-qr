import { useEffect, useState } from 'react'
import {
  Check, ChevronDown, Plus, Settings2, SlidersHorizontal, Trash2, Utensils, Wallet, X,
} from 'lucide-react'
import { api } from '../../lib/api.js'
import { money, cx } from '../../lib/ui.js'
import { Modal } from '../Modal/Modal.jsx'

// The independent Categories page: a top-level section of the app with its
// own sidebar entry — not embedded inside Stock or Menu. Each category is a
// row that extends into its Food type and Expense subsections when clicked.
export function CategoriesPage() {
  const [categories, setCategories] = useState([])
  const [dishCategories, setDishCategories] = useState([])
  const [showCard, setShowCard] = useState(true)
  const [newCategory, setNewCategory] = useState('')
  const [newCategoryFoodType, setNewCategoryFoodType] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [renaming, setRenaming] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameFoodType, setRenameFoodType] = useState('')
  const [expenseTotals, setExpenseTotals] = useState({})
  const [expenseDetail, setExpenseDetail] = useState(null) // { category, data }
  const [recordFor, setRecordFor] = useState(null) // category object
  const [recordForm, setRecordForm] = useState({ amount: '', note: '' })

  const load = async () => {
    try {
      const [categoryData, menuData] = await Promise.all([
        api('/api/owner/categories'),
        api('/api/owner/menu'),
      ])
      setCategories(categoryData.categories)
      // Categories only used on old dishes (no managed category) stay
      // visible so nothing disappears from the list.
      const managed = new Set(categoryData.categories.map(category => category.name.toLowerCase()))
      const legacy = [...new Set(menuData.items.map(item => item.category).filter(Boolean))]
        .filter(name => !managed.has(name.toLowerCase()))
      setDishCategories(legacy)
      setCategoryError('')
    } catch (err) {
      setCategoryError(err.message)
    }
  }

  useEffect(() => { load() }, [])

  const categoryByName = new Map(categories.map(category => [category.name.toLowerCase(), category]))
  const allCategoryNames = [...categories.map(category => category.name), ...dishCategories]
    .sort((left, right) => left.localeCompare(right))

  // Spending totals per category, refreshed after every expense change.
  const loadExpenseTotals = async () => {
    try {
      const data = await api('/api/owner/categories/expenses-summary')
      const next = {}
      for (const entry of data.summary) next[entry.category] = entry
      setExpenseTotals(next)
    } catch {
      // Totals are a nice-to-have; silently keep the previous view.
    }
  }
  useEffect(() => { loadExpenseTotals() }, [categories.length])

  const openExpenses = async category => {
    setExpanded(previous => (previous === category.name ? null : category.name))
    try {
      const data = await api(`/api/owner/categories/${category._id}/expenses`)
      setExpenseDetail({ category, data })
    } catch (err) {
      setCategoryError(err.message)
    }
  }

  const addCategory = async event => {
    event.preventDefault()
    const name = newCategory.trim()
    if (!name) return
    if (allCategoryNames.some(name_ => name_.toLowerCase() === name.toLowerCase())) {
      setCategoryError('That category already exists.')
      return
    }
    setBusy(true)
    try {
      await api('/api/owner/categories', { method: 'POST', body: JSON.stringify({ name, foodType: newCategoryFoodType.trim() }) })
      setNewCategory('')
      setNewCategoryFoodType('')
      setCategoryError('')
      await load()
      loadExpenseTotals()
    } catch (err) {
      setCategoryError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const renameCategory = async () => {
    const name = renameValue.trim()
    if (!renaming || !name) return
    setBusy(true)
    try {
      await api(`/api/owner/categories/${renaming._id}`, { method: 'PATCH', body: JSON.stringify({ name, foodType: renameFoodType.trim() }) })
      setRenaming(null)
      setCategoryError('')
      await load()
      loadExpenseTotals()
    } catch (err) {
      setCategoryError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const removeCategory = async category => {
    if (!window.confirm(`Remove the "${category.name}" category? Its expenses are deleted too; dishes keep their category but it will no longer be a managed category.`)) return
    setBusy(true)
    try {
      await api(`/api/owner/categories/${category._id}`, { method: 'DELETE' })
      setCategoryError('')
      if (expanded === category.name) setExpanded(null)
      await load()
      loadExpenseTotals()
    } catch (err) {
      setCategoryError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const recordExpense = async event => {
    event.preventDefault()
    const amount = Number(recordForm.amount)
    if (!recordFor || !Number.isFinite(amount) || amount <= 0) {
      setCategoryError('Enter an expense amount greater than zero.')
      return
    }
    setBusy(true)
    try {
      await api(`/api/owner/categories/${recordFor._id}/expenses`, {
        method: 'POST',
        body: JSON.stringify({ amount, note: recordForm.note }),
      })
      const data = await api(`/api/owner/categories/${recordFor._id}/expenses`)
      setExpenseDetail({ category: recordFor, data })
      setRecordFor(null)
      setRecordForm({ amount: '', note: '' })
      loadExpenseTotals()
      setCategoryError('')
    } catch (err) {
      setCategoryError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const deleteExpense = async (category, expenseId) => {
    if (!window.confirm('Remove this expense record?')) return
    setBusy(true)
    try {
      await api(`/api/owner/categories/${category._id}/expenses/${expenseId}`, { method: 'DELETE' })
      const data = await api(`/api/owner/categories/${category._id}/expenses`)
      setExpenseDetail(previous => (previous?.category._id === category._id ? { category, data } : previous))
      loadExpenseTotals()
    } catch (err) {
      setCategoryError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const expenseTime = expense => expense.createdAt
    ? new Date(expense.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : ''

  return <div className="space-y-5">
    <div>
      <h2 className="font-display text-lg font-bold">Categories</h2>
      <p className="mt-1 text-[12px] text-[#8d9389]">Your menu's categories live here. Click a category to extend it into its food type and expense subsections — set what kind of food it covers and record the money spent on it.</p>
    </div>
    <div className="rounded-xl border border-[#eceee8] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold text-[#3d443a]">All categories</p>
        <button onClick={() => setShowCard(previous => !previous)} className={cx('flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-medium', showCard ? 'border-[#dca875] bg-[#fff6ef] text-[#a34b16]' : 'border-[#eceee8] text-[#747b70] hover:bg-[#f7f8f5]')}><SlidersHorizontal size={13} />{showCard ? 'Hide' : 'Show'}</button>
      </div>
      {showCard && <div className="mt-3 border-t border-dashed border-[#ebede7] pt-3">
        <form onSubmit={addCategory} className="flex flex-wrap gap-2"><input value={newCategory} onChange={event => setNewCategory(event.target.value)} maxLength="60" placeholder="New category, e.g. Grills" className="min-w-0 flex-1 rounded-lg border border-[#e6e9e1] px-3 py-2 text-[11px]" /><input value={newCategoryFoodType} onChange={event => setNewCategoryFoodType(event.target.value)} maxLength="60" placeholder="Food type, e.g. Beef" className="min-w-0 flex-1 rounded-lg border border-[#e6e9e1] px-3 py-2 text-[11px]" /><button disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-[#c65d1b] px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-60"><Plus size={13} />Add category</button></form>
        <ul className="mt-2.5 space-y-1">{allCategoryNames.map(name => {
          const managed = categoryByName.get(name.toLowerCase())
          if (!managed) {
            return <li key={name} className="flex items-center gap-1 rounded-lg border border-dashed border-[#e6e9e1] bg-white px-2.5 py-1.5 text-[10px] font-medium text-[#858b81]" title="In use on dishes — add it as a managed category to control it here">{name}</li>
          }
          const total = expenseTotals[managed._id]
          const isExpanded = expanded === name
          return <li key={name} className="rounded-lg border border-[#eceee8] bg-[#fafbf8]">
            <div className="flex items-center gap-1 px-2.5 py-1.5">
              <button onClick={() => openExpenses(managed)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[10px] font-semibold text-[#3d443a]">
                <ChevronDown size={12} className={cx('shrink-0 text-[#a6aa9f] transition-transform', isExpanded ? '' : '-rotate-90')} />
                <span className="truncate">{name}</span>
                {managed.foodType && <span className="shrink-0 rounded bg-[#fff1e6] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[.6px] text-[#a34b16]">{managed.foodType}</span>}
                {total && <span className="ml-auto shrink-0 text-[9px] font-medium text-[#8c6b35]">{money(total.total)} spent</span>}
              </button>
              {renaming === name ? <>
                <input autoFocus value={renameValue} onChange={event => setRenameValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') renameCategory(); if (event.key === 'Escape') setRenaming(null) }} maxLength="60" className="w-28 rounded border border-[#dca875] px-1.5 py-0.5 text-[10px]" />
                <input value={renameFoodType} onChange={event => setRenameFoodType(event.target.value)} maxLength="60" placeholder="Food type" className="w-24 rounded border border-[#dca875] px-1.5 py-0.5 text-[10px]" />
                <button disabled={busy} onClick={renameCategory} className="rounded p-1 text-[#a34b16] hover:bg-[#fff1e6]"><Check size={11} /></button>
                <button onClick={() => setRenaming(null)} className="rounded p-1 text-[#9b9f96] hover:bg-[#f0f1ed]"><X size={11} /></button>
              </> : <>
                <button onClick={() => { setRenaming(name); setRenameValue(name); setRenameFoodType(managed.foodType || '') }} title={`Rename ${name}`} className="rounded p-1 text-[#9b9f96] hover:bg-[#f0f1ed] hover:text-[#71786d]"><Settings2 size={11} /></button>
                <button disabled={busy} onClick={() => removeCategory(managed)} title={`Remove ${name}`} className="rounded p-1 text-[#c08b7e] hover:bg-[#fae9e5] hover:text-[#b75c48]"><X size={11} /></button>
              </>}
            </div>
            {isExpanded && <div className="relative ml-[18px] border-l-2 border-dashed border-[#e3e6de] pl-3">
              {/* Food type branch */}
              <div className="relative mt-2 rounded-lg border border-[#eceee8] bg-white p-2.5 before:absolute before:-left-[14px] before:top-1/2 before:h-px before:w-[12px] before:bg-[#e3e6de]">
                <p className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[1px] text-[#a6aa9f]"><Utensils size={10} />Food type</p>
                {renaming === name ? <p className="mt-1 text-[9px] text-[#9b9f96]">Edit it in the fields above, then save.</p> : <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="truncate text-[11px] font-semibold text-[#3d443a]">{managed.foodType || 'Not set'}</p>
                  <button onClick={() => { setRenaming(name); setRenameValue(name); setRenameFoodType(managed.foodType || '') }} className="shrink-0 text-[9px] font-semibold text-[#ac571d]">Edit</button>
                </div>}
                <p className="mt-1 text-[9px] text-[#9b9f96]">The kind of food this category covers — Beef, Chicken, Fish, or anything.</p>
              </div>
              {/* Expenses branch */}
              <div className="relative mb-2 mt-1.5 rounded-lg border border-[#eceee8] bg-white p-2.5 before:absolute before:-left-[14px] before:top-1/2 before:h-px before:w-[12px] before:bg-[#e3e6de]">
                <p className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[1px] text-[#a6aa9f]"><Wallet size={10} />Expenses</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-[#3d443a]">{money(expenseDetail?.category._id === managed._id ? expenseDetail.data.total : total?.total || 0)} <span className="font-normal text-[#9b9f96]">· {expenseDetail?.category._id === managed._id ? expenseDetail.data.count : total?.count || 0} records</span></p>
                  <button onClick={() => { setRecordFor(managed); setRecordForm({ amount: '', note: '' }) }} className="shrink-0 text-[9px] font-semibold text-[#ac571d]">+ Record</button>
                </div>
                {expenseDetail?.category._id === managed._id && expenseDetail.data.expenses.length > 0 && <ul className="mt-1.5 max-h-28 space-y-1 overflow-y-auto border-t border-dashed border-[#ebede7] pt-1.5">
                  {expenseDetail.data.expenses.slice(0, 5).map(expense => <li key={expense._id} className="flex items-center justify-between gap-2 text-[9px]">
                    <span className="min-w-0 truncate text-[#555e51]">{expense.note || expenseTime(expense)}{expense.recordedBy ? ` · ${expense.recordedBy}` : ''}</span>
                    <span className="flex shrink-0 items-center gap-1"><b className="text-[#7a431f]">{money(expense.amount)}</b><button disabled={busy} onClick={() => deleteExpense(managed, expense._id)} className="rounded p-0.5 text-[#c08b7e] hover:bg-[#fae9e5] hover:text-[#b75c48]"><Trash2 size={9} /></button></span>
                  </li>)}
                </ul>}
              </div>
            </div>}
          </li>
        })}</ul>
        {allCategoryNames.length === 0 && <p className="mt-3 rounded-lg border border-dashed border-[#e6e9e1] bg-white px-3 py-4 text-center text-[10px] text-[#9b9f96]">No categories yet — add your first one above (e.g. Grills with food type Beef), then click it to set its food type and record expenses.</p>}
        {categoryError && <p className="mt-2 text-[10px] text-[#b75c48]">{categoryError}</p>}
      </div>}
    </div>
    {recordFor && <Modal title={`Record expense — ${recordFor.name}`} onClose={() => setRecordFor(null)}>
      <form className="space-y-3.5" onSubmit={recordExpense}>
        <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#737a70]">Amount (UGX)</span><input autoFocus required type="number" min="1" step="1" value={recordForm.amount} onChange={event => setRecordForm({ ...recordForm, amount: event.target.value })} className="w-full rounded-lg border border-[#e6e9e1] bg-white px-3 py-2.5 text-[12px]" /></label>
        <label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-[#737a70]">Note <span className="font-normal text-[#a0a49b]">(optional)</span></span><input maxLength="200" value={recordForm.note} onChange={event => setRecordForm({ ...recordForm, note: event.target.value })} placeholder="e.g. charcoal for the grill" className="w-full rounded-lg border border-[#e6e9e1] bg-white px-3 py-2.5 text-[12px]" /></label>
        <button disabled={busy} className="w-full rounded-lg bg-[#c65d1b] py-2.5 text-[11px] font-semibold text-white disabled:opacity-60">Save expense</button>
      </form>
    </Modal>}
  </div>
}

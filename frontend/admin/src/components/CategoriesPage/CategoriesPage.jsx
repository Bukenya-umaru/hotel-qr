import { useEffect, useState } from 'react'
import {
  Check, ChevronRight, Plus, Settings2, Utensils, Wallet, X,
} from 'lucide-react'
import { api } from '../../lib/api.js'

// The independent Categories page. Clicking "Categories" in the sidebar
// lands here and shows only the two subsections — Food type and Expenses —
// each opening its own workspace.
export function CategoriesPage({ initialView = 'menu' }) {
  const [view, setView] = useState(initialView) // 'menu' | 'foodtype' | 'expenses'
  const [categories, setCategories] = useState([])
  const [expenseCategoryCount, setExpenseCategoryCount] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const categoryData = await api('/api/owner/categories')
      setCategories(categoryData.categories)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  const loadExpenseCategoryCount = async () => {
    try {
      const data = await api('/api/owner/expense-categories')
      setExpenseCategoryCount(data.categories.length)
    } catch {
      // Count on the card is a nice-to-have.
    }
  }

  useEffect(() => { load(); loadExpenseCategoryCount() }, [])
  // Follow sidebar navigation between the Food type and Expenses subsections.
  useEffect(() => { setView(initialView) }, [initialView])

  const SUBSECTIONS = [
    {
      key: 'foodtype',
      icon: Utensils,
      title: 'Food type',
      description: 'Add the categories of food types you serve.',
      stat: `${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}`,
    },
    {
      key: 'expenses',
      icon: Wallet,
      title: 'Expenses',
      description: 'Add the expense categories you want to track.',
      stat: `${expenseCategoryCount} categor${expenseCategoryCount === 1 ? 'y' : 'ies'}`,
    },
  ]

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-bold">Categories</h2>
        <p className="mt-1 text-[12px] text-[#8d9389]">{view === 'menu'
          ? 'Choose a subsection to work in.'
          : view === 'foodtype'
            ? 'Add the categories of food types you serve.'
            : 'Record expenses under the category they belong to.'}</p>
      </div>
    </div>
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-[#fae9e5] px-3 py-2.5 text-[11px] text-[#a44f3d]"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}

    {view === 'menu' && <div className="grid gap-3 sm:grid-cols-2">
      {SUBSECTIONS.map(({ key, icon: Icon, title, description, stat }) => <button key={key} onClick={() => setView(key)} className="group flex flex-col items-start gap-2 rounded-2xl border border-[#eceee8] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#dca875] hover:shadow-md">
        <span className="grid size-10 place-items-center rounded-xl bg-[#fff1e6] text-[#c65d1b]"><Icon size={19} /></span>
        <span className="flex items-center gap-1 text-[13px] font-bold text-[#293128]">{title}<ChevronRight size={14} className="text-[#a6aa9f] transition-transform group-hover:translate-x-0.5" /></span>
        <span className="text-[10px] leading-4 text-[#8d9389]">{description}</span>
        <span className="mt-1 rounded-full bg-[#f4f4f0] px-2 py-0.5 text-[9px] font-semibold text-[#757c71]">{stat}</span>
      </button>)}
    </div>}

    {view === 'foodtype' && <FoodTypeView
      categories={categories}
      busy={busy} setBusy={setBusy} onError={setError}
      reload={load}
    />}

    {view === 'expenses' && <ExpensesView
      busy={busy} setBusy={setBusy} onError={setError}
    />}
  </div>
}

// ---- Subsection: Food type — add food-type categories and see them here ----

function FoodTypeView({ categories, busy, setBusy, onError, reload }) {
  const [showForm, setShowForm] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [newFoodType, setNewFoodType] = useState('')
  const [renaming, setRenaming] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameFoodType, setRenameFoodType] = useState('')

  const addCategory = async event => {
    event.preventDefault()
    const name = newCategory.trim()
    if (!name) return
    if (categories.some(category => category.name.toLowerCase() === name.toLowerCase())) {
      onError('That category already exists.')
      return
    }
    setBusy(true)
    try {
      await api('/api/owner/categories', { method: 'POST', body: JSON.stringify({ name, foodType: newFoodType.trim() }) })
      setNewCategory('')
      setNewFoodType('')
      setShowForm(false)
      onError('')
      await reload()
    } catch (err) {
      onError(err.message)
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
      onError('')
      await reload()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const removeCategory = async category => {
    if (!window.confirm(`Remove the "${category.name}" category? Its expenses are deleted too; dishes keep their category but it will no longer be a managed category.`)) return
    setBusy(true)
    try {
      await api(`/api/owner/categories/${category._id}`, { method: 'DELETE' })
      onError('')
      await reload()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return <div className="rounded-xl border border-[#eceee8] bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[11px] font-bold text-[#3d443a]">Food type categories</p>
      <button onClick={() => setShowForm(previous => !previous)} className="flex items-center gap-1.5 rounded-lg bg-[#c65d1b] px-3 py-2 text-[10px] font-semibold text-white"><Plus size={13} />Add</button>
    </div>
    {showForm && <form onSubmit={addCategory} className="mt-3 flex flex-wrap gap-2 rounded-lg border border-dashed border-[#dca875] bg-[#fff6ef] p-3">
      <input autoFocus value={newCategory} onChange={event => setNewCategory(event.target.value)} maxLength="60" placeholder="Category name, e.g. Grills" className="min-w-0 flex-1 rounded-lg border border-[#e6e9e1] bg-white px-3 py-2 text-[11px]" />
      <input value={newFoodType} onChange={event => setNewFoodType(event.target.value)} maxLength="60" placeholder="Food type, e.g. Beef" className="min-w-0 flex-1 rounded-lg border border-[#e6e9e1] bg-white px-3 py-2 text-[11px]" />
      <button disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-[#c65d1b] px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-60"><Plus size={13} />Save</button>
      <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-[#eceee8] px-3 py-2 text-[10px] font-semibold text-[#747b70]">Cancel</button>
    </form>}
    <ul className="mt-3 space-y-1">{categories.map(category => <li key={category._id} className="rounded-lg border border-[#eceee8] bg-[#fafbf8]">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5">
        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-[#3d443a]">{category.name}</span>
        {category.foodType && <span className="shrink-0 rounded bg-[#fff1e6] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[.6px] text-[#a34b16]">{category.foodType}</span>}
        {renaming === category.name ? <>
          <input autoFocus value={renameValue} onChange={event => setRenameValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') renameCategory(); if (event.key === 'Escape') setRenaming(null) }} maxLength="60" className="w-28 rounded border border-[#dca875] px-1.5 py-0.5 text-[10px]" />
          <input value={renameFoodType} onChange={event => setRenameFoodType(event.target.value)} maxLength="60" placeholder="Food type" className="w-24 rounded border border-[#dca875] px-1.5 py-0.5 text-[10px]" />
          <button disabled={busy} onClick={renameCategory} className="rounded p-1 text-[#a34b16] hover:bg-[#fff1e6]"><Check size={11} /></button>
          <button onClick={() => setRenaming(null)} className="rounded p-1 text-[#9b9f96] hover:bg-[#f0f1ed]"><X size={11} /></button>
        </> : <>
          <button onClick={() => { setRenaming(category.name); setRenameValue(category.name); setRenameFoodType(category.foodType || '') }} title={`Edit ${category.name}`} className="rounded p-1 text-[#9b9f96] hover:bg-[#f0f1ed] hover:text-[#71786d]"><Settings2 size={11} /></button>
          <button disabled={busy} onClick={() => removeCategory(category)} title={`Remove ${category.name}`} className="rounded p-1 text-[#c08b7e] hover:bg-[#fae9e5] hover:text-[#b75c48]"><X size={11} /></button>
        </>}
      </div>
    </li>)}</ul>
    {!categories.length && !showForm && <p className="mt-3 rounded-lg border border-dashed border-[#e6e9e1] px-3 py-6 text-center text-[10px] text-[#9b9f96]">No food-type categories yet — click <b>Add</b> to create your first one.</p>}
  </div>
}

// ---- Subsection: Expenses — add name-only expense categories ----

function ExpensesView({ busy, setBusy, onError }) {
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [categories, setCategories] = useState([])
  const [renaming, setRenaming] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  const load = async () => {
    try {
      const data = await api('/api/owner/expense-categories')
      setCategories(data.categories)
    } catch (err) {
      onError(err.message)
    }
  }
  useEffect(() => { load() }, [])

  const addCategory = async event => {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    if (categories.some(category => category.name.toLowerCase() === name.toLowerCase())) {
      onError('That expense category already exists.')
      return
    }
    setBusy(true)
    try {
      await api('/api/owner/expense-categories', { method: 'POST', body: JSON.stringify({ name }) })
      setNewName('')
      setShowForm(false)
      onError('')
      await load()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const renameCategory = async () => {
    const name = renameValue.trim()
    if (!renaming || !name) return
    setBusy(true)
    try {
      await api(`/api/owner/expense-categories/${renaming._id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
      setRenaming(null)
      onError('')
      await load()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const removeCategory = async category => {
    if (!window.confirm(`Remove the "${category.name}" expense category?`)) return
    setBusy(true)
    try {
      await api(`/api/owner/expense-categories/${category._id}`, { method: 'DELETE' })
      onError('')
      await load()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return <div className="rounded-xl border border-[#eceee8] bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[11px] font-bold text-[#3d443a]">Expense categories</p>
      <button onClick={() => setShowForm(previous => !previous)} className="flex items-center gap-1.5 rounded-lg bg-[#c65d1b] px-3 py-2 text-[10px] font-semibold text-white"><Plus size={13} />Add</button>
    </div>
    {showForm && <form onSubmit={addCategory} className="mt-3 flex flex-wrap gap-2 rounded-lg border border-dashed border-[#dca875] bg-[#fff6ef] p-3">
      <input autoFocus value={newName} onChange={event => setNewName(event.target.value)} maxLength="60" placeholder="Expense category name, e.g. Cooking gas" className="min-w-0 flex-1 rounded-lg border border-[#e6e9e1] bg-white px-3 py-2 text-[11px]" />
      <button disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-[#c65d1b] px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-60"><Plus size={13} />Save</button>
      <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-[#eceee8] bg-white px-3 py-2 text-[10px] font-semibold text-[#747b70]">Cancel</button>
    </form>}
    <ul className="mt-3 space-y-1">{categories.map(category => <li key={category._id} className="rounded-lg border border-[#eceee8] bg-[#fafbf8]">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5">
        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-[#3d443a]">{category.name}</span>
        {renaming === category.name ? <>
          <input autoFocus value={renameValue} onChange={event => setRenameValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') renameCategory(); if (event.key === 'Escape') setRenaming(null) }} maxLength="60" className="w-32 rounded border border-[#dca875] px-1.5 py-0.5 text-[10px]" />
          <button disabled={busy} onClick={renameCategory} className="rounded p-1 text-[#a34b16] hover:bg-[#fff1e6]"><Check size={11} /></button>
          <button onClick={() => setRenaming(null)} className="rounded p-1 text-[#9b9f96] hover:bg-[#f0f1ed]"><X size={11} /></button>
        </> : <>
          <button onClick={() => { setRenaming(category.name); setRenameValue(category.name) }} title={`Edit ${category.name}`} className="rounded p-1 text-[#9b9f96] hover:bg-[#f0f1ed] hover:text-[#71786d]"><Settings2 size={11} /></button>
          <button disabled={busy} onClick={() => removeCategory(category)} title={`Remove ${category.name}`} className="rounded p-1 text-[#c08b7e] hover:bg-[#fae9e5] hover:text-[#b75c48]"><X size={11} /></button>
        </>}
      </div>
    </li>)}</ul>
    {!categories.length && !showForm && <p className="mt-3 rounded-lg border border-dashed border-[#e6e9e1] px-3 py-6 text-center text-[10px] text-[#9b9f96]">No expense categories yet — click <b>Add</b> to create your first one.</p>}
  </div>
}

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
  const [newCategory, setNewCategory] = useState('')
  const [renaming, setRenaming] = useState(null)
  const [renameValue, setRenameValue] = useState('')

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
      await api('/api/owner/categories', { method: 'POST', body: JSON.stringify({ name }) })
      setNewCategory('')
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
      await api(`/api/owner/categories/${renaming}`, { method: 'PATCH', body: JSON.stringify({ name }) })
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
      <p className="flex items-center gap-2 text-[11px] font-bold text-[#3d443a]">Food type categories
        <span className="rounded-full bg-[#f4f4f0] px-2 py-0.5 text-[9px] font-semibold text-[#757c71]">{categories.length}</span>
      </p>
    </div>
    <form onSubmit={addCategory} className="mt-3 flex w-full max-w-sm items-center gap-2">
      <input autoFocus value={newCategory} onChange={event => setNewCategory(event.target.value)} maxLength="60" placeholder="Category name, e.g. Grills" aria-label="New food type category name" className="min-w-0 flex-1 rounded-lg border border-[#e6e9e1] bg-white px-3 py-2 text-[11px] outline-none focus:border-[#dca875] focus:ring-2 focus:ring-[#fff1e6]" />
      <button disabled={busy || !newCategory.trim()} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#c65d1b] px-3 py-2 text-[10px] font-semibold text-white hover:bg-[#a34b16] disabled:cursor-not-allowed disabled:opacity-50"><Plus size={13} />Add</button>
    </form>
    {categories.length > 0 && <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{categories.map(category => <li key={category._id} className="group flex min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-[#eceee8] bg-[#fafbf8] px-2 py-3 text-center transition hover:border-[#dca875] hover:bg-[#fff6ef]">
      {renaming === category._id ? <>
        <input autoFocus value={renameValue} onChange={event => setRenameValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') renameCategory(); if (event.key === 'Escape') setRenaming(null) }} maxLength="60" aria-label={`Rename ${category.name}`} className="w-full min-w-0 rounded-md border border-[#dca875] bg-white px-1.5 py-1 text-center text-[10px] outline-none" />
        <span className="flex items-center gap-1">
          <button disabled={busy} onClick={renameCategory} title="Save name" className="rounded-md p-1 text-[#a34b16] hover:bg-[#fff1e6]"><Check size={12} /></button>
          <button onClick={() => setRenaming(null)} title="Cancel" className="rounded-md p-1 text-[#9b9f96] hover:bg-[#f0f1ed]"><X size={12} /></button>
        </span>
      </> : <>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#fff1e6] text-[#c65d1b]"><Utensils size={15} /></span>
        <span className="w-full break-words text-[10px] font-semibold leading-[13px] text-[#3d443a]">{category.name}</span>
        {category.foodType && <span className="w-full truncate rounded bg-[#ffe9d8] px-1 py-0.5 text-[7px] font-semibold uppercase tracking-[.6px] text-[#a34b16]">{category.foodType}</span>}
        <span className="flex items-center gap-0.5">
          <button onClick={() => { setRenaming(category._id); setRenameValue(category.name) }} title={`Edit ${category.name}`} className="rounded-md p-1 text-[#9b9f96] hover:bg-white hover:text-[#71786d]"><Settings2 size={12} /></button>
          <button disabled={busy} onClick={() => removeCategory(category)} title={`Remove ${category.name}`} className="rounded-md p-1 text-[#c08b7e] hover:bg-[#fae9e5] hover:text-[#b75c48]"><X size={12} /></button>
        </span>
      </>}
    </li>)}</ul>}
    {!categories.length && <p className="mt-3 rounded-xl border border-dashed border-[#e6e9e1] px-3 py-6 text-center text-[10px] text-[#9b9f96]">No food-type categories yet — add your first one above.</p>}
  </div>
}

// ---- Subsection: Expenses — add name-only expense categories ----

function ExpensesView({ busy, setBusy, onError }) {
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
      await api(`/api/owner/expense-categories/${renaming}`, { method: 'PATCH', body: JSON.stringify({ name }) })
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
      <p className="flex items-center gap-2 text-[11px] font-bold text-[#3d443a]">Expense categories
        <span className="rounded-full bg-[#f4f4f0] px-2 py-0.5 text-[9px] font-semibold text-[#757c71]">{categories.length}</span>
      </p>
    </div>
    <form onSubmit={addCategory} className="mt-3 flex w-full max-w-sm items-center gap-2">
      <input autoFocus value={newName} onChange={event => setNewName(event.target.value)} maxLength="60" placeholder="Category name, e.g. Cooking gas" aria-label="New expense category name" className="min-w-0 flex-1 rounded-lg border border-[#e6e9e1] bg-white px-3 py-2 text-[11px] outline-none focus:border-[#dca875] focus:ring-2 focus:ring-[#fff1e6]" />
      <button disabled={busy || !newName.trim()} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#c65d1b] px-3 py-2 text-[10px] font-semibold text-white hover:bg-[#a34b16] disabled:cursor-not-allowed disabled:opacity-50"><Plus size={13} />Add</button>
    </form>
    {categories.length > 0 && <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{categories.map(category => <li key={category._id} className="group flex min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-[#eceee8] bg-[#fafbf8] px-2 py-3 text-center transition hover:border-[#dca875] hover:bg-[#fff6ef]">
      {renaming === category._id ? <>
        <input autoFocus value={renameValue} onChange={event => setRenameValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') renameCategory(); if (event.key === 'Escape') setRenaming(null) }} maxLength="60" aria-label={`Rename ${category.name}`} className="w-full min-w-0 rounded-md border border-[#dca875] bg-white px-1.5 py-1 text-center text-[10px] outline-none" />
        <span className="flex items-center gap-1">
          <button disabled={busy} onClick={renameCategory} title="Save name" className="rounded-md p-1 text-[#a34b16] hover:bg-[#fff1e6]"><Check size={12} /></button>
          <button onClick={() => setRenaming(null)} title="Cancel" className="rounded-md p-1 text-[#9b9f96] hover:bg-[#f0f1ed]"><X size={12} /></button>
        </span>
      </> : <>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#fff1e6] text-[#c65d1b]"><Wallet size={15} /></span>
        <span className="w-full break-words text-[10px] font-semibold leading-[13px] text-[#3d443a]">{category.name}</span>
        <span className="flex items-center gap-0.5">
          <button onClick={() => { setRenaming(category._id); setRenameValue(category.name) }} title={`Edit ${category.name}`} className="rounded-md p-1 text-[#9b9f96] hover:bg-white hover:text-[#71786d]"><Settings2 size={12} /></button>
          <button disabled={busy} onClick={() => removeCategory(category)} title={`Remove ${category.name}`} className="rounded-md p-1 text-[#c08b7e] hover:bg-[#fae9e5] hover:text-[#b75c48]"><X size={12} /></button>
        </span>
      </>}
    </li>)}</ul>}
    {!categories.length && <p className="mt-3 rounded-xl border border-dashed border-[#e6e9e1] px-3 py-6 text-center text-[10px] text-[#9b9f96]">No expense categories yet — add your first one above.</p>}
  </div>
}

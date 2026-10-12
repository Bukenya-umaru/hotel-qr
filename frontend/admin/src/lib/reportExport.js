// Report export: builds a fully-styled report document from the analytics
// data the Reports page already holds and lets the user save it to their
// device. PDF uses the browser's built-in "Save as PDF" (no extra
// dependencies), CSV writes the raw records as a spreadsheet-friendly file.

import { money } from './ui.js'

const escapeHtml = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const formatDateTime = value => value
  ? new Date(value).toLocaleString('en-UG', { dateStyle: 'medium', timeStyle: 'short' })
  : '—'

// Printable period label, e.g. "1 Jan 2026 – 7 Jan 2026".
const periodLabel = (from, to) => {
  const options = { day: 'numeric', month: 'short', year: 'numeric' }
  const start = from ? new Date(`${String(from).slice(0, 10)}T12:00:00`) : null
  const end = to ? new Date(`${String(to).slice(0, 10)}T12:00:00`) : null
  if (start && end) return `${start.toLocaleDateString('en-UG', options)} – ${end.toLocaleDateString('en-UG', options)}`
  if (start) return start.toLocaleDateString('en-UG', options)
  return 'All time'
}

const saleRow = sale => ({
  id: sale.saleId || '—',
  name: sale.name || 'Food sale',
  customer: sale.customerName || '—',
  recorded: sale.createdAt ? formatDateTime(sale.createdAt) : '—',
  amount: sale.amount || 0,
})

const expenseRow = expense => ({
  id: '—',
  category: expense.categoryName || 'Expense',
  note: expense.note || '—',
  recorded: expense.createdAt ? formatDateTime(expense.createdAt) : '—',
  amount: expense.amount || 0,
})

/* ------------------------------------------------------------------ */
/* Summary cards (top of the PDF)                                      */
/* ------------------------------------------------------------------ */

const summaryCards = (analytics, currency) => {
  const cards = [
    { label: 'Food sales', value: money(analytics.totalRevenue, currency), count: `${analytics.totalSalesCount || 0} records` },
    { label: 'Expenses', value: money(analytics.totalExpenses, currency), count: `${analytics.totalExpensesCount || 0} records` },
    { label: 'Net balance', value: money(analytics.netBalance ?? 0, currency), count: 'Sales − expenses' },
    { label: 'Damage losses', value: money(analytics.totalDamages || 0, currency), count: `${(analytics.damages || []).length} records` },
  ]
  return cards.map(card => `
    <div class="summary-card">
      <p class="summary-label">${escapeHtml(card.label)}</p>
      <p class="summary-value">${escapeHtml(card.value)}</p>
      <p class="summary-count">${escapeHtml(card.count)}</p>
    </div>`).join('')
}

/* ------------------------------------------------------------------ */
/* Record tables                                                       */
/* ------------------------------------------------------------------ */

const table = (title, subtitle, headers, rows, currency, emptyText) => {
  const body = rows.length
    ? rows.map(row => `
      <tr>
        ${Object.values(row).map((cell, index) => {
          const isLast = index === Object.values(row).length - 1
          const value = typeof cell === 'number' ? money(cell, currency) : escapeHtml(cell)
          return `<td class="${isLast ? 'amount' : ''}">${value}</td>`
        }).join('')}
      </tr>`).join('')
    : `<tr><td class="empty" colspan="${headers.length}">${escapeHtml(emptyText)}</td></tr>`
  return `
    <section class="table-block">
      <div class="table-head">
        <h2>${escapeHtml(title)}</h2>
        <span>${escapeHtml(subtitle)}</span>
      </div>
      <table>
        <thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </section>`
}

/* ------------------------------------------------------------------ */
/* Document                                                            */
/* ------------------------------------------------------------------ */

const buildDocument = ({ analytics, currency, from, to, hotelName }) => {
  const sales = (analytics.sales || []).map(saleRow)
  const expenses = (analytics.expenses || []).map(expenseRow)
  const generated = new Date().toLocaleString('en-UG', { dateStyle: 'medium', timeStyle: 'short' })
  const sameDay = from && to && String(from).slice(0, 10) === String(to).slice(0, 10)
  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(hotelName)} — Report ${escapeHtml(periodLabel(from, to))}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: "DM Sans", "Segoe UI", Arial, sans-serif; color: #292421; background: #fff }
  .page { max-width: 780px; margin: 0 auto; padding: 28px 32px 18px }

  /* Header */
  .brand-row { display: flex; align-items: center; justify-content: space-between; gap: 16px }
  .brand { display: flex; align-items: center; gap: 10px }
  .brand-mark { width: 34px; height: 34px; border-radius: 10px; background: #e7654b; color: #fff;
    display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; letter-spacing: .5px }
  .brand-name { font-size: 17px; font-weight: 800; letter-spacing: -.2px }
  .brand-sub { font-size: 9.5px; color: #a19690; margin-top: 1px }
  .report-tag { text-align: right }
  .report-tag .tag { display: inline-block; padding: 4px 10px; border: 1px solid #eee4df; border-radius: 999px;
    font-size: 9px; font-weight: 700; letter-spacing: 1.2px; color: #d95c43 }
  .report-tag .period { margin-top: 4px; font-size: 10.5px; color: #655a54; font-weight: 600 }

  .rule { height: 1px; background: #eee4df; margin: 16px 0 18px }

  /* Summary cards */
  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px }
  .summary-card { border: 1px solid #eee4df; border-radius: 10px; padding: 12px 14px }
  .summary-label { font-size: 9px; font-weight: 700; letter-spacing: 1.1px; text-transform: uppercase; color: #a19690 }
  .summary-value { margin-top: 4px; font-size: 17px; font-weight: 800; letter-spacing: -.3px }
  .summary-count { margin-top: 3px; font-size: 9.5px; color: #8d817b }

  /* Tables */
  .table-block { margin-top: 20px; page-break-inside: avoid }
  .table-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px }
  .table-head h2 { font-size: 13px; font-weight: 800; letter-spacing: -.2px }
  .table-head span { font-size: 9.5px; color: #a19690 }
  table { width: 100%; border-collapse: collapse }
  th { text-align: left; font-size: 8.5px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
    color: #a19690; border-bottom: 1px solid #eee4df; padding: 6px 8px }
  td { font-size: 10.5px; padding: 7px 8px; border-bottom: 1px solid #f5efeb; vertical-align: top }
  tr:nth-child(even) td { background: #fbf8f6 }
  td.amount { text-align: right; font-weight: 700; white-space: nowrap }
  th.amount, th:last-child { text-align: right }
  td.empty { text-align: center; color: #a19690; padding: 18px 8px; font-size: 10px; background: #fbf8f6 }

  /* Footer */
  .footer { margin-top: 26px; padding-top: 12px; border-top: 1px solid #eee4df;
    display: flex; align-items: center; justify-content: space-between; gap: 12px }
  .footer .generated { font-size: 9px; color: #a19690 }
  .footer .credit { font-size: 9.5px; color: #8d817b; font-weight: 600; white-space: nowrap }
  .footer .credit strong { color: #d95c43; font-weight: 800 }

  @page { margin: 12mm }
  @media print {
    body { background: #fff }
    .page { max-width: none; padding: 0 }
  }
</style>
</head>
<body>
  <div class="page">
    <header class="brand-row">
      <div class="brand">
        <div class="brand-mark">W</div>
        <div>
          <p class="brand-name">${escapeHtml(hotelName)}</p>
          <p class="brand-sub">Business report — generated ${escapeHtml(generated)}</p>
        </div>
      </div>
      <div class="report-tag">
        <span class="tag">SALES &amp; EXPENSES</span>
        <p class="period">${escapeHtml(periodLabel(from, to))}${sameDay ? ' · single day' : ''}</p>
      </div>
    </header>

    <div class="rule"></div>

    <div class="summary">${summaryCards(analytics, currency)}</div>

    ${table(
      'Recorded Sales',
      `${sales.length} record${sales.length === 1 ? '' : 's'} in this period`,
      ['Receipt', 'Item / summary', 'Customer', 'Recorded', 'Amount'],
      sales.slice(0, 200).map(sale => ({ 'Receipt': sale.id, 'Item / summary': sale.name, 'Customer': sale.customer, 'Recorded': sale.recorded, 'Amount': sale.amount })),
      currency,
      'No sales recorded in this period.',
    )}

    ${table(
      'Recorded Expenses',
      `${expenses.length} record${expenses.length === 1 ? '' : 's'} in this period`,
      ['Category', 'Note', 'Recorded', 'Amount'],
      expenses.slice(0, 200).map(expense => ({ 'Category': expense.category, 'Note': expense.note, 'Recorded': expense.recorded, 'Amount': expense.amount })),
      currency,
      'No expenses recorded in this period.',
    )}

    ${table(
      'Recorded Damage',
      `${(analytics.damages || []).length} record${(analytics.damages || []).length === 1 ? '' : 's'} in this period`,
      ['Item', 'Quantity', 'Note', 'Recorded', 'Value'],
      (analytics.damages || []).slice(0, 100).map(damage => ({
        'Item': damage.name || 'Damage',
        'Quantity': `${damage.quantity ?? 1} ${damage.unit || 'units'}`,
        'Note': damage.note || '—',
        'Recorded': damage.createdAt ? formatDateTime(damage.createdAt) : '—',
        'Value': damage.value || 0,
      })),
      currency,
      'No damage recorded in this period.',
    )}

    <footer class="footer">
      <p class="generated">Generated from WAGA BITES dashboard data · figures in ${escapeHtml(currency)}</p>
      <p class="credit">Developed by <strong>Bukcode</strong></p>
    </footer>
  </div>
</body>
</html>`
}

/* ------------------------------------------------------------------ */
/* Device-facing helpers                                               */
/* ------------------------------------------------------------------ */

// Opens the report in a hidden iframe and triggers the browser's print
// dialog, which offers "Save as PDF" on Windows, macOS, Android and iOS —
// the file lands in the user's Downloads (or chosen) folder. `srcdoc` is
// used so the load event is deterministic: a blank iframe can finish
// loading before the handler is attached, which would skip the print.
export function downloadReportPdf({ analytics, currency, from, to, hotelName }) {
  const html = buildDocument({ analytics, currency, from, to, hotelName })
  const iframe = document.createElement('iframe')
  iframe.title = 'Report export preview'
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.visibility = 'hidden'
  iframe.srcdoc = html
  const cleanup = () => setTimeout(() => iframe.remove(), 800)
  iframe.onload = () => {
    try {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
    } finally {
      cleanup()
    }
  }
  document.body.appendChild(iframe)
}

// CSV of the raw records, saved straight to the user's device via a
// temporary object URL + download anchor.
export function downloadReportCsv({ analytics, currency, from, to }) {
  const lines = ['Type,Reference,Description,Customer,Recorded,Amount']
  const push = cells => lines.push(cells.map(cell => {
    const value = String(cell ?? '')
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  }).join(','))
  for (const sale of analytics.sales || []) {
    push(['Sale', sale.saleId || '', sale.name || 'Food sale', sale.customerName || '', sale.createdAt ? formatDateTime(sale.createdAt) : '', sale.amount ?? 0])
  }
  for (const expense of analytics.expenses || []) {
    push(['Expense', '', `${expense.categoryName || 'Expense'}${expense.note ? ` — ${expense.note}` : ''}`, '', expense.createdAt ? formatDateTime(expense.createdAt) : '', expense.amount ?? 0])
  }
  for (const damage of analytics.damages || []) {
    push(['Damage', '', `${damage.name || 'Damage'}${damage.quantity ? ` — ${damage.quantity} ${damage.unit || 'units'}` : ''}${damage.note ? ` — ${damage.note}` : ''}`, '', damage.createdAt ? formatDateTime(damage.createdAt) : '', damage.value ?? 0])
  }
  const start = String(from || '').slice(0, 10)
  const end = String(to || '').slice(0, 10)
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `wagabites-report-${start || 'all'}_${end || 'time'}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return { sales: (analytics.sales || []).length, expenses: (analytics.expenses || []).length, currency }
}

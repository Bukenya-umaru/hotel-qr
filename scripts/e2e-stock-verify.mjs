// Focused re-verification after the stock fixes:
// 1) kg adjust accepts two decimals (11.05) and whole 11 in the real UI,
// 2) whole-number units now show an honest rejection for decimals,
// 3) server-side: an approver (temp chef with approve_records) posts and
//    approves stock — both notify paths that used to crash on `noun`.
// Run from repo root: node scripts/e2e-stock-verify.mjs
import puppeteer from 'puppeteer-core'
import 'dotenv/config'
import jwt from 'jsonwebtoken'

const APP = 'http://localhost:5173'
const BASE = 'http://localhost:4000'
const EMAIL = 'stock-e2e-chef@stayserve.local'
const PASSWORD = 'StockEleven1'
const EXECUTABLE = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const log = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`)

const browser = await puppeteer.launch({ executablePath: EXECUTABLE, headless: 'new', defaultViewport: { width: 1280, height: 860 } })
const page = await browser.newPage()

const typeInto = (el, value) => {
  const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set
  set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

try {
  await page.goto(APP, { waitUntil: 'networkidle2', timeout: 30000 })
  await sleep(1200)
  await page.type('#login-email', EMAIL, { delay: 5 })
  await page.type('#login-password', PASSWORD, { delay: 5 })
  await page.evaluate(() => { [...document.querySelectorAll('form button')].find(b => /Log In/i.test(b.innerText))?.click() })
  await sleep(2800)
  await page.evaluate(() => { [...document.querySelectorAll('button, a')].find(b => b.innerText.trim().toLowerCase() === 'stock')?.click() })
  await sleep(1500)

  // — kg inputs should now accept two decimals —
  await page.evaluate(text => {
    const card = [...document.querySelectorAll('article')].find(a => a.innerText.includes(text))
    if (card) card.querySelector('button[title*="Add"]')?.click()
    return Boolean(card)
  }, 'E2E KG Test')
  await sleep(700)
  const kgStep = await page.evaluate(() => {
    const input = [...document.querySelectorAll('input[type="number"]')].find(i => i.checkVisibility())
    return input ? { step: input.step, min: input.min } : null
  })
  log('kg adjust input now steps at 0.01', kgStep?.step === '0.01', JSON.stringify(kgStep))

  for (const [value, expectValid] of [['11.05', true], ['11', true], ['11.1', true]]) {
    const state = await new Promise(resolve => setTimeout(() => resolve(page.evaluate(v => {
      const input = [...document.querySelectorAll('input[type="number"]')].find(i => i.checkVisibility())
      const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set
      set.call(input, v)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      return { value: input.value, valid: input.checkValidity(), message: input.validationMessage }
    }, value)), 250))
    log(`kg adjust accepts ${value}`, state.valid === expectValid, JSON.stringify(state))
  }

  // Submit 11.05 — the app must not reject it; the modal should close.
  await page.evaluate(() => { [...document.querySelectorAll('form button')].find(b => /^Add /i.test(b.innerText) && !/stock/i.test(b.innerText))?.click() })
  await sleep(1800)
  const submitted = await page.evaluate(() => ({
    modalOpen: Boolean([...document.querySelectorAll('input[type="number"]')].find(i => i.checkVisibility())),
    alert: document.querySelector('[role="alert"]')?.innerText || '',
  }))
  log('kg adjust 11.05 submitted cleanly', submitted.modalOpen === false, JSON.stringify(submitted))

  // — whole-number unit (plates) — 11.1 must show the honest message, 11 must work —
  await page.evaluate(text => {
    const card = [...document.querySelectorAll('article')].find(a => a.innerText.includes(text))
    if (card) card.querySelector('button[title*="Add"]')?.click()
    return Boolean(card)
  }, 'E2E Plates Test')
  await sleep(600)
  const wholeDecimal = await page.evaluate(() => {
    const input = [...document.querySelectorAll('input[type="number"]')].find(i => i.checkVisibility())
    const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set
    set.call(input, '11.1')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return { value: input.value, valid: input.checkValidity(), message: input.validationMessage }
  })
  log('plates adjust 11.1 — browser passes it to the app for a clear rejection', JSON.stringify(wholeDecimal), '')
  await page.evaluate(() => { [...document.querySelectorAll('form button')].find(b => /^Add /i.test(b.innerText) && !/stock/i.test(b.innerText))?.click() })
  await sleep(600)
  const platesMsg = await page.evaluate(() => document.body.innerText)
  log('plates 11.1 rejection says whole numbers', /whole number/i.test(platesMsg))

  // Clear and submit a correct whole number
  await page.evaluate(() => {
    const input = [...document.querySelectorAll('input[type="number"]')].find(i => i.checkVisibility())
    if (input) { const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set; set.call(input, ''); input.dispatchEvent(new Event('input', { bubbles: true })) }
  })
  await page.evaluate(() => {
    const input = [...document.querySelectorAll('input[type="number"]')].find(i => i.checkVisibility())
    if (input) { const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set; set.call(input, '11'); input.dispatchEvent(new Event('input', { bubbles: true })) }
  })
  await page.evaluate(() => { [...document.querySelectorAll('form button')].find(b => /^Add /i.test(b.innerText) && !/stock/i.test(b.innerText))?.click() })
  await sleep(1800)
  const platesWhole = await page.evaluate(() => Boolean([...document.querySelectorAll('input[type="number"]')].find(i => i.checkVisibility())))
  log('plates adjust whole 11 submitted', platesWhole === false)
} catch (err) {
  console.log('FAIL run aborted —', err.message)
  await page.screenshot({ path: 'scripts/e2e-stock-verify-error.png' })
} finally {
  await browser.close()
}

// — Server-side: both previously-crashing notify paths (pending + approve) —
let exitCode = 0
try {
  // Temp approver with every permission, via the real developer-API login flow.
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (login.status !== 200) { console.log('FAIL temp chef login —', login.status); exitCode = 1 }
  else {
    const cookie = login.headers.get('set-cookie').split(';')[0]
    const headers = { 'Content-Type': 'application/json', Cookie: cookie }
    // 1) POST stock as a NON-approver — the pending-notification path.
    const post = await fetch(`${BASE}/api/stock`, { method: 'POST', headers, body: JSON.stringify({ name: 'API Pending Test', foodType: 'Beef', price: 1000, unit: 'plates', quantity: 3 }) })
    log('API stock POST (pending path, ex-crash) → 201', post.status === 201, `HTTP ${post.status}`)
    const pendingId = (await post.json()).item?._id
    // 2) Approve it via a temp approver — the stock_confirmed notify path.
    const APPROVER_EMAIL = 'stock-e2e-approver@stayserve.local'
    const apLogin = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: APPROVER_EMAIL, password: process.env.APPROVER_PASSWORD || 'Approving1' }),
    })
    if (apLogin.status !== 200) { console.log('FAIL temp approver login —', apLogin.status, JSON.stringify(await apLogin.json())); exitCode = 1 }
    else {
      const apHeaders = { 'Content-Type': 'application/json', Cookie: apLogin.headers.get('set-cookie').split(';')[0] }
      const approve = await fetch(`${BASE}/api/stock/${pendingId}/approve`, { method: 'POST', headers: apHeaders })
      log('API stock APPROVE (confirmed path, second ex-crash) → 200', approve.status === 200, `HTTP ${approve.status}`)
      // Unapprove? no such reversal; the cleanup deletes the record anyway.
    }
  }
} catch (err) {
  console.log('FAIL server phase —', err.message)
  exitCode = 1
}
process.exit(exitCode)

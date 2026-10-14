// Reproduces the stock number-entry complaints on the real UI:
// 1) create a KG stock entry typing whole number 11,
// 2) adjust it with 11 (add), 11.1 (add), and a plates-style rejection test,
// capturing every browser validation message and app error shown.
// Cleans up any stock entries it creates. Run from repo root:
// node scripts/e2e-stock.mjs
import puppeteer from 'puppeteer-core'

const APP = 'http://localhost:5173'
const EMAIL = 'stock-e2e-chef@stayserve.local'
const PASSWORD = 'StockEleven1'
const EXECUTABLE = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const log = (name, ok, detail = '') => console.log(`${ok ? 'INFO' : 'NOTE'} ${name}${detail ? ' — ' + detail : ''}`)

const browser = await puppeteer.launch({
  executablePath: EXECUTABLE,
  headless: 'new',
  defaultViewport: { width: 1280, height: 860 },
})
const page = await browser.newPage()
const created = []

try {
  // Sign in
  await page.goto(APP, { waitUntil: 'networkidle2', timeout: 30000 })
  await sleep(1000)
  await page.type('#login-email', EMAIL, { delay: 5 })
  await page.type('#login-password', PASSWORD, { delay: 5 })
  await page.evaluate(() => { [...document.querySelectorAll('form button')].find(b => /Log In/i.test(b.innerText)).click() })
  await sleep(2500)

  // Open Stock page from the sidebar
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button, a')]
    const target = buttons.find(b => b.innerText.trim().toLowerCase() === 'stock')
    if (target) target.click()
    return Boolean(target)
  })
  await sleep(1500)
  log('stock page reached', (await page.evaluate(() => document.body.innerText)).includes('Kitchen stock'))

  // Open the Add stock form
  await page.evaluate(() => { [...document.querySelectorAll('button')].find(b => /Add stock/i.test(b.innerText))?.click() })
  await sleep(800)

  // Choose a food type (first real option) and check the list is populated
  const choseType = await page.evaluate(() => {
    const select = [...document.querySelectorAll('select')].find(s => /food type/i.test(s.parentElement.innerText))
    if (!select || select.options.length < 2) return false
    select.selectedIndex = 1
    select.dispatchEvent(new Event('change', { bubbles: true }))
    return select.options[1].value
  })
  log('food type chosen', choseType !== false, String(choseType))

  // Pick the Weight (KG) unit
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Weight (KG)')
    if (button) button.click()
    return Boolean(button)
  })
  await sleep(300)

  // Fill price, quantity 11 (typed), and a unique name
  await page.evaluate(() => {
    const price = [...document.querySelectorAll('input')].find(i => /Price per/.test(i.closest('label')?.innerText || ''))
    const qty = [...document.querySelectorAll('input')].find(i => /Number of/.test(i.closest('label')?.innerText || ''))
    const name = [...document.querySelectorAll('input')].find(i => /Stock name/.test(i.closest('label')?.innerText || ''))
    const setter = el => {
      const proto = Object.getPrototypeOf(el)
      const set = Object.getOwnPropertyDescriptor(proto, 'value').set
      return value => { set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })) }
    }
    setter(price)('5000')
    setter(qty)('11')
    setter(name)('E2E KG Test')
    return true
  })
  await sleep(200)

  // Read native validation state right before submit (the "11.1" bubble lives here)
  const validity = await page.evaluate(() => {
    const qty = [...document.querySelectorAll('input')].find(i => /Number of/.test(i.closest('label')?.innerText || ''))
    return { value: qty.value, valid: qty.checkValidity(), message: qty.validationMessage, step: qty.step, min: qty.min }
  })
  log('quantity field validity (kg, typed 11)', validity.value === '11', JSON.stringify(validity))

  // Submit and see if the form closes or shows an error
  await page.evaluate(() => { [...document.querySelectorAll('form button')].find(b => /^Add stock$/i.test(b.innerText))?.click() })
  await sleep(2500)
  const afterSubmit = await page.evaluate(() => {
    const qty = [...document.querySelectorAll('input')].find(i => /Number of/.test(i.closest('label')?.innerText || ''))
    return { modalOpen: Boolean(qty), qtyMessage: qty?.validationMessage || '', alert: document.querySelector('[role="alert"]')?.innerText || '' }
  })
  log('submit with 11 (kg)', afterSubmit.modalOpen === false, JSON.stringify(afterSubmit))

  // Find the E2E card and open the Add (adjust) modal — test 11 and 11.1 for kg
  const findCard = () => page.evaluate(() => {
    const card = [...document.querySelectorAll('article')].find(a => a.innerText.includes('E2E KG Test'))
    if (!card) return false
    card.querySelector('button[title*="Add"]')?.click()
    return true
  })

  for (const amount of ['11', '11.1', '11.05']) {
    if (!await findCard()) { log(`adjust modal (kg, ${amount}) — card not found`, false); continue }
    await sleep(600)
    const state = await page.evaluate(amountText => {
      const input = document.querySelector('.fixed input[type="number"]') || document.querySelector('input[type="number"]:not(label[test])')
      const modalInput = [...document.querySelectorAll('input[type="number"]')].find(i => i.checkVisibility())
      ;(Object.getOwnPropertyDescriptor(Object.getPrototypeOf(modalInput), 'value')).set.call(modalInput, amountText)
      modalInput.dispatchEvent(new Event('input', { bubbles: true }))
      return { value: modalInput.value, valid: modalInput.checkValidity(), message: modalInput.validationMessage, step: modalInput.step, min: modalInput.min }
    }, amount)
    log(`adjust (kg) value ${amount}`, state.valid, JSON.stringify(state))
    // Try to submit this adjust
    await page.evaluate(() => { [...document.querySelectorAll('form button')].find(b => /^Add /i.test(b.innerText) && !/stock/i.test(b.innerText))?.click() })
    await sleep(1800)
    const modalStillOpen = await page.evaluate(() => Boolean([...document.querySelectorAll('input')].filter(i => i.checkVisibility()).find(i => i.type === 'number')))
    log(`adjust (kg) ${amount} submitted`, modalStillOpen === false, modalStillOpen ? 'modal still open' : 'modal closed')
  }

  // Now the plates-style rejection: create a plates unit entry quickly, adjust with 11.1
  await sleep(800)
  await page.evaluate(() => { [...document.querySelectorAll('button')].find(b => /Add stock/i.test(b.innerText))?.click() })
  await sleep(800)
  await page.evaluate(() => {
    const select = [...document.querySelectorAll('select')].find(s => /food type/i.test(s.parentElement.innerText))
    if (select && select.options.length >= 2) { select.selectedIndex = 1; select.dispatchEvent(new Event('change', { bubbles: true })) }
    const grab = label => [...document.querySelectorAll('input')].find(i => label.test(i.closest('label')?.innerText || ''))
    const setter = el => { const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set; return value => { set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })) } }
    setter(grab(/Price per/))('3000')
    setter(grab(/Number of/))('20')
    setter(grab(/Stock name/))('E2E Plates Test')
  })
  await page.evaluate(() => { [...document.querySelectorAll('form button')].find(b => /^Add stock$/i.test(b.innerText))?.click() })
  await sleep(2000)
  if (await findCard()) {
    await sleep(600)
    const platesDecimal = await page.evaluate(() => {
      const modalInput = [...document.querySelectorAll('input[type="number"]')].find(i => i.checkVisibility())
      const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(modalInput), 'value').set
      set.call(modalInput, '11.1')
      modalInput.dispatchEvent(new Event('input', { bubbles: true }))
      return { value: modalInput.value, valid: modalInput.checkValidity(), message: modalInput.validationMessage }
    })
    log('adjust (plates) value 11.1', platesDecimal.valid, JSON.stringify(platesDecimal))
    await page.evaluate(() => { [...document.querySelectorAll('form button')].find(b => /^Add /i.test(b.innerText) && !/stock/i.test(b.innerText))?.click() })
    await sleep(1500)
    const rejected = await page.evaluate(() => document.querySelector('[role="alert"]')?.innerText || '')
    log('plates 11.1 backend/app response', rejected.length > 0, rejected)
  }
} catch (err) {
  console.log('FAIL run aborted —', err.message)
  await page.screenshot({ path: 'scripts/e2e-stock-error.png' })
} finally {
  // Cleanup: remove the two test entries straight from the database
  await browser.close()
  console.log('cleanup done in separate step — run scripts/clean-stock-tests.mjs')
}

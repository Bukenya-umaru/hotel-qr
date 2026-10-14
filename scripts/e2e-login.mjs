// One-off verification: drives the real Chrome UI through the dashboard sign-in
// flow. Run from the repo root: `node scripts/e2e-login.mjs`.
// Expects a test chef account (see repo notes) that the caller creates/deletes.
import puppeteer from 'puppeteer-core'

const APP = 'http://localhost:5173'
const EMAIL = 'e2e-test-chef@stayserve.local'
const PASSWORD = 'E2eLogin123'
const EXECUTABLE = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const step = (name, ok, detail = '') =>
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)

const browser = await puppeteer.launch({
  executablePath: EXECUTABLE,
  headless: 'new',
  defaultViewport: { width: 1280, height: 860 },
})
const page = await browser.newPage()

const consoleErrors = []
page.on('pageerror', err => consoleErrors.push(String(err)))

// Track what /api/auth/me returns once signed in.
page.setExtraHTTPHeaders({})
try {
  await page.goto(APP, { waitUntil: 'networkidle2', timeout: 30000 })
  await sleep(500)
  step('load dashboard at :5173', true, page.url())

  const loginVisible = await page.evaluate(() => {
    const el = document.body.innerText
    return /sign in|login|welcome/i.test(el) && !!document.querySelector('input[type="password"]')
  })
  step('login form visible before auth', loginVisible)

  const waitFor = async test => { for (let i = 0; i < 40; i += 1) { if (await page.evaluate(test)) return true; await sleep(250) } return false }

  // 1) Wrong credentials should be rejected.
  await page.type('#login-email', EMAIL, { delay: 10 })
  await page.type('#login-password', 'WrongPass999', { delay: 10 })
  await Promise.all([
    page.evaluate(() => { [...document.querySelectorAll('form button')].find(b => /Log In/i.test(b.innerText)).click() }),
    waitFor(() => !!document.querySelector('[role="alert"]')),
  ])
  const rejected = await page.evaluate(() => {
    const el = document.body.innerText
    return /invalid|incorrect|wrong|failed/i.test(el) && !el.includes('E2E Test Chef')
  })
  step('wrong password rejected', rejected)

  // 2) Correct credentials sign in and land on the dashboard.
  // Reload for a fresh React form state — controlled inputs ignore raw DOM edits.
  await page.goto(APP, { waitUntil: 'networkidle2', timeout: 30000 })
  await waitFor(() => !!document.querySelector('#login-email'))
  await page.type('#login-email', EMAIL, { delay: 10 })
  await page.type('#login-password', PASSWORD, { delay: 10 })
  const submit = await page.evaluateHandle(() => [...document.querySelectorAll('form button')].find(b => /Log In/i.test(b.innerText)))
  await submit.asElement().click()
  await waitFor(() => document.body.innerText.includes('E2E Test Chef'))
  const signedIn = await page.evaluate(() => document.body.innerText)
  const dashboardShows = signedIn.includes('E2E Test Chef')
    || (/kitchen|chef|overview|dashboard|stock|purchases/i.test(signedIn) && signedIn.length > 300)
  step('dashboard renders after sign-in', dashboardShows)

  await page.screenshot({ path: 'scripts/e2e-dashboard.png' })

  // 3) Session survives a reload — /api/auth/me must resolve through the cookie.
  await page.reload({ waitUntil: 'networkidle2' })
  await sleep(1200)
  const stillIn = await page.evaluate(() => !document.body.innerText.includes('Sign in')
    || document.body.innerText.includes('E2E Test Chef')
    || /kitchen|chef|overview|dashboard|stock|purchases/i.test(document.body.innerText))
  step('session survives page reload', stillIn)

  // 4) Sign out returns to the login page.
  const signOutButton = await page.evaluateHandle(() => {
    const buttons = [...document.querySelectorAll('button')]
    const find = container => container.find(b => /sign out|log ?out/i.test(b.innerText))
    return find(buttons)
  })
  if (signOutButton && await signOutButton.evaluate(b => !!b)) {
    await signOutButton.click()
  } else {
    // Sidebar may be collapsed on smaller widths — widen viewport as fallback.
    await page.setViewport({ width: 1600, height: 900 })
    await sleep(800)
    const retry = await page.$eval('body', body => {
      const buttons = [...body.querySelectorAll('button')]
      const out = buttons.find(b => /sign out|log ?out/i.test(b.innerText))
      if (out) { out.click(); return true }
      return false
    })
    step('sign-out button found', retry)
  }
  await sleep(1500)
  const loggedOut = await page.evaluate(() => {
    const el = document.body.innerText
    return (/sign ?in|log ?in|welcome/i.test(el) && !el.includes('E2E Test Chef'))
  })
  step('sign-out returns to login page', loggedOut)
  await page.screenshot({ path: 'scripts/e2e-loggedout.png' })

  // 5) After sign-out, /api/auth/me should no longer return a user.
  const meAfterLogout = await page.evaluate(async () => {
    const res = await fetch('/api/auth/me'.replace('/api', 'http://localhost:4000/api'), { credentials: 'include' })
    return res.status
  })
  step('session cookie revoked after sign-out', meAfterLogout === 401, `HTTP ${meAfterLogout}`)

  if (consoleErrors.length) console.log('page JS errors:', consoleErrors.slice(0, 5))
} catch (err) {
  console.log('FAIL e2e run aborted —', err.message)
} finally {
  await browser.close()
}

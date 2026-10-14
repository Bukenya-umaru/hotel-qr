// Verifies the PWA install experience on both frontends over the live dev
// servers: manifest valid, service worker registered, and the popup flow —
// popup appears from a beforeinstallprompt event, Install calls prompt(),
// and a dismissed browser stays quiet on the next visit. Run from repo root:
// node scripts/e2e-pwa.mjs
import puppeteer from 'puppeteer-core'

const EXECUTABLE = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORTS = [5173, 5174]
const sleep = ms => new Promise(r => setTimeout(r, ms))
const log = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
let failures = 0
const check = (name, ok, detail) => { if (!ok) failures += 1; log(name, ok, detail) }

const browser = await puppeteer.launch({ executablePath: EXECUTABLE, headless: 'new', defaultViewport: { width: 1280, height: 860 } })
try {
  for (const port of PORTS) {
    const url = `http://localhost:${port}`
    const page = await browser.newPage()

    // Fresh visit: no dismissed flag, no standalone mode.
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
    await sleep(1500)

    // 1) Manifest is served and sane.
    const manifest = await page.evaluate(async app => {
      const res = await fetch('/manifest.webmanifest')
      if (res.status !== 200) return { error: `HTTP ${res.status}` }
      const m = await res.json()
      const icon = await fetch(m.icons?.[0]?.src || '', { method: 'HEAD' }).then(r => r.status).catch(() => 0)
      return { name: m.name, display: m.display, start: m.start_url, iconStatus: icon, icons: m.icons?.length }
    }, port)
    check(`${url} manifest served and valid`, Boolean(manifest.name) && manifest.display === 'standalone' && manifest.iconStatus === 200,
      JSON.stringify(manifest))

    // 2) Service worker registered (install criterion).
    const sw = await page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations()
      return { count: regs.length, scope: regs[0]?.scope || '' }
    })
    check(`${url} service worker registered`, sw.count >= 1, sw.scope || JSON.stringify(sw))

    // 3) Popup appears when the browser declares installability.
    const popupAppeared = await page.evaluate(() => {
      const fake = new Event('beforeinstallprompt')
      fake.preventDefault = () => {}
      fake.prompt = () => { window.__pwaPromptCalled = true; return Promise.resolve({ outcome: 'accepted' }) }
      fake.userChoice = Promise.resolve({ outcome: 'accepted' })
      window.dispatchEvent(fake)
      return new Promise(resolve => {
        let found = null
        const started = Date.now()
        const tick = () => {
          const dialog = [...document.querySelectorAll('[role="dialog"]')].find(d => /install app/i.test(d.getAttribute('aria-label') || ''))
          found = dialog
          if (dialog || Date.now() - started > 3000) return resolve(Boolean(dialog))
          setTimeout(tick, 150)
        }
        tick()
      })
    })
    check(`${url} install popup appears on beforeinstallprompt`, popupAppeared)

    // 4) Tapping Install invokes the browser's real install dialog hook.
    const promptInvoked = await page.evaluate(() => {
      const dialog = [...document.querySelectorAll('[role="dialog"]')].find(d => /install app/i.test(d.getAttribute('aria-label') || ''))
      const button = [...dialog.querySelectorAll('button')].find(b => b.innerText.trim() === 'Install')
      if (!button) return false
      button.click()
      return new Promise(resolve => {
        let called = window.__pwaPromptCalled === true
        const started = Date.now()
        const tick = () => {
          if (window.__pwaPromptCalled) called = true
          if (called || Date.now() - started > 3000) return resolve(called)
          setTimeout(tick, 150)
        }
        tick()
      })
    })
    check(`${url} Install button triggers the native dialog`, promptInvoked)

    // 5) "Not now" records the dismissal — a fresh visit must stay quiet.
    const secondVisit = await page.evaluate(async () => {
      // Re-show via a fresh listener by reloading later; here we only dismiss.
      const dialog = [...document.querySelectorAll('[role="dialog"]')].find(d => /install app/i.test(d.getAttribute('aria-label') || ''))
        || [...document.querySelectorAll('[role="dialog"]')].find(d => /install app/i.test(d.getAttribute('aria-label') || ''))
      return Boolean(dialog)
    })
    // The popup was hidden right after Install; emulate the dismissal path in
    // this same page is impossible post-hide, so do it on a fresh context:
    const page2 = await browser.newPage()
    await page2.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
    await sleep(1200)
    await page2.evaluate(() => {
      const fake = new Event('beforeinstallprompt')
      fake.preventDefault = () => {}
      fake.prompt = () => Promise.resolve({ outcome: 'dismissed' })
      fake.userChoice = Promise.resolve({ outcome: 'dismissed' })
      window.dispatchEvent(fake)
      const dialog = [...document.querySelectorAll('[role="dialog"]')].find(d => /install app/i.test(d.getAttribute('aria-label') || ''))
      const button = [...dialog.querySelectorAll('button')].find(b => /not now/i.test(b.innerText))
      button.click()
      return true
    })
    await sleep(400)
    const dismissed = await page2.evaluate(() => localStorage.getItem('wagabits-install-dismissed'))
    // sixth check: reload and re-dispatch — no popup expected
    await page2.reload({ waitUntil: 'networkidle2' })
    await sleep(1200)
    const quietOnNextVisit = await page2.evaluate(() => {
      const fake = new Event('beforeinstallprompt')
      fake.preventDefault = () => {}
      fake.prompt = () => Promise.resolve({ outcome: 'accepted' })
      fake.userChoice = Promise.resolve({ outcome: 'accepted' })
      window.dispatchEvent(fake)
      return new Promise(resolve => {
        const started = Date.now()
        const tick = () => {
          const dialog = [...document.querySelectorAll('[role="dialog"]')].find(d => /install app/i.test(d.getAttribute('aria-label') || ''))
          if (dialog || Date.now() - started > 2500) return resolve(!dialog)
          setTimeout(tick, 150)
        }
        tick()
      })
    })
    check(`${url} dismissal persisted (flag)`, dismissed === '1')
    check(`${url} fresh visit stays quiet after dismissal`, quietOnNextVisit)

    await page.close()
    await page2.close()
  }
  if (failures) console.log(`=> ${failures} FAILED check(s)`)
} catch (err) {
  console.log('FAIL run aborted —', err.message)
} finally {
  await browser.close()
}

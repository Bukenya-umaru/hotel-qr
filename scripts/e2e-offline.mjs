// Proves the offline shell works: each site is opened once online (populating
// caches by the runtime strategy), then the browser goes fully offline and the
// page reloads — the shell must render, despite the API being unreachable.
// Run from repo root: node scripts/e2e-offline.mjs
import puppeteer from 'puppeteer-core'

const EXECUTABLE = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORTS = [...[5173, 5174]]
const sleep = ms => new Promise(r => setTimeout(r, ms))
const log = (name, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
let failures = 0
const check = (name, ok, detail) => { if (!ok) failures += 1; log(name, ok, detail) }

const browser = await puppeteer.launch({ executablePath: EXECUTABLE, headless: 'new', defaultViewport: { width: 1280, height: 860 } })
try {
  for (const port of PORTS) {
    const url = `http://localhost:${port}`
    const page = await browser.newPage()

    // First visit: the new worker installs (pre-caches '/') and the page loads.
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
    // Second visit: the controlled page fetches all shell assets again, so the
    // runtime strategy caches them; give the worker's cache time to prime.
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 })
    await sleep(2500)

    const warmed = await page.evaluate(() => (async () => {
      const keys = await caches.keys()
      const entries = await caches.open(keys[0]).then(c => c.keys())
      return { version: keys[0], assets: entries.length }
    })())
    check(`${url} shell cache primed (${warmed.version})`, warmed.assets >= 2, `${warmed.assets} cached URLs`)

    // Go fully offline and reload.
    await page.setOfflineMode(true)
    await page.reload({ waitUntil: 'load', timeout: 30000 }).catch(() => { /* navigation may reject while offline — check the DOM anyway */ })
    await sleep(2000)

    const offline = await page.evaluate(() => ({
      rootChildren: document.getElementById('root')?.children.length || 0,
      title: document.title,
      text: document.body.innerText.slice(0, 120),
    }))
    check(`${url} OPENS WITHOUT THE API (offline reload)`, offline.rootChildren > 0, JSON.stringify(offline.text))

    // Confirm the shell really is the app's own markup, not an error page.
    check(`${url} offline shell is the real app markup`, /WAGA BITES/i.test(offline.text), offline.rootChildren ? 'root populated' : 'root empty')

    await page.setOfflineMode(false)
    // And back online the page still loads normally.
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 })
    const online = await page.evaluate(() => document.body.innerText.length)
    check(`${url} online behavior still normal afteroffline test`, online > 100)

    await page.close()
  }
  if (failures) console.log(`=> ${failures} FAILED check(s)`)
} catch (err) {
  console.log('FAIL run aborted —', err.message)
} finally {
  await browser.close()
}

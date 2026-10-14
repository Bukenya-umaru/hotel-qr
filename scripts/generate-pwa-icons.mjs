// Generates the PWA icon set for both frontends by rasterizing brand SVG art
// in headless Chrome — no image libraries needed. Writes:
//   frontend/<app>/public/icons/icon-192.png, icon-512.png, icon-maskable-512.png
// Run from the repo root: node scripts/generate-pwa-icons.mjs
import puppeteer from 'puppeteer-core'
import { mkdir } from 'node:fs/promises'

const EXECUTABLE = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const TARGETS = [
  'frontend/admin/public/icons',
  'frontend/customer/public/icons',
]

// Plate + fork mark on the brand brick background. The art is drawn in a
// 100-unit viewBox; maskable mode scales it down to keep it inside the safe
// zone while the background stays full-bleed.
const art = maskable => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    <rect width="100" height="100" fill="#a93216" />
    <g transform="${maskable ? 'translate(50 50) scale(0.62) translate(-50 -50)' : ''}">
      <circle cx="56" cy="52" r="24" fill="none" stroke="#ffffff" stroke-width="6" />
      <circle cx="56" cy="52" r="10" fill="none" stroke="#ffffff" stroke-width="4" />
      <path d="M20 32 q4 -6 4 0 v22 q0 3 -3.5 3 q-3.5 0 -3.5 -3 z" fill="#ffffff" />
      <path d="M29 32 q4 -6 4 0 v22 q0 3 -3.5 3 q-3.5 0 -3.5 -3 z" fill="#ffffff" opacity=".85" />
      <rect x="21.5" y="55" width="9" height="16" rx="4.5" fill="#ffffff" />
    </g>
  </svg>`

const html = maskable => `<!doctype html><html><head><style>
  * { margin: 0; padding: 0 }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #a93216 }
</style></head><body>${art(maskable)}</body></html>`

const browser = await puppeteer.launch({ executablePath: EXECUTABLE, headless: 'new' })
try {
  const page = await browser.newPage()
  for (const dir of TARGETS) {
    await mkdir(dir, { recursive: true })
    for (const [name, width, height, maskable] of [
      ['icon-192.png', 192, 192, false],
      ['icon-512.png', 512, 512, false],
      ['icon-maskable-512.png', 512, 512, true],
    ]) {
      await page.setViewport({ width, height })
      await page.setContent(html(maskable), { waitUntil: 'load' })
      await page.screenshot({ path: `${dir}/${name}`, clip: { x: 0, y: 0, width, height } })
      console.log(`written ${dir}/${name}`)
    }
  }
} finally {
  await browser.close()
}

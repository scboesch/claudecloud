/**
 * Render the property viewer to PNGs so changes to the model can be eyeballed.
 *
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/screenshot.mjs out/ 15.4 curb,lake,aerial
 *
 * Headless Chromium only advances requestAnimationFrame when a frame is
 * composited, so this drives the scene through window.__house and burns a few
 * throwaway screenshots between steps rather than relying on the render loop.
 */
import { chromium } from 'playwright'
const OUT = process.argv[2]
const HOUR = Number(process.argv[3] ?? 15.4)
const WANT = (process.argv[4] || 'curb,lake,aerial').split(',')
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.evaluate((h) => window.__house.setTimeOfDay(h), HOUR)
for (const id of WANT) {
  await page.evaluate((v) => window.__house.setView(v, true), id)
  for (let i = 0; i < 4; i++) await page.screenshot({ path: `${OUT}/.warm.png` })
  await page.screenshot({ path: `${OUT}/${id}-${String(HOUR).replace('.', '_')}.png` })
}
console.log('ok', WANT.join(','), '@', HOUR)
await browser.close()

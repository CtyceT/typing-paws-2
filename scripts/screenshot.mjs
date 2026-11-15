// 截整頁截圖給人看版面用（先在另一個終端機跑 npm run dev）。
// 用法：node scripts/screenshot.mjs <名稱> [網址路徑，預設是首頁]
// 輸出在 .compare/screens/（不進版控）：<名稱>-desktop.png（960px）與 <名稱>-mobile.png（390px）。
// Ubuntu 20.04 要加 PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu22.04-x64（同 compare-legacy.mjs）。
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const [, , name = 'page', path = ''] = process.argv
const BASE = process.env.LOCAL_URL ?? 'http://localhost:5173/typing-paws-2/'
const OUT = resolve('.compare/screens')
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
for (const [label, width, height] of [['desktop', 960, 800], ['mobile', 390, 800]]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  // 停掉動畫，截圖才不會剛好截到晃動到一半
  await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; }' })
  const file = `${OUT}/${name}-${label}.png`
  await page.screenshot({ path: file, fullPage: true })
  console.log(file)
}
await browser.close()

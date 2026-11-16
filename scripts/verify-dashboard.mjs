// 用真的瀏覽器驗證階段 2（數據儀表板）：實際打完一場、刻意打錯某個鍵，再檢查儀表板的內容並截圖。
//
// 用法（先在另一個終端機跑 npm run dev）：
//   node scripts/verify-dashboard.mjs
// 輸出在 .compare/dashboard/（不進版控）。有任何檢查沒過會以非 0 結束。
// Ubuntu 20.04 要加 PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu22.04-x64（同 compare-legacy.mjs）。
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const URL = process.env.LOCAL_URL ?? 'http://localhost:5173/typing-paws-2/'
const OUT = resolve('.compare/dashboard')
/** 刻意打錯的鍵：每次輪到它都先按錯一次 */
const WEAK_KEY = 'e'
mkdirSync(OUT, { recursive: true })

const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failures.push(name)
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 960, height: 800 } })
const page = await context.newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))

const shot = async (name) => {
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
}
const stored = (key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key)

/** 從主選單打完一場簡單難度（全部打完，會通關），停在結算畫面。回傳按鍵數與刻意打錯的次數 */
async function playEasy({ pauseOnce = false } = {}) {
  await page.getByRole('button', { name: /簡單/ }).click()
  let keys = 0
  let misses = 0
  let paused = !pauseOnce
  for (;;) {
    const dialog = page.getByRole('dialog')
    if (await dialog.isVisible()) {
      await page.keyboard.press('Enter')
      await page.waitForTimeout(2700) // 倒數 3-2-1-GO
      continue
    }
    if (await page.getByText(/通關成功|被打倒了/).isVisible()) return { keys, misses }
    const word = await page.locator('[data-word]').getAttribute('data-word')
    for (const ch of word) {
      if (ch === WEAK_KEY) {
        await page.keyboard.press('x')
        keys++
        misses++
        await page.waitForTimeout(60)
      }
      await page.keyboard.press(ch === ' ' ? 'Space' : ch)
      keys++
      await page.waitForTimeout(60)
    }
    if (!paused && keys > 30) {
      paused = true
      await page.keyboard.press('Escape')
      await page.waitForTimeout(3000) // 暫停 3 秒：不能算進任何間隔
      await page.keyboard.press('Escape')
    }
    await page.waitForTimeout(80)
    const next = await page.locator('[data-word]').getAttribute('data-word').catch(() => null)
    if (next === word) await page.waitForTimeout(1300) // 怪物倒了：等過關或結束的訊息
  }
}

// ---- 1. 空狀態 ----
await page.goto(URL, { waitUntil: 'networkidle' })
await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('typingPaws2.')).forEach((k) => localStorage.removeItem(k)))
await page.reload({ waitUntil: 'networkidle' })
await page.getByRole('button', { name: /數據儀表板/ }).click()
check('空狀態：顯示引導文字', await page.getByText('還沒有數據').isVisible())
await shot('01-empty')
await page.getByRole('button', { name: /去打一場/ }).click()
check('空狀態：可以回到主選單', await page.getByText('選擇你的勇者').isVisible())

// ---- 2. 實際打兩場 ----
const first = await playEasy({ pauseOnce: true })
await shot('02-result')
const history1 = await stored('typingPaws2.history')
const rows1 = await stored('typingPaws2.keyStats')
check('打完一場：多一筆戰績', history1?.length === 1)
check('打完一場：多一筆場次的按鍵統計', rows1?.length > 0 && rows1.every((r) => r.sessionId === history1[0].id), `${rows1?.length} 列`)
const chars1 = rows1.filter((r) => r.kind === 'char')
const sum = (rows, f) => rows.reduce((n, r) => n + r[f], 0)
check('按鍵統計：次數總和 = 實際按鍵數', sum(chars1, 'attempts') === first.keys, `${sum(chars1, 'attempts')} / ${first.keys}`)
check('按鍵統計：錯誤總和 = 刻意打錯的次數', sum(chars1, 'errors') === first.misses, `${sum(chars1, 'errors')} / ${first.misses}`)
const weak1 = chars1.find((r) => r.key === WEAK_KEY)
check(`按鍵統計：錯誤都記在 ${WEAK_KEY} 上`, weak1?.errors === first.misses)
const maxAvg = Math.max(...chars1.filter((r) => r.timedCount > 0).map((r) => r.totalMs / r.timedCount))
check('暫停的 3 秒沒有算進間隔', maxAvg < 1000, `最大平均間隔 ${Math.round(maxAvg)} ms`)

await page.getByRole('button', { name: /回到選單/ }).click()
await playEasy()
await page.getByRole('button', { name: /回到選單/ }).click()
const rows2 = await stored('typingPaws2.keyStats')
check('打完第二場：按鍵統計有兩個場次', new Set(rows2.map((r) => r.sessionId)).size === 2)

// ---- 3. 儀表板 ----
await page.getByRole('button', { name: /數據儀表板/ }).click()
check('有資料：不再顯示引導文字', !(await page.getByText('還沒有數據').isVisible()))
const statValue = (label) => page.getByText(label, { exact: true }).locator('xpath=preceding-sibling::*[1]').textContent()
check('總覽：場數是 2', (await statValue('場數')) === '2')
check('總覽：統計按鍵數 = 兩場按鍵數', (await statValue('統計按鍵數')) === String(sum(rows2.filter((r) => r.kind === 'char'), 'attempts')))

// 熱力圖：刻意一直打錯的鍵顏色要明顯比其他鍵深
const level = (key) => page.locator(`[data-key="${key}"]`).getAttribute('data-level').then(Number)
const weakLevel = await level(WEAK_KEY)
const otherLevels = await page.locator(`[data-key]:not([data-key="${WEAK_KEY}"])`).evaluateAll((els) => els.map((el) => Number(el.dataset.level)))
check(`熱力圖：${WEAK_KEY} 是最深的等級`, weakLevel === 5, `等級 ${weakLevel}`)
check('熱力圖：其他鍵都沒有上到深色', Math.max(...otherLevels) <= 1, `其他鍵最高等級 ${Math.max(...otherLevels)}`)
const bg = (key) => page.locator(`[data-key="${key}"]`).evaluate((el) => getComputedStyle(el).backgroundColor)
check('熱力圖：顏色真的不同', (await bg(WEAK_KEY)) !== (await bg('a')), `${await bg(WEAK_KEY)} vs ${await bg('a')}`)
await page.locator(`[data-key="${WEAK_KEY}"]`).hover()
const info = await page.getByText(/^E：打了 \d+ 次・錯 \d+ 次/).textContent()
check('熱力圖：滑鼠移上去看得到數字', Boolean(info), info ?? '')

// 弱點排行榜：刻意打錯的鍵排第一
const weakItems = await page.locator('[data-weakness]').evaluateAll((els) => els.map((el) => el.dataset.weakness))
check(`弱點排行榜：${WEAK_KEY} 排第一`, weakItems[0] === `char:${WEAK_KEY}`, weakItems.join(', '))
check('弱點排行榜：最多 5 個', weakItems.length >= 1 && weakItems.length <= 5, `${weakItems.length} 個`)
const firstText = await page.locator('[data-weakness]').first().textContent()
const weakTotals = rows2.filter((r) => r.kind === 'char' && r.key === WEAK_KEY).reduce((t, r) => ({ a: t.a + r.attempts, e: t.e + r.errors }), { a: 0, e: 0 })
check('弱點排行榜：數字和 localStorage 的統計一致', firstText.includes(`打 ${weakTotals.a} 次、錯 ${weakTotals.e} 次`), firstText)

// 趨勢圖：兩張圖（WPM、準確率）都真的畫出東西
const painted = (label) =>
  page.locator(`canvas[aria-label="${label}"]`).evaluate((c) => {
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height)
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return true
    return false
  })
check('趨勢圖：WPM 有畫出來', await painted('WPM 趨勢'))
check('趨勢圖：準確率有畫出來', await painted('準確率 趨勢'))
await page.getByRole('button', { name: '全部（2 場）' }).click()
check('趨勢圖：可以切換到全部', (await page.getByRole('button', { name: '全部（2 場）' }).getAttribute('aria-pressed')) === 'true')
await page.getByRole('button', { name: /最近 10 場/ }).click()
await page.mouse.move(1, 1)
await page.waitForTimeout(500)
await shot('03-dashboard-desktop')
await page.setViewportSize({ width: 390, height: 800 })
await shot('03-dashboard-mobile')
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
check('手機寬度：沒有水平捲動', overflow <= 0, `超出 ${overflow}px`)
await page.setViewportSize({ width: 960, height: 800 })

// ---- 4. 塞 14 場假戰績，看場次多的時候趨勢圖的樣子（只為了截圖，按鍵統計維持真的那兩場） ----
await page.evaluate(() => {
  const real = JSON.parse(localStorage.getItem('typingPaws2.history'))
  const fake = Array.from({ length: 14 }, (_, i) => ({
    id: `fake-${i}`,
    playedAt: real[0].playedAt - (14 - i) * 3600000,
    mode: 'classic',
    difficulty: ['easy', 'normal', 'hard'][i % 3],
    win: i % 4 !== 3,
    wpm: Math.round(28 + i * 2.2 + (i % 3) * 4),
    accuracy: Math.round((86 + i * 0.7 + (i % 2) * 2) * 10) / 10,
    maxCombo: 20,
    score: 2000,
    damage: 300,
    durationMs: 60000,
    stage: i % 4 !== 3 ? 3 : 2,
  }))
  localStorage.setItem('typingPaws2.history', JSON.stringify([...fake, ...real]))
})
await page.reload({ waitUntil: 'networkidle' })
await page.getByRole('button', { name: /數據儀表板/ }).click()
await page.getByRole('button', { name: '全部（16 場）' }).click()
await page.waitForTimeout(600)
const wpmBox = await page.locator('canvas[aria-label="WPM 趨勢"]').boundingBox()
await page.mouse.move(wpmBox.x + wpmBox.width * 0.6, wpmBox.y + wpmBox.height * 0.5)
await page.waitForTimeout(400)
await shot('04-trend-16-games-desktop')
await page.setViewportSize({ width: 390, height: 800 })
await page.waitForTimeout(400)
await shot('04-trend-16-games-mobile')
await page.setViewportSize({ width: 960, height: 800 })

check('瀏覽器沒有錯誤訊息', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(failures.length === 0 ? `\n全部通過，截圖在 ${OUT}` : `\n有 ${failures.length} 項沒過：${failures.join('、')}`)
process.exit(failures.length === 0 ? 0 : 1)

// 把線上 1.0 版和本機展示頁的同一批元件截圖並排，產生一張比對報告。
//
// 用法（先在另一個終端機跑 npm run dev）：
//   node scripts/compare-legacy.mjs
// 輸出在 .compare/1.7/（不進版控）：report.png、report.html 與各張截圖。
//
// Ubuntu 20.04 上 Playwright 沒有對應的瀏覽器，安裝與執行時都要加：
//   PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu22.04-x64
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const LEGACY_URL = process.env.LEGACY_URL ?? 'https://ctycet.github.io/typing-paws/'
const LOCAL_URL = process.env.LOCAL_URL ?? 'http://localhost:5173/typing-paws-2/?demo'
const OUT = resolve('.compare/1.7')
const VIEWPORT = { width: 960, height: 800 }
const SCALE = 2

const STYLE_PROPS = [
  'color', 'backgroundColor', 'borderTopWidth', 'borderTopStyle', 'borderTopColor',
  'borderTopLeftRadius', 'boxShadow', 'fontFamily', 'fontSize', 'fontWeight',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'transform', 'width', 'height',
]

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const open = async (url, init) => {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE })
  if (init) await ctx.addInitScript(init)
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  return page
}

// 1.0 版先塞三筆假戰績，戰績表才會出現三種難度的標籤
const legacy = await open(LEGACY_URL, () => {
  const t = 1790000000000
  const row = (diff, i) => ({ t: t + i, diff, win: true, wpm: 40 + i, acc: 96, combo: 20, score: 3000, stage: 3 })
  localStorage.setItem('typingPaws.v1', JSON.stringify({ best: {}, history: ['easy', 'normal', 'hard'].map(row) }))
})
const local = await open(LOCAL_URL)

const results = []

// 先比頁面本身（底色、點點背景、字體、文字顏色），再把點點背景關掉：
// 點點的位置跟著捲動位置走，留著會讓每張截圖的背景都對不齊。
const BODY_PROPS = ['backgroundColor', 'backgroundImage', 'backgroundSize', 'fontFamily', 'color']
const bodyStyle = (page) =>
  page.evaluate((props) => Object.fromEntries(props.map((p) => [p, getComputedStyle(document.body)[p]])), BODY_PROPS)
const [bodyA, bodyB] = [await bodyStyle(legacy), await bodyStyle(local)]
const bodyDiff = BODY_PROPS.filter((p) => bodyA[p] !== bodyB[p])
console.log(bodyDiff.length ? `DIFF 頁面背景與字體：${bodyDiff.join(', ')}` : 'OK   頁面背景與字體（底色、點點、字體、文字顏色）相同')
const DOTS_OFF = 'body { background-image: none !important; }'
await legacy.addStyleTag({ content: DOTS_OFF })
await local.addStyleTag({ content: DOTS_OFF })

/** 以一般狀態的外框為準（加上 pad），截下 normal / hover / active 各一張，並記錄計算後的樣式 */
async function capture(page, selector, states, pad) {
  const el = page.locator(selector).first()
  await el.evaluate((node) => node.scrollIntoView({ block: 'center' })) // 置中，避免外框被視窗邊緣裁掉
  await page.mouse.move(1, 1)
  await page.waitForTimeout(350)
  // 版面位置常有小數（例如 y=778.47），兩邊小數不同會讓反鋸齒結果不同。
  // 先把元件微調到整數座標再截圖，這樣比的才是樣式本身。
  await el.evaluate((node) => {
    const r = node.getBoundingClientRect()
    node.style.position = 'relative'
    node.style.left = `${(parseFloat(node.style.left) || 0) + Math.round(r.x) - r.x}px`
    node.style.top = `${(parseFloat(node.style.top) || 0) + Math.round(r.y) - r.y}px`
  })
  const box = await el.boundingBox()
  if (!box) throw new Error(`找不到 ${selector}`)
  const clip = { x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2 }
  const center = [box.x + box.width / 2, box.y + box.height / 2]
  const out = {}
  for (const state of states) {
    if (state !== 'normal') await page.mouse.move(...center)
    if (state === 'active') await page.mouse.down()
    await page.waitForTimeout(250)
    const png = await page.screenshot({ clip })
    const style = await el.evaluate((node, props) => {
      const cs = getComputedStyle(node)
      return Object.fromEntries(props.map((p) => [p, cs[p]]))
    }, STYLE_PROPS)
    if (state === 'active') {
      await page.mouse.move(1, 1) // 移開再放開，避免真的觸發點擊
      await page.mouse.up()
    }
    out[state] = { png, style }
  }
  await page.mouse.move(1, 1)
  return out
}

async function compare(name, legacySel, localSel, { states = ['normal'], pad = 10 } = {}) {
  const a = await capture(legacy, legacySel, states, pad)
  const b = await capture(local, localSel, states, pad)
  for (const state of states) {
    const id = states.length > 1 ? `${name}-${state}` : name
    writeFileSync(`${OUT}/legacy-${id}.png`, a[state].png)
    writeFileSync(`${OUT}/local-${id}.png`, b[state].png)
    const styleDiff = STYLE_PROPS.filter((p) => a[state].style[p] !== b[state].style[p]).map(
      (p) => `${p}: 1.0「${a[state].style[p]}」 2.0「${b[state].style[p]}」`,
    )
    results.push({ id, legacy: a[state].png.toString('base64'), local: b[state].png.toString('base64'), styleDiff })
  }
}

const BUTTON_STATES = ['normal', 'hover', 'active']

// ---- 主選單上的元件 ----
await compare('cards', '.how-grid', '[data-demo=cards]')
for (const d of ['easy', 'normal', 'hard']) {
  const nth = ['easy', 'normal', 'hard'].indexOf(d) + 1
  await compare(`tag-${d}`, `table.hist .tag.${d}`, `[data-demo=tags] > :nth-child(${nth})`, { pad: 3 }) // pad 小一點，避開 1.0 版表格列的虛線
}
await compare('btn-small-ghost', '#clearBtn', '[data-demo=btn-small-ghost]', { states: BUTTON_STATES, pad: 8 })

// 視窗是半透明遮罩蓋在頁面上，兩邊頁面內容不同會透出來。
// 比視窗時先把背後的內容和點點背景藏起來，只留遮罩和視窗本身。
async function hideBackdrop() {
  await legacy.evaluate(() => {
    document.getElementById('app').style.visibility = 'hidden'
  })
  await local.evaluate(() => {
    document.querySelector('main').style.visibility = 'hidden'
    document.querySelector('[role=dialog]').parentElement.style.visibility = 'visible'
  })
}
async function showBackdrop() {
  await legacy.evaluate(() => {
    document.getElementById('app').style.visibility = ''
  })
  await local.evaluate(() => {
    document.querySelector('main').style.visibility = ''
  })
}

// ---- 開場訊息視窗與主要按鈕 ----
await legacy.click('.diff-card[data-diff=easy]')
await local.click('[data-demo=open-intro]')
await hideBackdrop()
await legacy.waitForTimeout(600)
await compare('dialog-intro', '#msgOverlay .card', '[role=dialog]', { pad: 0 })
await compare('btn-primary', '#msgBtns .btn', '[role=dialog] button', { states: BUTTON_STATES })

// ---- 進度條：兩邊都設成同樣的寬度、同樣的進度、同樣的白底 ----
await showBackdrop()
await local.keyboard.press('Enter') // 關掉展示頁的視窗
await legacy.evaluate(() => {
  document.getElementById('msgOverlay').style.visibility = 'hidden'
  document.querySelectorAll('.fighter .info').forEach((el) => (el.style.background = '#fff'))
})
const barWidth = await legacy.locator('.bar.hp-player').evaluate((el) => el.getBoundingClientRect().width)
await local.locator('[data-demo=bars]').evaluate((el, w) => {
  const cs = getComputedStyle(el)
  const extra = ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'].reduce((n, p) => n + parseFloat(cs[p]), 0)
  el.style.width = `${w + extra}px`
}, barWidth)
const setBars = async (pct) => {
  await legacy.evaluate((p) => {
    for (const id of ['pHp', 'eHp', 'eCharge']) document.getElementById(id).style.width = `${p}%`
    document.getElementById('chargeBar').classList.toggle('danger', p > 75)
  }, pct)
  await local.locator('input[type=range]').fill(String(pct / 100))
  await legacy.waitForTimeout(500) // 等血條的寬度動畫跑完
}
for (const pct of [64, 80]) {
  await setBars(pct)
  await compare(`bar-player-${pct}`, '.bar.hp-player', '[data-demo=bars] > :nth-child(1)', { pad: 4 })
  await compare(`bar-monster-${pct}`, '.bar.hp-enemy', '[data-demo=bars] > :nth-child(2)', { pad: 4 })
  await compare(`bar-charge-${pct}`, '.bar.charge', '[data-demo=bars] > :nth-child(3)', { pad: 4 })
}

// ---- 暫停訊息視窗與次要按鈕 ----
await legacy.evaluate(() => (document.getElementById('msgOverlay').style.visibility = ''))
await legacy.keyboard.press('Enter') // 開打 → 倒數 3-2-1
await legacy.waitForTimeout(3300)
await legacy.keyboard.press('Escape')
await local.click('[data-demo=open-pause]')
await hideBackdrop()
await legacy.waitForTimeout(600)
await compare('dialog-pause', '#msgOverlay .card', '[role=dialog]', { pad: 0 })
await compare('btn-ghost', '#msgBtns .btn.ghost', '[role=dialog] button:nth-of-type(2)', { states: BUTTON_STATES })

// ---- 產生並排報告，並在頁面裡逐像素比對 ----
const html = `<!doctype html><meta charset="utf-8"><style>
  body { font: 14px system-ui, sans-serif; margin: 16px; background: #eee; color: #222; }
  table { border-collapse: collapse; background: #fff; }
  th, td { border: 1px solid #bbb; padding: 8px; vertical-align: top; text-align: left; }
  img, canvas { display: block; max-width: 460px; height: auto; }
  .ok { color: #1a7f37; font-weight: 600; } .bad { color: #c62828; font-weight: 600; }
  small { display: block; max-width: 300px; }
</style>
<table><tr><th>元件</th><th>線上 1.0 版</th><th>本機 2.0 展示頁</th><th>差異（紅色＝不同的像素）</th><th>比對結果</th></tr>
${results.map((r, i) => `<tr data-i="${i}"><td>${r.id}</td>
  <td><img class="a" src="data:image/png;base64,${r.legacy}"></td>
  <td><img class="b" src="data:image/png;base64,${r.local}"></td>
  <td><canvas></canvas></td><td class="res"></td></tr>`).join('\n')}
</table>`
writeFileSync(`${OUT}/report.html`, html)

const report = await (await browser.newContext({ viewport: { width: 1700, height: 900 } })).newPage()
await report.goto(`file://${OUT}/report.html`)
const pixelDiffs = await report.evaluate(async () => {
  const out = []
  for (const tr of document.querySelectorAll('tr[data-i]')) {
    const [a, b] = [tr.querySelector('.a'), tr.querySelector('.b')]
    await Promise.all([a.decode(), b.decode()])
    const canvas = tr.querySelector('canvas')
    const w = Math.max(a.naturalWidth, b.naturalWidth)
    const h = Math.max(a.naturalHeight, b.naturalHeight)
    const data = (img) => {
      const c = new OffscreenCanvas(w, h).getContext('2d')
      c.drawImage(img, 0, 0)
      return c.getImageData(0, 0, w, h).data
    }
    const [da, db] = [data(a), data(b)]
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.globalAlpha = 0.25
    ctx.drawImage(b, 0, 0)
    ctx.globalAlpha = 1
    const mark = ctx.getImageData(0, 0, w, h)
    let diff = 0
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]))
      if (d > 8) {
        diff++
        mark.data.set([255, 0, 0, 255], i)
      }
    }
    ctx.putImageData(mark, 0, 0)
    const sameSize = a.naturalWidth === b.naturalWidth && a.naturalHeight === b.naturalHeight
    out.push({ diff, total: w * h, sameSize, size: `${a.naturalWidth}×${a.naturalHeight} / ${b.naturalWidth}×${b.naturalHeight}` })
  }
  return out
})
await report.evaluate(
  ({ pixelDiffs, styleDiffs }) => {
    document.querySelectorAll('tr[data-i]').forEach((tr, i) => {
      const p = pixelDiffs[i]
      const s = styleDiffs[i]
      const pct = ((p.diff / p.total) * 100).toFixed(2)
      tr.querySelector('.res').innerHTML =
        `<div class="${p.diff === 0 ? 'ok' : 'bad'}">像素差異 ${p.diff}（${pct}%）</div>` +
        `<div class="${p.sameSize ? 'ok' : 'bad'}">尺寸 ${p.size}</div>` +
        `<div class="${s.length ? 'bad' : 'ok'}">樣式${s.length ? '不同：' : '相同'}</div>` +
        s.map((line) => `<small>${line}</small>`).join('')
    })
  },
  { pixelDiffs, styleDiffs: results.map((r) => r.styleDiff) },
)
await report.screenshot({ path: `${OUT}/report.png`, fullPage: true })

for (const [i, r] of results.entries()) {
  const p = pixelDiffs[i]
  const flag = p.diff === 0 && p.sameSize && r.styleDiff.length === 0 ? 'OK  ' : 'DIFF'
  console.log(`${flag} ${r.id.padEnd(24)} 像素差異 ${String(p.diff).padStart(6)} / ${p.total}  尺寸 ${p.size}`)
  for (const line of r.styleDiff) console.log(`       ${line}`)
}
console.log(`\n報告：${OUT}/report.png`)
await browser.close()

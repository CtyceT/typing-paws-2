// 從 @phosphor-icons/react（MIT 授權）取出遊戲用到的圖示的 Duotone 樣式，產生 src/components/icon-paths.ts（D90）。
// 為什麼不直接 import 元件：Phosphor 的每個圖示元件都帶著 6 種樣式（約 3 kB），45 個圖示會讓首頁的 JS 多 140 kB，
// 超過 ROADMAP 11.5 的 300 kB 上限；只取 Duotone 的形狀大約只要 1/6。
//
// 用法：新增或更換圖示時，改 ICON_SOURCES（和 src/game/icons.ts 的 ICON_NAMES 對應），再跑 node scripts/build-icons.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as Phosphor from '@phosphor-icons/react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ICON_NAMES } from '../src/game/icons.ts'

const OUT = fileURLToPath(new URL('../src/components/icon-paths.ts', import.meta.url))

/** 遊戲的圖示代號 → Phosphor 的圖示名稱（https://phosphoricons.com） */
const ICON_SOURCES = {
  sword: 'Sword',
  book: 'BookOpen',
  target: 'Target',
  calendar: 'CalendarDots',
  plant: 'Plant',
  star: 'Star',
  fire: 'Fire',
  coffee: 'Coffee',
  magic: 'MagicWand',
  rocket: 'Rocket',
  backpack: 'Backpack',
  trendDown: 'TrendDown',
  trendUp: 'TrendUp',
  minus: 'Minus',
  sparkle: 'Sparkle',
  confetti: 'Confetti',
  trophy: 'Trophy',
  heartBreak: 'HeartBreak',
  medal: 'Medal',
  syncing: 'ArrowsClockwise',
  warning: 'Warning',
  cloudCheck: 'CloudCheck',
  paw: 'PawPrint',
  key: 'Key',
  sad: 'SmileySad',
  package: 'Package',
  download: 'DownloadSimple',
  gamepad: 'GameController',
  chartLine: 'ChartLine',
  chartBar: 'ChartBar',
  broom: 'Broom',
  keyboard: 'Keyboard',
  hourglass: 'Hourglass',
  pause: 'Pause',
  play: 'Play',
  flag: 'Flag',
  pointer: 'HandPointing',
  capsLock: 'ArrowFatLinesUp',
  books: 'Books',
  robot: 'Robot',
  retry: 'ArrowClockwise',
  home: 'House',
  lock: 'Lock',
  user: 'User',
  lightning: 'Lightning',
}

const missing = ICON_NAMES.filter((n) => !ICON_SOURCES[n])
const extra = Object.keys(ICON_SOURCES).filter((n) => !ICON_NAMES.includes(n))
if (missing.length > 0 || extra.length > 0) {
  console.error(`ICON_SOURCES 和 ICON_NAMES 對不上：缺 ${missing.join(', ') || '無'}；多 ${extra.join(', ') || '無'}`)
  process.exit(1)
}

/** 取出 Duotone 的兩層：淡色色塊（opacity 0.2）和線條。每個圖示都剛好是這兩個 path，不是的話就停下來 */
function duotonePaths(name, svg) {
  const paths = [...svg.matchAll(/<path([^>]*)>/g)].map((m) => ({ d: /\sd="([^"]*)"/.exec(m[1])?.[1], light: /opacity="0.2"/.test(m[1]) }))
  const others = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').replace(/<path[^>]*>(<\/path>)?/g, '')
  const light = paths.filter((p) => p.light)
  const line = paths.filter((p) => !p.light)
  if (others !== '' || light.length !== 1 || line.length !== 1 || !light[0].d || !line[0].d) throw new Error(`${name} 的結構不是「淡色一層＋線條一層」，請換一個圖示`)
  return [compact(light[0].d), compact(line[0].d)]
}

/** path 拆成指令與數字（Phosphor 的數字之間常常沒有分隔，例如 "-16.25.29" 是 -16.25 和 .29 兩個數） */
const tokenize = (d) => d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g)

/**
 * 縮短 path：座標四捨五入到小數 DECIMALS 位，再用最少的分隔重新接起來。
 * 拆開後的數量必須和原本相同（弧線旗標若寫成相連的 "01" 會被當成一個數，這種情況直接停下來）。
 */
const DECIMALS = 1
function compact(d) {
  const tokens = tokenize(d)
  if (tokens.join('').length !== d.replace(/[\s,]/g, '').length) throw new Error(`path 拆解失敗：${d.slice(0, 60)}…`)
  let out = ''
  let prevNumber = false
  for (const t of tokens) {
    if (/[A-Za-z]/.test(t)) {
      out += t
      prevNumber = false
      continue
    }
    const n = String(Math.round(Number(t) * 10 ** DECIMALS) / 10 ** DECIMALS).replace(/^(-?)0\./, '$1.')
    out += prevNumber && !n.startsWith('-') ? `,${n}` : n
    prevNumber = true
  }
  if (tokenize(out).length !== tokens.length) throw new Error(`path 縮短後的數字數量不同：${d.slice(0, 60)}…`)
  return out
}

const lines = []
for (const name of ICON_NAMES) {
  const Component = Phosphor[ICON_SOURCES[name]]
  if (!Component) {
    console.error(`Phosphor 沒有這個圖示：${ICON_SOURCES[name]}`)
    process.exit(1)
  }
  const svg = renderToStaticMarkup(createElement(Component, { weight: 'duotone' }))
  lines.push(`  ${name}: ${JSON.stringify(duotonePaths(name, svg))},`)
}

writeFileSync(
  OUT,
  `// 自動產生，請不要手動修改：node scripts/build-icons.mjs
// 圖示來自 Phosphor Icons（https://phosphoricons.com，MIT 授權，Copyright (c) 2023 Phosphor Icons），只取 Duotone 樣式（D90）。
// 每個圖示是 256×256 座標的兩個 path：[淡色色塊, 線條]（Phosphor 的 Duotone 把色塊畫成 opacity 0.2 的同色）。
import type { IconName } from '../game/icons.ts'

export const ICON_PATHS: Readonly<Record<IconName, readonly [light: string, line: string]>> = {
${lines.join('\n')}
}
`,
)
console.log(`產生了 ${ICON_NAMES.length} 個圖示 → src/components/icon-paths.ts`)

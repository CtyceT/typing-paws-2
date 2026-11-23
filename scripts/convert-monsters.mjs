// 把專案負責人生成的怪物圖（assets/monsters/monster-01.png～monster-12.png）轉成遊戲用的 WebP（D84）。
// 輸出到 src/assets/monsters/，Vite 會打包進網站；遊戲只在進戰鬥時下載那一場的 3 隻。
//
// 規格（D83）：512×512 PNG、透明背景、怪物全身置中、面向左邊。不符合的會列出來，但仍然照樣轉換（尺寸會縮放成 512×512）。
//
// 用法
//   node scripts/convert-monsters.mjs              轉換所有找得到的圖
//   node scripts/convert-monsters.mjs --quality 85 改變 WebP 品質（預設 80）
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import sharp from 'sharp'
import { MONSTER_IDS } from '../src/game/monsterProfile.ts'

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url))
const SRC_DIR = root('assets/monsters')
const OUT_DIR = root('src/assets/monsters')
const SIZE = 512

const { values: args } = parseArgs({ options: { quality: { type: 'string', default: '80' } } })
const quality = Number(args.quality)
if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
  console.error('--quality 要是 1～100 的整數')
  process.exit(1)
}

mkdirSync(OUT_DIR, { recursive: true })
const kb = (bytes) => `${Math.round(bytes / 1024)} kB`
let converted = 0
const missing = []
for (const id of MONSTER_IDS) {
  const src = `${SRC_DIR}/${id}.png`
  if (!existsSync(src)) {
    missing.push(id)
    continue
  }
  const meta = await sharp(src).metadata()
  const warnings = []
  if (meta.format !== 'png') warnings.push(`格式是 ${meta.format}，不是 PNG`)
  if (meta.width !== SIZE || meta.height !== SIZE) warnings.push(`尺寸 ${meta.width}×${meta.height}，不是 ${SIZE}×${SIZE}`)
  if (!meta.hasAlpha) warnings.push('沒有透明背景')
  const out = `${OUT_DIR}/${id}.webp`
  await sharp(src).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality, alphaQuality: 100 }).toFile(out)
  converted++
  console.log(`${warnings.length > 0 ? '!' : '✓'} ${id}　${kb(statSync(src).size)} → ${kb(statSync(out).size)}${warnings.length > 0 ? `　${warnings.join('、')}` : ''}`)
}
console.log(`\n轉換了 ${converted} 張（品質 ${quality}），輸出在 src/assets/monsters/`)
if (missing.length > 0) console.log(`還沒有圖的：${missing.join('、')}（遊戲會用佔位圖）`)

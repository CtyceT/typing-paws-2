// 怪物圖片（D84）：scripts/convert-monsters.mjs 產生的 WebP 打包進網站。
// 這裡只拿到網址（不會下載圖片），進戰鬥時再用 preloadMonsterImages 下載那一場的 3 隻。
import type { Monster, MonsterId } from '../game/index.ts'

const URLS = import.meta.glob<string>('../assets/monsters/*.webp', { eager: true, query: '?url', import: 'default' })

/** 某隻怪物的圖片網址；圖還沒放進來時是 undefined（畫面改用佔位圖） */
export function monsterImageUrl(id: MonsterId): string | undefined {
  return URLS[`../assets/monsters/${id}.webp`]
}

/** 先下載這一場三關的圖，換關時不用等 */
export function preloadMonsterImages(monsters: readonly Monster[]): void {
  for (const m of monsters) {
    const url = monsterImageUrl(m.id)
    if (url) new Image().src = url
  }
}

// AI 怪物（階段 6）：12 隻，4 個主題 × 小怪、小怪、魔王（D83）。
// 名字、台詞、弱點來自 LLM 產生並驗證過的 monster-profiles.json（scripts/gen-monsters.mjs）；
// 血量、傷害倍率依出場位置固定（沿用 1.0 版三關的數值）。
import type { TrainingTheme } from '../../supabase/functions/_shared/training/request.ts'
import PROFILE_FILE from './monster-profiles.json'
import { MONSTER_IDS, MONSTER_THEMES, MONSTERS_PER_THEME, monsterIdFor, type MonsterId, type MonsterProfile } from './monsterProfile.ts'
import type { Rng } from './rng.ts'

export { MONSTER_IDS, MONSTER_THEMES, MONSTERS_PER_THEME, monsterIdFor, validateMonsterProfile, validateThemeProfiles } from './monsterProfile.ts'
export type { MonsterId, MonsterProfile } from './monsterProfile.ts'

export interface Monster {
  id: MonsterId
  theme: TrainingTheme
  /** 圖片載入失敗時顯示的 emoji（ROADMAP 6.5） */
  emoji: string
  name: string
  /** 基礎血量（還要乘上難度的 hpScale） */
  hp: number
  /** 傷害倍率（乘上難度的 monsterDamage） */
  damageScale: number
  /** 出場台詞 */
  line: string
  /** 是否為魔王（畫面上會放大顯示） */
  boss: boolean
  /** 弱點屬性：1～2 個小寫字母（ROADMAP 6.6） */
  weakKeys: readonly string[]
}

/** 每一關（小怪、小怪、魔王）的血量與傷害倍率，和 1.0 版的三關相同 */
export const SLOT_STATS: readonly { hp: number; damageScale: number }[] = [
  { hp: 60, damageScale: 1.0 },
  { hp: 90, damageScale: 1.1 },
  { hp: 140, damageScale: 1.3 },
]

/** 圖片載入失敗時的 emoji，依 monster-profiles.json 的名字挑的；重新產生設定後要跟著檢查 */
export const FALLBACK_EMOJI: Readonly<Record<MonsterId, string>> = {
  'monster-01': '⏰',
  'monster-02': '🍞',
  'monster-03': '🫧',
  'monster-04': '🐭',
  'monster-05': '🦇',
  'monster-06': '🐉',
  'monster-07': '✨',
  'monster-08': '☄️',
  'monster-09': '🌀',
  'monster-10': '📄',
  'monster-11': '🖍️',
  'monster-12': '📝',
}

const profiles = (PROFILE_FILE as { monsters: MonsterProfile[] }).monsters

/** 全部 12 隻，依編號排列 */
export const MONSTERS: readonly Monster[] = profiles.map((p) => ({
  id: p.id,
  theme: p.theme,
  emoji: FALLBACK_EMOJI[p.id],
  name: p.name,
  line: p.line,
  boss: p.boss,
  weakKeys: p.weakKeys,
  ...SLOT_STATS[MONSTER_IDS.indexOf(p.id) % MONSTERS_PER_THEME],
}))

const byId = new Map(MONSTERS.map((m) => [m.id, m]))

export function monsterById(id: MonsterId): Monster {
  const m = byId.get(id)
  if (!m) throw new Error(`沒有這隻怪物：${id}`)
  return m
}

/** 一個主題的三關：小怪、小怪、魔王（例如太空：07 → 08 → 09） */
export function themeLineup(theme: TrainingTheme): readonly Monster[] {
  return Array.from({ length: MONSTERS_PER_THEME }, (_, slot) => monsterById(monsterIdFor(theme, slot)))
}

/** 經典闖關每場隨機抽一個主題（D84） */
export function randomTheme(rng: Rng): TrainingTheme {
  return MONSTER_THEMES[Math.min(MONSTER_THEMES.length - 1, Math.floor(rng() * MONSTER_THEMES.length))]
}

// AI 怪物設定（ROADMAP 6.2）：LLM 產生的名字、台詞、弱點屬性要先通過這裡的驗證才能放進遊戲。
// scripts/gen-monsters.mjs 用這份驗證 LLM 的輸出；monsters.test.ts 再用它檢查存進版控的 monster-profiles.json。
import { TRAINING_THEMES, type TrainingTheme } from '../../supabase/functions/_shared/training/request.ts'

/** 怪物的編號：monster-01～monster-12（D83） */
export const MONSTER_IDS = [
  'monster-01', 'monster-02', 'monster-03',
  'monster-04', 'monster-05', 'monster-06',
  'monster-07', 'monster-08', 'monster-09',
  'monster-10', 'monster-11', 'monster-12',
] as const
export type MonsterId = (typeof MONSTER_IDS)[number]

/** 每個主題 3 隻：小怪、小怪、魔王。主題順序和編號對應：01～03 日常、04～06 奇幻、07～09 太空、10～12 校園 */
export const MONSTERS_PER_THEME = 3
export const MONSTER_THEMES: readonly TrainingTheme[] = TRAINING_THEMES

/** 某個主題的第 slot 隻（0～2）的編號 */
export function monsterIdFor(theme: TrainingTheme, slot: number): MonsterId {
  return MONSTER_IDS[MONSTER_THEMES.indexOf(theme) * MONSTERS_PER_THEME + slot]
}

/** 一隻怪物的設定（LLM 產生，經過驗證） */
export interface MonsterProfile {
  id: MonsterId
  theme: TrainingTheme
  boss: boolean
  /** 繁中名字 */
  name: string
  /** 繁中出場台詞 */
  line: string
  /** 弱點屬性：1～2 個小寫字母。題目含這些字母時傷害加成（ROADMAP 6.6） */
  weakKeys: string[]
  /** 英文外觀描述，給專案負責人生圖時參考，遊戲裡不顯示 */
  look: string
}

export const PROFILE_LIMITS = {
  nameMin: 2,
  nameMax: 8,
  lineMin: 6,
  lineMax: 30,
  weakKeysMin: 1,
  weakKeysMax: 2,
  lookMax: 200,
} as const

/** 名字：中文字，可以夾一個英文字（例如「Typo 幽靈」），不能有標點和 emoji */
const NAME_RE = /^[\p{Script=Han}A-Za-z0-9 ]+$/u
/** 台詞：中文字、全形標點、可列印 ASCII 和「～」「…」，不能有 emoji */
const LINE_RE = /^[\p{Script=Han}\u3000-\u303f\uff01-\uff5e\u2026\u2014 -~]+$/u
/** 外觀描述：只能是可列印 ASCII */
const LOOK_RE = /^[ -~]+$/

const chars = (s: string) => [...s].length

/** LLM 常輸出排版用的標點（不斷行連字號、彎引號、破折號），外觀描述先換成 ASCII 再驗證 */
function asciiPunctuation(s: string): string {
  return s
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u00a0/g, ' ')
}

export type ProfileIssue =
  | 'not_object'
  | 'bad_name'
  | 'bad_line'
  | 'bad_weak_keys'
  | 'bad_look'

/**
 * 驗證一隻怪物的 LLM 輸出（{ name, line, weak_keys, look }），合格時補上編號、主題、是否魔王。
 * 字串會先去掉頭尾空白；弱點字母會轉小寫、去重複。
 */
export function validateMonsterProfile(raw: unknown, slot: { id: MonsterId; theme: TrainingTheme; boss: boolean }): { ok: true; profile: MonsterProfile } | { ok: false; issue: ProfileIssue } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, issue: 'not_object' }
  const r = raw as Record<string, unknown>
  const L = PROFILE_LIMITS

  const name = typeof r.name === 'string' ? r.name.trim().replace(/\s+/g, ' ') : ''
  if (chars(name) < L.nameMin || chars(name) > L.nameMax || !NAME_RE.test(name) || !/\p{Script=Han}/u.test(name)) return { ok: false, issue: 'bad_name' }

  const line = typeof r.line === 'string' ? r.line.trim() : ''
  if (chars(line) < L.lineMin || chars(line) > L.lineMax || !LINE_RE.test(line) || !/\p{Script=Han}/u.test(line)) return { ok: false, issue: 'bad_line' }

  const keysRaw = r.weak_keys ?? r.weakKeys
  if (!Array.isArray(keysRaw) || !keysRaw.every((k) => typeof k === 'string')) return { ok: false, issue: 'bad_weak_keys' }
  const weakKeys = [...new Set(keysRaw.map((k: string) => k.trim().toLowerCase()))]
  if (weakKeys.length < L.weakKeysMin || weakKeys.length > L.weakKeysMax || !weakKeys.every((k) => /^[a-z]$/.test(k))) return { ok: false, issue: 'bad_weak_keys' }

  const look = typeof r.look === 'string' ? asciiPunctuation(r.look).trim() : ''
  if (look === '' || look.length > L.lookMax || !LOOK_RE.test(look)) return { ok: false, issue: 'bad_look' }

  return { ok: true, profile: { ...slot, name, line, weakKeys, look } }
}

/**
 * 驗證一個主題的 3 隻（LLM 一次產生一個主題）。輸入是 { monsters: [...] }，依序是小怪、小怪、魔王。
 * 三隻的名字不能重複。
 */
export function validateThemeProfiles(raw: unknown, theme: TrainingTheme): { ok: true; profiles: MonsterProfile[] } | { ok: false; issue: ProfileIssue | 'bad_count' | 'duplicate_name'; index?: number } {
  const list = raw && typeof raw === 'object' ? (raw as { monsters?: unknown }).monsters : undefined
  if (!Array.isArray(list) || list.length !== MONSTERS_PER_THEME) return { ok: false, issue: 'bad_count' }
  const profiles: MonsterProfile[] = []
  for (const [i, item] of list.entries()) {
    const v = validateMonsterProfile(item, { id: monsterIdFor(theme, i), theme, boss: i === MONSTERS_PER_THEME - 1 })
    if (!v.ok) return { ok: false, issue: v.issue, index: i }
    profiles.push(v.profile)
  }
  if (new Set(profiles.map((p) => p.name)).size !== profiles.length) return { ok: false, issue: 'duplicate_name' }
  return { ok: true, profiles }
}

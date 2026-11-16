// 弱點特訓（ROADMAP 4.8～4.10）的純函式：決定要練哪些鍵、AI 失敗時從內建字庫挑字、結算時的前後比較。
// 請求格式、prompt 與驗證規則和 Edge Function 共用同一份（supabase/functions/_shared/training）。
import { MAX_TARGETS, isTargetKey, type TrainingTheme } from '../../supabase/functions/_shared/training/request.ts'
import { rankKeys, WEAKNESS_DEFAULTS, type KeyAggregate, type WeaknessOptions } from './analysis.ts'
import type { Difficulty } from './difficulty.ts'
import type { KeyStatKind, KeyStatRow } from './keystats.ts'
import { WORDS } from './words.ts'

export { MAX_TARGETS, MIN_ITEMS, TARGET_ITEM_COUNT, TRAINING_THEMES, isTargetKey, parseTrainingRequest } from '../../supabase/functions/_shared/training/request.ts'
export type { TrainingRequest, TrainingTheme } from '../../supabase/functions/_shared/training/request.ts'
export { validateItems } from '../../supabase/functions/_shared/training/validate.ts'

/** 每天可以請 AI 出題幾次（實際的限制在 Edge Function，這裡只用來顯示說明） */
export const TRAINING_DAILY_LIMIT = 10

export const THEME_INFO: Readonly<Record<TrainingTheme, { label: string; icon: string }>> = {
  daily: { label: '日常', icon: '☕' },
  fantasy: { label: '奇幻', icon: '🐉' },
  space: { label: '太空', icon: '🚀' },
  school: { label: '校園', icon: '🎒' },
}
export const DEFAULT_THEME: TrainingTheme = 'daily'

/** 這次特訓要練的一個鍵 */
export interface TrainingTarget {
  kind: KeyStatKind
  key: string
  /** 之前的錯誤率（0～1）與次數 */
  errorRate: number
  attempts: number
}

/**
 * 某個難度的特訓計畫。
 * - insufficient：按鍵資料還不夠，先去打經典闖關
 * - ready：可以開始；relative 是 true 表示沒有明顯的弱點，練的是「相對比較弱」的鍵
 */
export type TrainingPlan =
  | { status: 'insufficient'; totalAttempts: number; needed: number }
  | { status: 'ready'; targets: TrainingTarget[]; relative: boolean }

/**
 * 決定這次要練哪些鍵：最弱的前 3 個。
 * 簡單、普通的題目只有小寫字母，所以只挑字母與字母組合；困難才會挑數字與符號。
 * 沒有任何鍵達到弱點門檻時，改挑分數最高（相對最弱）的 3 個，讓特訓永遠有東西可以練。
 */
export function planTraining(aggregates: readonly KeyAggregate[], difficulty: Difficulty, options: Partial<WeaknessOptions> = {}): TrainingPlan {
  const o = { ...WEAKNESS_DEFAULTS, ...options }
  const totalAttempts = aggregates.reduce((n, a) => n + (a.kind === 'char' ? a.attempts : 0), 0)
  const candidates = totalAttempts < o.minTotalAttempts ? [] : rankKeys(aggregates, o).filter((k) => isTargetKey(k.key, difficulty))
  if (candidates.length === 0) return { status: 'insufficient', totalAttempts, needed: o.minTotalAttempts }
  const weak = candidates.filter((k) => k.weak)
  const picked = (weak.length > 0 ? weak : candidates).slice(0, MAX_TARGETS)
  return {
    status: 'ready',
    targets: picked.map(({ kind, key, errorRate, attempts }) => ({ kind, key, errorRate, attempts })),
    relative: weak.length === 0,
  }
}

/** 內建字庫裡含弱點鍵的字至少要有這麼多，才只用它們；不夠的話用整個字庫，避免一直重複同樣幾個字 */
export const BUILTIN_MIN_MATCHES = 10

/** AI 出題失敗時的備用題目：從內建字庫挑出含弱點鍵的字（不分大小寫） */
export function builtinTrainingWords(difficulty: Difficulty, targets: readonly string[]): readonly string[] {
  const matches = WORDS[difficulty].filter((word) => targets.some((t) => word.toLowerCase().includes(t)))
  return matches.length >= BUILTIN_MIN_MATCHES ? matches : WORDS[difficulty]
}

// ---- 特訓成效回饋（ROADMAP 4.10） ----

/**
 * 和之前比的結果：better 進步、worse 退步、same 差不多（差距不到 1 個百分點）、
 * new 之前沒有資料、none 這場沒有打到這個鍵
 */
export type TrainingChange = 'better' | 'worse' | 'same' | 'new' | 'none'

export interface TrainingFeedbackRow {
  kind: KeyStatKind
  key: string
  /** 這一場 */
  attempts: number
  errors: number
  /** 這一場的錯誤率（0～1）；沒打到是 null */
  rate: number | null
  /** 這一場之前的平均錯誤率；之前沒有資料是 null */
  beforeRate: number | null
  change: TrainingChange
}

const SAME_MARGIN = 0.01

/** 比較每個特訓目標「這一場」和「之前的平均」的錯誤率。before 是這一場之前的統計，不能包含這一場 */
export function trainingFeedback(
  targets: readonly Pick<TrainingTarget, 'kind' | 'key'>[],
  session: readonly Pick<KeyStatRow, 'kind' | 'key' | 'attempts' | 'errors'>[],
  before: readonly KeyAggregate[],
): TrainingFeedbackRow[] {
  return targets.map(({ kind, key }) => {
    const now = session.find((r) => r.kind === kind && r.key === key)
    const prev = before.find((a) => a.kind === kind && a.key === key)
    const attempts = now?.attempts ?? 0
    const errors = now?.errors ?? 0
    const rate = attempts > 0 ? errors / attempts : null
    const beforeRate = prev && prev.attempts > 0 ? prev.errorRate : null
    let change: TrainingChange
    if (rate === null) change = 'none'
    else if (beforeRate === null) change = 'new'
    else if (Math.abs(rate - beforeRate) < SAME_MARGIN) change = 'same'
    else change = rate < beforeRate ? 'better' : 'worse'
    return { kind, key, attempts, errors, rate, beforeRate, change }
  })
}

const percent = (rate: number) => `${Math.round(rate * 1000) / 10}%`

/** 結算畫面上每個特訓目標的文字：這一場的數字、之前的平均、變化 */
export function trainingFeedbackText(row: TrainingFeedbackRow): { now: string; before: string; change: string } {
  const now = row.rate === null ? '這場沒有打到' : `這場錯誤率 ${percent(row.rate)}（打 ${row.attempts} 次、錯 ${row.errors} 次）`
  const before = row.beforeRate === null ? '之前沒有資料' : `之前平均 ${percent(row.beforeRate)}`
  const diff = row.rate !== null && row.beforeRate !== null ? percent(Math.abs(row.rate - row.beforeRate)) : ''
  const change = { better: `📉 進步 ${diff}`, worse: `📈 多錯 ${diff}`, same: '➖ 差不多', new: '🆕 第一次統計', none: '—' }[row.change]
  return { now, before, change }
}

// 弱點特訓的請求格式。這個資料夾（_shared/training）的程式不依賴 Deno 或瀏覽器，
// Edge Function、前端（透過 src/game/training.ts）和 Node 腳本共用同一份，並由 Vitest 測試。

export type TrainingDifficulty = 'easy' | 'normal' | 'hard'
export const TRAINING_DIFFICULTIES: readonly TrainingDifficulty[] = ['easy', 'normal', 'hard']

export const TRAINING_THEMES = ['daily', 'fantasy', 'space', 'school'] as const
export type TrainingTheme = (typeof TRAINING_THEMES)[number]

/** 一次請求最多送幾個弱點（只送最弱的幾個：題目比較集中，快取也比較容易命中） */
export const MAX_TARGETS = 3
/** 所有難度裡最多的題數（prompt v1 固定要求這個數，v1 不再改動） */
export const TARGET_ITEM_COUNT = 30
/**
 * 各難度請 LLM 生成幾題；回傳給前端的題數上限也是這個數（D80）。
 * 簡單難度是 3～6 個字母的短單字，選擇少，要 30 題時容易大量重複，所以只要 20 題。
 */
export const ITEM_COUNT: Readonly<Record<TrainingDifficulty, number>> = { easy: 20, normal: TARGET_ITEM_COUNT, hard: TARGET_ITEM_COUNT }
/** 驗證後至少要剩幾題才算合格。簡單難度配上 q、z、x 這類字母時真實單字不多，門檻比較低 */
export const MIN_ITEMS: Readonly<Record<TrainingDifficulty, number>> = { easy: 10, normal: 15, hard: 15 }
/** 每一題的長度（字元數）。簡單、普通是一個小寫單字；困難是片語，另外限制最多 4 個字 */
export const ITEM_LENGTH: Readonly<Record<TrainingDifficulty, { min: number; max: number }>> = {
  easy: { min: 3, max: 6 },
  normal: { min: 5, max: 8 },
  hard: { min: 6, max: 24 },
}
export const HARD_MAX_WORDS = 4

export interface TrainingRequest {
  difficulty: TrainingDifficulty
  theme: TrainingTheme
  /** 要練的鍵：小寫字母、兩個小寫字母的組合，困難難度另外允許數字與符號。已排序、不重複 */
  weaknesses: string[]
}

/**
 * 某個鍵能不能當這個難度的特訓目標。
 * 簡單、普通的題目只有小寫字母，所以只接受字母與字母組合；困難另外接受單一個數字或符號（不含空白與大寫）。
 */
export function isTargetKey(key: unknown, difficulty: TrainingDifficulty): key is string {
  if (typeof key !== 'string') return false
  if (/^[a-z]{1,2}$/.test(key)) return true
  return difficulty === 'hard' && /^[\x21-\x7E]$/.test(key) && !/[A-Za-z]/.test(key)
}

/** 檢查並整理請求內容（弱點排序、去重複）；任何一項不在允許範圍內就回傳 null */
export function parseTrainingRequest(body: unknown): TrainingRequest | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null
  const { difficulty, theme, weaknesses } = body as Record<string, unknown>
  if (!TRAINING_DIFFICULTIES.includes(difficulty as TrainingDifficulty)) return null
  if (!TRAINING_THEMES.includes(theme as TrainingTheme)) return null
  if (!Array.isArray(weaknesses) || weaknesses.length === 0 || weaknesses.length > MAX_TARGETS * 2) return null
  const d = difficulty as TrainingDifficulty
  if (!weaknesses.every((w) => isTargetKey(w, d))) return null
  const unique = [...new Set(weaknesses as string[])].sort()
  if (unique.length > MAX_TARGETS) return null
  return { difficulty: d, theme: theme as TrainingTheme, weaknesses: unique }
}

/** 題庫快取的鍵：prompt 版本＋難度＋主題＋排序後的弱點。換了 prompt 版本就不會拿到舊版生成的題目 */
export function trainingCacheKey(req: TrainingRequest, promptVersion: string): string {
  return [promptVersion, req.difficulty, req.theme, [...req.weaknesses].sort().map((w) => encodeURIComponent(w)).join('+')].join('|')
}

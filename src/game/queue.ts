import type { Rng } from './rng.ts'

/** 出題時要避開的最近題數 */
export const RECENT_LIMIT = 8
/** 佇列裡預先準備的題數（畫面只預覽前 PREVIEW_COUNT 個） */
export const UPCOMING_SIZE = 3
/** 畫面上「下一個」預覽的題數 */
export const PREVIEW_COUNT = 2

export interface WordQueue {
  /** 目前要打的字 */
  current: string
  /** 接下來的字，依出場順序 */
  upcoming: readonly string[]
  /** 最近選過的字（含 current 與 upcoming），最多 RECENT_LIMIT 個 */
  recent: readonly string[]
}

/**
 * 從字庫隨機選一個不在 recent 裡的字。
 * 字庫比 recent 小時只避開最近的幾個，確保永遠選得出來，且不會和上一個字相同
 * （除非字庫只有一個字）。
 */
export function pickWord(words: readonly string[], recent: readonly string[], rng: Rng): string {
  if (words.length === 0) throw new Error('字庫是空的')
  const avoid = new Set(recent.slice(-Math.min(RECENT_LIMIT, words.length - 1)))
  const candidates = avoid.size > 0 ? words.filter((w) => !avoid.has(w)) : words
  const pool = candidates.length > 0 ? candidates : words
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))]
}

function pushRecent(recent: readonly string[], word: string): string[] {
  return [...recent, word].slice(-RECENT_LIMIT)
}

/** 建立新的出題佇列：選出第一個字並補滿後續題目 */
export function createQueue(words: readonly string[], rng: Rng): WordQueue {
  let recent: string[] = []
  const picked: string[] = []
  for (let i = 0; i < UPCOMING_SIZE + 1; i++) {
    const w = pickWord(words, recent, rng)
    picked.push(w)
    recent = pushRecent(recent, w)
  }
  return { current: picked[0], upcoming: picked.slice(1), recent }
}

/** 換下一個字：upcoming 的第一個變成 current，再補一個新字到最後 */
export function advanceQueue(queue: WordQueue, words: readonly string[], rng: Rng): WordQueue {
  const [next, ...rest] = queue.upcoming
  const added = pickWord(words, queue.recent, rng)
  return { current: next, upcoming: [...rest, added], recent: pushRecent(queue.recent, added) }
}

/** 畫面上要預覽的後兩個字 */
export function previewWords(queue: WordQueue): readonly string[] {
  return queue.upcoming.slice(0, PREVIEW_COUNT)
}

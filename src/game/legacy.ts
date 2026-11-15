import { DIFFICULTIES, DIFFICULTY_ORDER, type Difficulty } from './difficulty.ts'
import { HERO_ORDER, type HeroId } from './heroes.ts'
import { HISTORY_LIMIT, type BestRecords, type GameRecord, type Records } from './records.ts'

/** 從 1.0 版（作業五）的紀錄轉出來、可以匯入 2.0 的資料 */
export interface LegacyImport {
  /** 1.0 選的勇者；沒選過或不合法是 null */
  hero: HeroId | null
  records: Records
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)
const isDifficulty = (v: unknown): v is Difficulty => typeof v === 'string' && v in DIFFICULTIES

/**
 * 解析 1.0 版存在 localStorage `typingPaws.v1` 的 JSON 字串。
 * 1.0 的格式：{ avatar?, best: { [難度]: { score, wpm, combo, acc, clears } },
 *              history: [{ t, diff, win, wpm, acc, combo, score, stage }] }
 * 沒有資料、格式不對、或沒有任何值得匯入的內容時回傳 null。這個函式只轉換資料，不碰 localStorage。
 */
export function parseLegacyStore(raw: string | null): LegacyImport | null {
  if (!raw) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isObject(data)) return null

  const hero = HERO_ORDER.find((h) => h === data.avatar) ?? null

  const best: BestRecords = {}
  if (isObject(data.best)) {
    for (const d of DIFFICULTY_ORDER) {
      const b = data.best[d]
      if (!isObject(b) || num(b.score) <= 0) continue
      best[d] = { score: num(b.score), wpm: num(b.wpm), maxCombo: num(b.combo), accuracy: num(b.acc), clears: num(b.clears) }
    }
  }

  const history: GameRecord[] = []
  if (Array.isArray(data.history)) {
    data.history.forEach((h: unknown, i: number) => {
      if (!isObject(h) || !isDifficulty(h.diff) || typeof h.t !== 'number' || !Number.isFinite(h.t)) return
      history.push({
        id: `v1-${h.t}-${i}`,
        playedAt: h.t,
        mode: 'classic',
        difficulty: h.diff,
        win: h.win === true,
        wpm: num(h.wpm),
        accuracy: num(h.acc),
        maxCombo: num(h.combo),
        score: num(h.score),
        damage: null,
        durationMs: null,
        stage: num(h.stage) || 1,
      })
    })
  }

  if (!hero && history.length === 0 && Object.keys(best).length === 0) return null
  return { hero, records: { best, history: history.slice(-HISTORY_LIMIT) } }
}

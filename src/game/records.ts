import type { IconText } from './icons.ts'
import { DIFFICULTIES, DIFFICULTY_ORDER, type Difficulty } from './difficulty.ts'
import type { GameMode } from './modes.ts'
import type { BattleResult } from './result.ts'

/**
 * 一場的戰績。刻意設計成扁平的一列（有 id 與時間戳、沒有巢狀），之後可以直接搬進資料庫。
 */
export interface GameRecord {
  id: string
  /** 結束時間（毫秒時間戳） */
  playedAt: number
  mode: GameMode
  difficulty: Difficulty
  win: boolean
  wpm: number
  /** 準確率（百分比） */
  accuracy: number
  maxCombo: number
  score: number
  /** 總傷害；從 1.0 匯入的舊紀錄沒有這個數字 */
  damage: number | null
  /** 實際戰鬥的毫秒數；從 1.0 匯入的舊紀錄沒有這個數字 */
  durationMs: number | null
  /** 打到第幾關（從 1 開始） */
  stage: number
}

/** 某個難度的最佳紀錄（各項分別取歷來最好的） */
export interface BestRecord {
  score: number
  /** 通關時的最快 WPM；還沒通關過是 0 */
  wpm: number
  maxCombo: number
  /** 通關時的最高準確率；還沒通關過是 0 */
  accuracy: number
  /** 通關次數 */
  clears: number
}

export type BestRecords = Partial<Record<Difficulty, BestRecord>>

export interface Records {
  best: BestRecords
  /** 由舊到新，最多 HISTORY_LIMIT 場 */
  history: readonly GameRecord[]
}

/** 歷史戰績最多保留幾場 */
export const HISTORY_LIMIT = 30
/** 主選單戰績表顯示最近幾場 */
export const RECENT_COUNT = 6

export const EMPTY_RECORDS: Records = { best: {}, history: [] }

const EMPTY_BEST: BestRecord = { score: 0, wpm: 0, maxCombo: 0, accuracy: 0, clears: 0 }

/** 這一場破了什麼紀錄：wpm（通關且 WPM 更快）優先於 score（分數更高）；沒破或 0 分是 null */
export type NewRecordKind = 'wpm' | 'score' | null

/** 把一場的成績併進最佳紀錄 */
export function updateBest(prev: BestRecord | undefined, result: BattleResult): BestRecord {
  const p = prev ?? EMPTY_BEST
  return {
    score: Math.max(p.score, result.score),
    wpm: result.win ? Math.max(p.wpm, result.wpm) : p.wpm,
    maxCombo: Math.max(p.maxCombo, result.maxCombo),
    accuracy: result.win ? Math.max(p.accuracy, result.accuracy) : p.accuracy,
    clears: p.clears + (result.win ? 1 : 0),
  }
}

export function newRecordKind(prev: BestRecord | undefined, result: BattleResult): NewRecordKind {
  const p = prev ?? EMPTY_BEST
  if (result.score <= 0) return null
  if (result.win && result.wpm > p.wpm) return 'wpm'
  if (result.score > p.score) return 'score'
  return null
}

/**
 * 把一場的成績記進紀錄：更新該難度的最佳紀錄，並加到歷史的最後（超過上限就丟掉最舊的）。
 * 弱點特訓的場次只記進歷史，不算最佳紀錄：題目是針對弱點出的，和經典闖關的字庫不同，放在一起比不公平。
 */
export function addResult(records: Records, result: BattleResult, meta: { id: string; playedAt: number; mode?: GameMode }): Records {
  const record: GameRecord = {
    id: meta.id,
    playedAt: meta.playedAt,
    mode: meta.mode ?? 'classic',
    difficulty: result.difficulty,
    win: result.win,
    wpm: result.wpm,
    accuracy: result.accuracy,
    maxCombo: result.maxCombo,
    score: result.score,
    damage: result.damage,
    durationMs: result.durationMs,
    stage: result.stage,
  }
  return {
    best: record.mode === 'training' ? records.best : { ...records.best, [result.difficulty]: updateBest(records.best[result.difficulty], result) },
    history: [...records.history, record].slice(-HISTORY_LIMIT),
  }
}

/** 合併兩份紀錄（匯入舊紀錄用）：最佳紀錄各項取較好的、通關次數相加；歷史依時間排序、同 id 只留一筆 */
export function mergeRecords(a: Records, b: Records): Records {
  const best: BestRecords = {}
  for (const d of DIFFICULTY_ORDER) {
    const [x, y] = [a.best[d], b.best[d]]
    if (!x && !y) continue
    const [p, q] = [x ?? EMPTY_BEST, y ?? EMPTY_BEST]
    best[d] = {
      score: Math.max(p.score, q.score),
      wpm: Math.max(p.wpm, q.wpm),
      maxCombo: Math.max(p.maxCombo, q.maxCombo),
      accuracy: Math.max(p.accuracy, q.accuracy),
      clears: p.clears + q.clears,
    }
  }
  const byId = new Map<string, GameRecord>()
  for (const r of [...a.history, ...b.history]) byId.set(r.id, r)
  const history = [...byId.values()].sort((x, y) => x.playedAt - y.playedAt).slice(-HISTORY_LIMIT)
  return { best, history }
}

// ---- 讀取時的驗證：localStorage 的內容可能壞掉或被改過，不合格的直接丟掉 ----

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const isDifficulty = (v: unknown): v is Difficulty => typeof v === 'string' && v in DIFFICULTIES
const isNullableCount = (v: unknown): v is number | null => v === null || isCount(v)

export function parseBestRecord(v: unknown): BestRecord | null {
  if (!isObject(v)) return null
  const { score, wpm, maxCombo, accuracy, clears } = v
  if (!isCount(score) || !isCount(wpm) || !isCount(maxCombo) || !isCount(accuracy) || !isCount(clears)) return null
  return { score, wpm, maxCombo, accuracy, clears }
}

export function parseGameRecord(v: unknown): GameRecord | null {
  if (!isObject(v)) return null
  const { id, playedAt, mode, difficulty, win, wpm, accuracy, maxCombo, score, damage, durationMs, stage } = v
  if (typeof id !== 'string' || id === '' || !isCount(playedAt) || !isDifficulty(difficulty) || typeof win !== 'boolean') return null
  if (mode !== 'classic' && mode !== 'story' && mode !== 'training' && mode !== 'daily') return null
  if (!isCount(wpm) || !isCount(accuracy) || !isCount(maxCombo) || !isCount(score) || !isCount(stage)) return null
  if (!isNullableCount(damage) || !isNullableCount(durationMs)) return null
  return { id, playedAt, mode, difficulty, win, wpm, accuracy, maxCombo, score, damage, durationMs, stage }
}

/** 把 localStorage 讀出來（JSON.parse 之後）的值整理成合法的紀錄，壞掉的部分略過 */
export function parseRecords(best: unknown, history: unknown): Records {
  const outBest: BestRecords = {}
  if (isObject(best)) {
    for (const d of DIFFICULTY_ORDER) {
      const parsed = parseBestRecord(best[d])
      if (parsed) outBest[d] = parsed
    }
  }
  const rows = Array.isArray(history) ? history.map(parseGameRecord).filter((r): r is GameRecord => r !== null) : []
  return { best: outBest, history: rows.slice(-HISTORY_LIMIT) }
}

export function hasRecords(records: Records): boolean {
  return records.history.length > 0 || Object.keys(records.best).length > 0
}

// ---- 顯示用 ----

/** 難度卡片上的最佳紀錄（兩行，各有一個圖示）；還沒有分數時回傳 null */
export function bestSummary(best: BestRecord | undefined): [IconText, IconText] | null {
  if (!best || best.score <= 0) return null
  return [
    { icon: 'medal', text: `最高分 ${best.score} ・ ${best.clears > 0 ? `最快 ${best.wpm} WPM` : '尚未通關'}` },
    { icon: 'fire', text: `最高 Combo ${best.maxCombo} ・ 通關 ${best.clears} 次` },
  ]
}

/** 戰績表要顯示的最近幾場，新的在前 */
export function recentHistory(history: readonly GameRecord[], count = RECENT_COUNT): GameRecord[] {
  return history.slice(-count).reverse()
}

/** 戰績表的時間欄：月/日 時:分（使用者的當地時間） */
export function formatPlayedAt(playedAt: number): string {
  const d = new Date(playedAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 戰績表的結果欄（D87）：圖示加文字 */
export function recordOutcome(record: Pick<GameRecord, 'win' | 'stage'>): IconText {
  return record.win ? { icon: 'trophy', text: '通關' } : { icon: 'heartBreak', text: `第 ${record.stage} 關倒下` }
}

/**
 * 雲端同步用的純函式（ROADMAP 3.5～3.7）：本機資料和資料表的列互相轉換、決定要上傳什麼、同步狀態的文字。
 * 這裡不碰網路；真正呼叫 Supabase 的程式在 src/cloud/data.ts。
 */
import { DIFFICULTY_ORDER, type Difficulty } from './difficulty.ts'
import type { KeyStatKind, KeyStatRow } from './keystats.ts'
import type { GameMode } from './modes.ts'
import type { BestRecords, GameRecord, Records } from './records.ts'

// ---- 資料表的列（欄位名稱和 supabase/migrations 裡的相同） ----

export interface GameRecordRow {
  user_id: string
  id: string
  /** ISO 8601 字串 */
  played_at: string
  mode: GameMode
  difficulty: Difficulty
  win: boolean
  wpm: number
  accuracy: number
  max_combo: number
  score: number
  damage: number | null
  duration_ms: number | null
  stage: number
}

export interface BestRecordRow {
  user_id: string
  difficulty: Difficulty
  score: number
  wpm: number
  max_combo: number
  accuracy: number
  clears: number
}

export interface KeyStatDbRow {
  user_id: string
  id: string
  session_id: string
  played_at: string
  kind: KeyStatKind
  key: string
  attempts: number
  errors: number
  timed_count: number
  total_ms: number
}

/** 資料表欄位的上限（和 migration 的 check 相同）。上傳前先夾到範圍內，免得一筆怪資料讓整批上傳一直失敗 */
export const DB_LIMITS = { wpm: 400, int: 2147483647, stage: 100 } as const

const clampInt = (v: number, max: number = DB_LIMITS.int, min = 0) => Math.min(max, Math.max(min, Math.round(v)))
const clampAccuracy = (v: number) => Math.min(100, Math.max(0, Math.round(v * 10) / 10))
/** 毫秒時間戳 → ISO 字串；超出 Date 範圍時夾到邊界，不會丟出例外 */
export const toIsoTime = (ms: number) => new Date(Math.min(8.64e15, Math.max(0, ms))).toISOString()

export function toGameRecordRow(r: GameRecord, userId: string): GameRecordRow {
  return {
    user_id: userId,
    id: r.id,
    played_at: toIsoTime(r.playedAt),
    mode: r.mode,
    difficulty: r.difficulty,
    win: r.win,
    wpm: clampInt(r.wpm, DB_LIMITS.wpm),
    accuracy: clampAccuracy(r.accuracy),
    max_combo: clampInt(r.maxCombo),
    score: clampInt(r.score),
    damage: r.damage === null ? null : clampInt(r.damage),
    duration_ms: r.durationMs === null ? null : clampInt(r.durationMs),
    stage: clampInt(r.stage, DB_LIMITS.stage, 1),
  }
}

export function toBestRecordRows(best: BestRecords, userId: string): BestRecordRow[] {
  return DIFFICULTY_ORDER.flatMap((difficulty) => {
    const b = best[difficulty]
    if (!b) return []
    return [
      {
        user_id: userId,
        difficulty,
        score: clampInt(b.score),
        wpm: clampInt(b.wpm, DB_LIMITS.wpm),
        max_combo: clampInt(b.maxCombo),
        accuracy: clampAccuracy(b.accuracy),
        clears: clampInt(b.clears),
      },
    ]
  })
}

export function toKeyStatDbRow(r: KeyStatRow, userId: string): KeyStatDbRow {
  const attempts = clampInt(r.attempts)
  return {
    user_id: userId,
    id: r.id,
    session_id: r.sessionId,
    played_at: toIsoTime(r.playedAt),
    kind: r.kind,
    key: r.key,
    attempts,
    errors: clampInt(r.errors, attempts),
    timed_count: clampInt(r.timedCount, attempts),
    total_ms: clampInt(r.totalMs),
  }
}

// ---- 還沒上傳的場次 ----

/** 資料表對 id 長度的限制；超過的（正常不會發生）不上傳 */
const MAX_RECORD_ID = 80

export interface PendingUpload {
  records: GameRecord[]
  /** 只包含上面那些場次的統計（資料表有外鍵，統計一定要跟著場次） */
  keyStats: KeyStatRow[]
  /** 列在待上傳清單裡、但本機已經找不到的場次（被 30 場上限擠掉了）：沒辦法上傳，直接從清單移除 */
  gone: string[]
}

/** 從待上傳的場次 id 找出實際要上傳的場次與按鍵統計 */
export function pendingUpload(records: Records, keyStats: readonly KeyStatRow[], pendingIds: readonly string[]): PendingUpload {
  const wanted = new Set(pendingIds)
  const found = records.history.filter((r) => wanted.has(r.id) && r.id.length <= MAX_RECORD_ID)
  const ids = new Set(found.map((r) => r.id))
  return {
    records: found,
    keyStats: keyStats.filter((k) => ids.has(k.sessionId)),
    gone: pendingIds.filter((id) => !ids.has(id)),
  }
}

/** 把一批列切成每次最多 size 筆（一次上傳太多列會超過請求大小限制） */
export function chunk<T>(rows: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}

// ---- 同步狀態 ----

/** idle：沒有在同步；syncing：同步中；failed：上一次同步失敗（多半是斷網） */
export type SyncPhase = 'idle' | 'syncing' | 'failed'

export interface SyncStatus {
  /** ok：已同步；busy：同步中；warn：有資料還沒同步 */
  tone: 'ok' | 'busy' | 'warn'
  text: string
}

/** 主選單帳號列上的同步狀態 */
export function syncStatus(phase: SyncPhase, pendingCount: number): SyncStatus {
  if (phase === 'syncing') return { tone: 'busy', text: '🔄 同步中…' }
  if (pendingCount > 0) return { tone: 'warn', text: `⚠️ ${pendingCount} 場尚未同步` }
  if (phase === 'failed') return { tone: 'warn', text: '⚠️ 連不上雲端' }
  return { tone: 'ok', text: '☁️ 已同步' }
}

/** 結算畫面上，這一場有沒有存到雲端 */
export function resultSyncStatus(phase: SyncPhase, stillPending: boolean): SyncStatus {
  if (!stillPending) return { tone: 'ok', text: '☁️ 這場已存到雲端' }
  if (phase === 'syncing') return { tone: 'busy', text: '🔄 正在存到雲端…' }
  return { tone: 'warn', text: '⚠️ 這場尚未同步到雲端（已先存在這個瀏覽器，連上網路後會自動補傳）' }
}

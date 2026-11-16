/**
 * 雲端同步用的純函式（ROADMAP 3.5～3.7）：本機資料和資料表的列互相轉換、決定要上傳什麼、同步狀態的文字。
 * 這裡不碰網路；真正呼叫 Supabase 的程式在 src/cloud/data.ts。
 */
import { DIFFICULTY_ORDER, type Difficulty } from './difficulty.ts'
import { toHeroId, type HeroId } from './heroes.ts'
import { appendSessionStats, parseKeyStats, type KeyStatKind, type KeyStatRow } from './keystats.ts'
import type { GameMode } from './modes.ts'
import { HISTORY_LIMIT, mergeRecords, parseBestRecord, parseGameRecord, type BestRecord, type BestRecords, type GameRecord, type Records } from './records.ts'

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

// ---- 資料表的列 → 本機資料（ROADMAP 3.6）。雲端回來的東西一樣要驗證，不合格的列直接丟掉 ----

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
/** numeric 欄位有時候會以字串回來 */
const num = (v: unknown): unknown => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v)
const time = (v: unknown): unknown => (typeof v === 'string' ? Date.parse(v) : v)

export function fromGameRecordRow(row: unknown): GameRecord | null {
  if (!isObject(row)) return null
  return parseGameRecord({
    id: row.id,
    playedAt: time(row.played_at),
    mode: row.mode,
    difficulty: row.difficulty,
    win: row.win,
    wpm: num(row.wpm),
    accuracy: num(row.accuracy),
    maxCombo: num(row.max_combo),
    score: num(row.score),
    damage: num(row.damage),
    durationMs: num(row.duration_ms),
    stage: num(row.stage),
  })
}

export function fromBestRecordRows(rows: unknown): BestRecords {
  const best: BestRecords = {}
  if (!Array.isArray(rows)) return best
  for (const row of rows) {
    if (!isObject(row)) continue
    const parsed = parseBestRecord({ score: num(row.score), wpm: num(row.wpm), maxCombo: num(row.max_combo), accuracy: num(row.accuracy), clears: num(row.clears) })
    const difficulty = DIFFICULTY_ORDER.find((d) => d === row.difficulty)
    if (parsed && difficulty) best[difficulty] = parsed
  }
  return best
}

export function fromKeyStatDbRows(rows: unknown): KeyStatRow[] {
  if (!Array.isArray(rows)) return []
  return parseKeyStats(
    rows.filter(isObject).map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      playedAt: time(row.played_at),
      kind: row.kind,
      key: row.key,
      attempts: num(row.attempts),
      errors: num(row.errors),
      timedCount: num(row.timed_count),
      totalMs: num(row.total_ms),
    })),
  )
}

/** 從雲端讀回來的一份資料：最近 HISTORY_LIMIT 場、它們的按鍵統計、最佳紀錄、勇者 */
export interface CloudSnapshot {
  best: BestRecords
  history: GameRecord[]
  keyStats: KeyStatRow[]
  /** 還沒選過是 null */
  hero: HeroId | null
}

/** 把查詢結果整理成 CloudSnapshot（每一部分各自驗證） */
export function toCloudSnapshot(raw: { best: unknown; history: unknown; keyStats: unknown; hero: unknown }): CloudSnapshot {
  const history = Array.isArray(raw.history) ? raw.history.map(fromGameRecordRow).filter((r): r is GameRecord => r !== null) : []
  return {
    best: fromBestRecordRows(raw.best),
    history: history.sort((a, b) => a.playedAt - b.playedAt).slice(-HISTORY_LIMIT),
    keyStats: fromKeyStatDbRows(raw.keyStats),
    hero: typeof raw.hero === 'string' && toHeroId(raw.hero) === raw.hero ? raw.hero : null,
  }
}

/** 同一個帳號的兩份最佳紀錄合併：每一項取較好的。通關次數也是取較大值（兩份是同一批場次的不同快照，相加會重複計算） */
export function mergeBestSameAccount(a: BestRecords, b: BestRecords): BestRecords {
  const out: BestRecords = {}
  for (const d of DIFFICULTY_ORDER) {
    const [x, y] = [a[d], b[d]]
    if (!x && !y) continue
    const max = (pick: (r: BestRecord) => number) => Math.max(x ? pick(x) : 0, y ? pick(y) : 0)
    out[d] = { score: max((r) => r.score), wpm: max((r) => r.wpm), maxCombo: max((r) => r.maxCombo), accuracy: max((r) => r.accuracy), clears: max((r) => r.clears) }
  }
  return out
}

export interface LocalSnapshot {
  records: Records
  keyStats: readonly KeyStatRow[]
  /** 還沒上傳的場次 id */
  pending: readonly string[]
  /** 本機的最佳紀錄是不是還有沒上傳的變動 */
  bestDirty: boolean
}

/**
 * 把雲端讀回來的資料和本機的合併，結果就是本機要顯示、要存的內容。
 *
 * 規則是「雲端說了算，但還沒上傳的留著」：
 * - 場次與統計：雲端有的全收；本機有、雲端沒有的，只留還沒上傳的（其他的不是在別台裝置被清除了，就是已經排不進最近 30 場）。
 * - 最佳紀錄：本機沒有待上傳的變動時直接用雲端的（別台裝置清除紀錄後，這裡也會跟著清）；有的話每一項取較好的。
 */
export function mergeCloud(local: LocalSnapshot, cloud: CloudSnapshot): { records: Records; keyStats: KeyStatRow[] } {
  const pending = new Set(local.pending)
  const byId = new Map<string, GameRecord>()
  for (const r of cloud.history) byId.set(r.id, r)
  for (const r of local.records.history) if (pending.has(r.id)) byId.set(r.id, r)
  const history = [...byId.values()].sort((a, b) => a.playedAt - b.playedAt).slice(-HISTORY_LIMIT)

  const stats = new Map<string, KeyStatRow>()
  for (const k of cloud.keyStats) stats.set(k.id, k)
  for (const k of local.keyStats) if (pending.has(k.sessionId)) stats.set(k.id, k)

  const best = local.bestDirty || pending.size > 0 ? mergeBestSameAccount(local.records.best, cloud.best) : cloud.best
  return { records: { best, history }, keyStats: appendSessionStats([], [...stats.values()]) }
}

// ---- 訪客資料併入帳號（ROADMAP 3.7） ----

export interface GuestOffer {
  /** 訪客有幾場戰績 */
  games: number
  /** 代表「這一批」訪客資料的記號：玩家選了先不要之後，同一批不會再問，訪客又玩了新的場次才會再問 */
  marker: string
}

/** 這個瀏覽器有沒有可以併入帳號的訪客資料；沒有、或這一批已經問過被拒絕時回傳 null */
export function guestMergeOffer(guest: Records, skippedMarker: string | null): GuestOffer | null {
  const last = guest.history.at(-1)
  const hasBest = Object.keys(guest.best).length > 0
  if (!last && !hasBest) return null
  const marker = last ? last.id : 'best-only'
  return marker === skippedMarker ? null : { games: guest.history.length, marker }
}

/**
 * 把訪客的資料併進帳號的本機資料。
 * 這是兩批不同的場次，所以通關次數相加（和同一個帳號的兩份快照取較大值不同）；同一個 id 的場次只會留一筆。
 */
export function mergeGuest(account: { records: Records; keyStats: readonly KeyStatRow[] }, guest: { records: Records; keyStats: readonly KeyStatRow[] }): { records: Records; keyStats: KeyStatRow[] } {
  const byId = new Map<string, KeyStatRow>()
  for (const k of [...account.keyStats, ...guest.keyStats]) byId.set(k.id, k)
  return { records: mergeRecords(account.records, guest.records), keyStats: appendSessionStats([], [...byId.values()]) }
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

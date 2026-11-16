/**
 * 按鍵統計的資料結構（ROADMAP 2.1）。
 *
 * 流程：戰鬥中每次按鍵記成一筆 KeyEvent（只留在記憶體）→ 一場結束時彙整成多筆 KeyStatRow 存起來。
 * KeyStatRow 刻意設計成扁平的一列（有 id 與時間戳、沒有巢狀），日後可以直接搬進資料庫：
 *
 *   資料表 key_stats            對應的欄位
 *   ─────────────────────────────────────────────────────────
 *   id          text  主鍵      KeyStatRow.id（`${sessionId}:${kind}:${key}`）
 *   user_id     uuid            （本機沒有；上傳時由登入身分補上，RLS 用）
 *   session_id  text  外鍵      KeyStatRow.sessionId → game_records.id（GameRecord.id）
 *   played_at   timestamptz     KeyStatRow.playedAt（毫秒時間戳，上傳時轉換）
 *   kind        text            KeyStatRow.kind（'char' 或 'bigram'）
 *   key         text            KeyStatRow.key
 *   attempts    int             KeyStatRow.attempts
 *   errors      int             KeyStatRow.errors
 *   timed_count int             KeyStatRow.timedCount
 *   total_ms    int             KeyStatRow.totalMs
 */

/** 戰鬥中的一次按鍵 */
export interface KeyEvent {
  /** 當時應該要打的字元 */
  expected: string
  /** 實際打的字元 */
  actual: string
  correct: boolean
  /** 同一個單字裡前一個要打的字元；單字的第一個字元是 null */
  prev: string | null
  /**
   * 和上一次按鍵隔了多少毫秒（只算實際戰鬥的時間，暫停、倒數、過關訊息都不算）。
   * 每一關的第一鍵、暫停後的第一鍵沒有可比較的上一鍵，是 null。
   */
  intervalMs: number | null
}

/** char：單一個鍵；bigram：連續兩個字母的組合（例如 th） */
export type KeyStatKind = 'char' | 'bigram'

/** 某一場裡某個鍵（或字母組合）的統計。一場會有很多列 */
export interface KeyStatRow {
  id: string
  /** 哪一場，對應 GameRecord.id */
  sessionId: string
  /** 那一場的結束時間（毫秒時間戳） */
  playedAt: number
  kind: KeyStatKind
  /** char：一個字元，英文字母一律小寫；bigram：兩個小寫字母 */
  key: string
  /** 輪到要打這個鍵時，總共按了幾次鍵（打對加打錯） */
  attempts: number
  /** 其中打錯幾次 */
  errors: number
  /** 有幾次打對的按鍵被拿來算反應時間 */
  timedCount: number
  /** 那幾次的反應時間總和（毫秒）；平均 = totalMs / timedCount */
  totalMs: number
}

/** 按鍵統計最多保留最近幾場（和歷史戰績相同） */
export const KEY_STATS_SESSION_LIMIT = 30

/** 把新一場的統計加進去，只保留最近 limit 場（依 playedAt，同場的列一起保留或一起丟掉） */
export function appendSessionStats(all: readonly KeyStatRow[], session: readonly KeyStatRow[], limit = KEY_STATS_SESSION_LIMIT): KeyStatRow[] {
  const newIds = new Set(session.map((r) => r.sessionId))
  const merged = [...all.filter((r) => !newIds.has(r.sessionId)), ...session]
  const sessions = new Map<string, number>()
  for (const r of merged) sessions.set(r.sessionId, Math.max(sessions.get(r.sessionId) ?? 0, r.playedAt))
  if (sessions.size <= limit) return merged
  const keep = new Set(
    [...sessions.entries()]
      .sort((a, b) => a[1] - b[1])
      .slice(-limit)
      .map(([id]) => id),
  )
  return merged.filter((r) => keep.has(r.sessionId))
}

// ---- 讀取時的驗證：localStorage 的內容可能壞掉或被改過，不合格的列直接丟掉 ----

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0

/** 統計用的鍵是否合法：char 是一個可列印 ASCII 字元（不含大寫），bigram 是兩個小寫字母 */
export function isStatKey(kind: KeyStatKind, key: string): boolean {
  return kind === 'char' ? /^[\x20-\x7E]$/.test(key) && !/[A-Z]/.test(key) : /^[a-z]{2}$/.test(key)
}

function parseKeyStatRow(v: unknown): KeyStatRow | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null
  const { id, sessionId, playedAt, kind, key, attempts, errors, timedCount, totalMs } = v as Record<string, unknown>
  if (typeof id !== 'string' || id === '' || typeof sessionId !== 'string' || sessionId === '' || !isCount(playedAt)) return null
  if ((kind !== 'char' && kind !== 'bigram') || typeof key !== 'string' || !isStatKey(kind, key)) return null
  if (!isCount(attempts) || !isCount(errors) || !isCount(timedCount) || !isCount(totalMs)) return null
  if (errors > attempts || timedCount > attempts) return null
  return { id, sessionId, playedAt, kind, key, attempts, errors, timedCount, totalMs }
}

/** 把 localStorage 讀出來（JSON.parse 之後）的值整理成合法的統計列，壞掉的略過 */
export function parseKeyStats(value: unknown): KeyStatRow[] {
  if (!Array.isArray(value)) return []
  return value.map(parseKeyStatRow).filter((r): r is KeyStatRow => r !== null)
}

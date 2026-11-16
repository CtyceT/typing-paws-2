import type { KeyStatKind, KeyStatRow } from './keystats.ts'

/** 某個鍵（或字母組合）跨場次加總後的統計（ROADMAP 2.3） */
export interface KeyAggregate {
  kind: KeyStatKind
  key: string
  /** 次數 */
  attempts: number
  errors: number
  /** 錯誤率，0～1；沒有次數時是 0 */
  errorRate: number
  /** 有幾次按鍵被拿來算反應時間 */
  timedCount: number
  /** 平均反應時間（毫秒，四捨五入）；沒有可計時的按鍵時是 null */
  avgMs: number | null
}

/** 把很多場的統計列依「種類＋鍵」加總，算出錯誤率與平均反應時間。結果先排單鍵再排組合，各自依鍵排序 */
export function aggregateKeyStats(rows: readonly KeyStatRow[]): KeyAggregate[] {
  const sums = new Map<string, { kind: KeyStatKind; key: string; attempts: number; errors: number; timedCount: number; totalMs: number }>()
  for (const r of rows) {
    const id = `${r.kind}:${r.key}`
    const s = sums.get(id) ?? { kind: r.kind, key: r.key, attempts: 0, errors: 0, timedCount: 0, totalMs: 0 }
    s.attempts += r.attempts
    s.errors += r.errors
    s.timedCount += r.timedCount
    s.totalMs += r.totalMs
    sums.set(id, s)
  }
  return [...sums.values()]
    .map(({ totalMs, ...s }) => ({
      ...s,
      errorRate: s.attempts > 0 ? s.errors / s.attempts : 0,
      avgMs: s.timedCount > 0 ? Math.round(totalMs / s.timedCount) : null,
    }))
    .sort((a, b) => (a.kind === b.kind ? (a.key < b.key ? -1 : a.key > b.key ? 1 : 0) : a.kind === 'char' ? -1 : 1))
}

/** 某一種統計（單鍵或組合）整體的平均反應時間，依計時次數加權；沒有資料是 null */
export function overallAvgMs(aggregates: readonly KeyAggregate[], kind: KeyStatKind): number | null {
  let count = 0
  let total = 0
  for (const a of aggregates) {
    if (a.kind !== kind || a.avgMs === null) continue
    count += a.timedCount
    total += a.avgMs * a.timedCount
  }
  return count > 0 ? Math.round(total / count) : null
}

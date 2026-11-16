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

// ---- 弱點分析（ROADMAP 2.4） ----

export interface WeaknessOptions {
  /** 全部單鍵的次數加起來不到這個數，就當作資料不足 */
  minTotalAttempts: number
  /** 單鍵至少要有這麼多次才列入 */
  minCharAttempts: number
  /** 字母組合至少要有這麼多次才列入 */
  minBigramAttempts: number
  /** 至少要有這麼多次計時，才判斷「慢」 */
  minTimedCount: number
  /** 錯誤率達到這個值算弱點 */
  errorRateThreshold: number
  /** 平均反應時間達到整體平均的這個倍數算弱點 */
  slowRatio: number
  /** 排序時「慢」佔的比重：比整體平均每慢 100%，等同多這麼多的錯誤率 */
  slowWeight: number
  /** 最多列出幾個 */
  limit: number
}

export const WEAKNESS_DEFAULTS: WeaknessOptions = {
  minTotalAttempts: 100,
  minCharAttempts: 8,
  minBigramAttempts: 5,
  minTimedCount: 5,
  errorRateThreshold: 0.08,
  slowRatio: 1.35,
  slowWeight: 0.2,
  limit: 5,
}

/** 弱點的原因：常打錯、打得慢，或兩者都有 */
export type WeaknessReason = 'errors' | 'slow' | 'both'

export interface Weakness extends KeyAggregate {
  reason: WeaknessReason
  /** 比整體平均慢多少（0.4 表示慢 40%）；不慢或沒有時間資料是 0 */
  slowness: number
  /** 排序用的分數，越高越弱 */
  score: number
}

export interface WeaknessReport {
  /**
   * - insufficient：資料不足，還不能判斷
   * - good：資料夠，而且沒有明顯的弱點
   * - weak：有弱點，列在 items
   */
  status: 'insufficient' | 'good' | 'weak'
  /** 由弱到強（最弱的在前），最多 limit 個 */
  items: Weakness[]
  /** 全部單鍵的次數總和 */
  totalAttempts: number
}

/**
 * 從加總後的統計選出最弱的幾個字母或字母組合。
 * 弱點的條件（符合其一）：錯誤率 ≥ errorRateThreshold，或平均反應時間 ≥ 同類整體平均 × slowRatio。
 * 樣本太少的不列入；空白鍵不列入（沒辦法針對空白出題）。
 */
export function findWeaknesses(aggregates: readonly KeyAggregate[], options: Partial<WeaknessOptions> = {}): WeaknessReport {
  const o = { ...WEAKNESS_DEFAULTS, ...options }
  const totalAttempts = aggregates.reduce((n, a) => n + (a.kind === 'char' ? a.attempts : 0), 0)
  if (totalAttempts < o.minTotalAttempts) return { status: 'insufficient', items: [], totalAttempts }

  const baseline = { char: overallAvgMs(aggregates, 'char'), bigram: overallAvgMs(aggregates, 'bigram') }
  const items: Weakness[] = []
  for (const a of aggregates) {
    if (a.key === ' ') continue
    if (a.attempts < (a.kind === 'char' ? o.minCharAttempts : o.minBigramAttempts)) continue
    const base = baseline[a.kind]
    const ratio = a.avgMs !== null && base !== null && base > 0 && a.timedCount >= o.minTimedCount ? a.avgMs / base : 1
    const manyErrors = a.errorRate >= o.errorRateThreshold
    const slow = ratio >= o.slowRatio
    if (!manyErrors && !slow) continue
    const slowness = Math.max(0, ratio - 1)
    items.push({
      ...a,
      reason: manyErrors && slow ? 'both' : manyErrors ? 'errors' : 'slow',
      slowness,
      score: a.errorRate + o.slowWeight * slowness,
    })
  }
  items.sort((x, y) => y.score - x.score || y.attempts - x.attempts || (x.key < y.key ? -1 : 1))
  return { status: items.length > 0 ? 'weak' : 'good', items: items.slice(0, o.limit), totalAttempts }
}

// ---- 弱點排行榜的顯示文字（ROADMAP 2.8） ----

/** 弱點的種類標籤：字母、數字、符號、組合 */
export function weaknessKindLabel(w: Pick<KeyAggregate, 'kind' | 'key'>): string {
  if (w.kind === 'bigram') return '組合'
  if (/^[a-z]$/.test(w.key)) return '字母'
  return /^[0-9]$/.test(w.key) ? '數字' : '符號'
}

export const WEAKNESS_REASON_LABEL: Readonly<Record<WeaknessReason, string>> = {
  errors: '常打錯',
  slow: '打得慢',
  both: '又慢又常錯',
}

const percent = (rate: number) => `${Math.round(rate * 1000) / 10}%`

/** 排行榜上每個弱點的兩行數字 */
export function weaknessDetail(w: Weakness): { errors: string; speed: string } {
  return {
    errors: `錯誤率 ${percent(w.errorRate)}（打 ${w.attempts} 次、錯 ${w.errors} 次）`,
    speed: w.avgMs === null ? '反應時間：資料不足' : `平均 ${w.avgMs} ms${w.slowness >= 0.05 ? `（比平均慢 ${Math.round(w.slowness * 100)}%）` : ''}`,
  }
}

/** 排行榜在沒有弱點可列時的說明文字 */
export function weaknessEmptyText(report: WeaknessReport, options: Partial<WeaknessOptions> = {}): string | null {
  const o = { ...WEAKNESS_DEFAULTS, ...options }
  if (report.status === 'insufficient') return `資料還不夠 🐾\n目前統計了 ${report.totalAttempts} 次按鍵，累積到 ${o.minTotalAttempts} 次就會開始分析弱點`
  if (report.status === 'good') return '🎉 目前沒有明顯的弱點！\n每個鍵的錯誤率和速度都在正常範圍，繼續保持'
  return null
}

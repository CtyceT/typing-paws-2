import type { KeyAggregate } from './analysis.ts'
import type { GameRecord } from './records.ts'

/** 儀表板最上面的總覽數字 */
export interface DashboardSummary {
  /** 有紀錄的場數 */
  games: number
  /** 其中通關幾場 */
  wins: number
  /** 平均 WPM（四捨五入） */
  avgWpm: number
  /** 平均準確率（百分比，一位小數） */
  avgAccuracy: number
  /** 已經統計的按鍵數（所有單鍵的次數總和） */
  keyCount: number
}

/** 沒有任何戰績也沒有按鍵統計時，儀表板顯示引導文字 */
export function hasDashboardData(history: readonly GameRecord[], aggregates: readonly KeyAggregate[]): boolean {
  return history.length > 0 || aggregates.length > 0
}

export function dashboardSummary(history: readonly GameRecord[], aggregates: readonly KeyAggregate[]): DashboardSummary {
  const games = history.length
  const mean = (pick: (r: GameRecord) => number) => (games > 0 ? history.reduce((n, r) => n + pick(r), 0) / games : 0)
  return {
    games,
    wins: history.filter((r) => r.win).length,
    avgWpm: Math.round(mean((r) => r.wpm)),
    avgAccuracy: Math.round(mean((r) => r.accuracy) * 10) / 10,
    keyCount: aggregates.reduce((n, a) => n + (a.kind === 'char' ? a.attempts : 0), 0),
  }
}

/** 總覽的五格數字，依顯示順序 */
export function summaryStats(summary: DashboardSummary): { label: string; value: string }[] {
  return [
    { label: '場數', value: String(summary.games) },
    { label: '通關', value: String(summary.wins) },
    { label: '平均 WPM', value: String(summary.avgWpm) },
    { label: '平均準確率', value: summary.games > 0 ? `${summary.avgAccuracy}%` : '—' },
    { label: '統計按鍵數', value: String(summary.keyCount) },
  ]
}

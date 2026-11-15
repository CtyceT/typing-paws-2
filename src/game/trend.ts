import { DIFFICULTIES } from './difficulty.ts'
import type { GameRecord } from './records.ts'

/** 走勢圖顯示最近幾場 */
export const TREND_COUNT = 10

export interface TrendPoint {
  wpm: number
  win: boolean
  /** 滑鼠移上去顯示的說明 */
  tooltip: string
}

export interface WpmTrend {
  /** 由舊到新 */
  points: readonly TrendPoint[]
  /** 這幾場裡最高的 WPM */
  best: number
  /** 最近一場的 WPM */
  last: number
  /** 縱軸上限：留一點空間，而且至少比 10 大 */
  yMax: number
}

/** 最近幾場的 WPM 走勢；不到 2 場畫不出線，回傳 null */
export function wpmTrend(history: readonly GameRecord[], count = TREND_COUNT): WpmTrend | null {
  const rows = history.slice(-count)
  if (rows.length < 2) return null
  const values = rows.map((r) => r.wpm)
  return {
    points: rows.map((r) => ({
      wpm: r.wpm,
      win: r.win,
      tooltip: `${r.wpm} WPM (${DIFFICULTIES[r.difficulty].label}${r.win ? '・通關' : ''})`,
    })),
    best: Math.max(...values),
    last: values[values.length - 1],
    yMax: Math.max(10, ...values) * 1.15,
  }
}

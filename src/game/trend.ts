import { DIFFICULTIES } from './difficulty.ts'
import { formatPlayedAt, type GameRecord } from './records.ts'

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

// ---- 儀表板的 WPM／準確率趨勢（ROADMAP 2.7） ----

/** recent：最近 TREND_COUNT 場；all：保留的全部場次 */
export type TrendRange = 'recent' | 'all'

export interface PerformancePoint {
  /** 這段範圍裡的第幾場（從 1 開始），當作橫軸 */
  index: number
  wpm: number
  /** 準確率（百分比） */
  accuracy: number
  win: boolean
  /** 滑鼠移上去顯示的標題：時間、難度、結果 */
  title: string
}

export interface PerformanceTrend {
  /** 由舊到新 */
  points: readonly PerformancePoint[]
  /** WPM 縱軸上限（下限是 0） */
  wpmMax: number
  /** 準確率縱軸下限（上限是 100）：取到整十，讓小幅度的變化也看得出來 */
  accuracyMin: number
}

/** 整理趨勢圖要畫的資料；沒有任何場次回傳 null */
export function performanceTrend(history: readonly GameRecord[], range: TrendRange): PerformanceTrend | null {
  const rows = range === 'recent' ? history.slice(-TREND_COUNT) : history
  if (rows.length === 0) return null
  const lowest = Math.min(...rows.map((r) => r.accuracy))
  return {
    points: rows.map((r, i) => ({
      index: i + 1,
      wpm: r.wpm,
      accuracy: r.accuracy,
      win: r.win,
      title: `${formatPlayedAt(r.playedAt)}・${DIFFICULTIES[r.difficulty].label}・${r.win ? '通關' : `止步第 ${r.stage} 關`}`,
    })),
    wpmMax: Math.ceil((Math.max(10, ...rows.map((r) => r.wpm)) * 1.15) / 10) * 10,
    accuracyMin: Math.max(0, Math.min(90, Math.floor((lowest - 2) / 10) * 10)),
  }
}

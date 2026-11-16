import { describe, expect, it } from 'vitest'
import type { KeyAggregate } from './analysis.ts'
import { dashboardSummary, hasDashboardData, summaryStats } from './dashboard.ts'
import type { GameRecord } from './records.ts'

const game = (i: number, wpm: number, accuracy: number, win = true): GameRecord => ({
  id: `g${i}`,
  playedAt: i,
  mode: 'classic',
  difficulty: 'easy',
  win,
  wpm,
  accuracy,
  maxCombo: 1,
  score: 1,
  damage: 1,
  durationMs: 1,
  stage: 3,
})
const agg = (kind: 'char' | 'bigram', key: string, attempts: number): KeyAggregate => ({ kind, key, attempts, errors: 0, errorRate: 0, timedCount: 0, avgMs: null })

describe('儀表板總覽', () => {
  it('沒有戰績也沒有按鍵統計就是沒有資料', () => {
    expect(hasDashboardData([], [])).toBe(false)
    expect(hasDashboardData([game(1, 30, 90)], [])).toBe(true)
    expect(hasDashboardData([], [agg('char', 'a', 1)])).toBe(true)
  })

  it('空資料的總覽都是 0', () => {
    expect(dashboardSummary([], [])).toEqual({ games: 0, wins: 0, avgWpm: 0, avgAccuracy: 0, keyCount: 0 })
    expect(summaryStats(dashboardSummary([], [])).map((s) => s.value)).toEqual(['0', '0', '0', '—', '0'])
  })

  it('算出場數、通關數、平均 WPM、平均準確率；按鍵數只算單鍵', () => {
    const s = dashboardSummary([game(1, 30, 90.5), game(2, 41, 95.2, false), game(3, 50, 98)], [agg('char', 'a', 120), agg('char', 'b', 80), agg('bigram', 'ab', 60)])
    expect(s).toEqual({ games: 3, wins: 2, avgWpm: 40, avgAccuracy: 94.6, keyCount: 200 })
    expect(summaryStats(s)).toEqual([
      { label: '場數', value: '3' },
      { label: '通關', value: '2' },
      { label: '平均 WPM', value: '40' },
      { label: '平均準確率', value: '94.6%' },
      { label: '統計按鍵數', value: '200' },
    ])
  })
})

import { describe, expect, it } from 'vitest'
import type { GameRecord } from './records.ts'
import { wpmTrend } from './trend.ts'

const row = (i: number, wpm: number, win = true): GameRecord => ({
  id: `r${i}`,
  playedAt: i,
  mode: 'classic',
  difficulty: 'normal',
  win,
  wpm,
  accuracy: 95,
  maxCombo: 1,
  score: 1,
  damage: 1,
  durationMs: 1,
  stage: 3,
})

describe('wpmTrend', () => {
  it('不到 2 場畫不出走勢', () => {
    expect(wpmTrend([])).toBeNull()
    expect(wpmTrend([row(1, 40)])).toBeNull()
  })

  it('由舊到新列出每一場，並算出最高、最近與縱軸上限', () => {
    const t = wpmTrend([row(1, 30, false), row(2, 52), row(3, 47)])!
    expect(t.points.map((p) => p.wpm)).toEqual([30, 52, 47])
    expect(t.points.map((p) => p.win)).toEqual([false, true, true])
    expect(t.points[0].tooltip).toBe('30 WPM (普通)')
    expect(t.points[1].tooltip).toBe('52 WPM (普通・通關)')
    expect(t.best).toBe(52)
    expect(t.last).toBe(47)
    expect(t.yMax).toBeCloseTo(59.8)
  })

  it('只取最近 10 場', () => {
    const t = wpmTrend(Array.from({ length: 14 }, (_, i) => row(i, i)))!
    expect(t.points).toHaveLength(10)
    expect(t.points[0].wpm).toBe(4)
  })

  it('WPM 都很低時縱軸上限至少 11.5', () => {
    expect(wpmTrend([row(1, 0), row(2, 3)])!.yMax).toBeCloseTo(11.5)
  })
})

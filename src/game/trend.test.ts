import { describe, expect, it } from 'vitest'
import type { GameRecord } from './records.ts'
import { performanceTrend, wpmTrend } from './trend.ts'

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

describe('performanceTrend', () => {
  const game = (i: number, wpm: number, accuracy: number, win = true): GameRecord => ({ ...row(i, wpm, win), accuracy, playedAt: new Date(2026, 10, 15, 14, i).getTime(), stage: win ? 3 : 2 })

  it('沒有場次回傳 null；只有一場也畫得出來', () => {
    expect(performanceTrend([], 'all')).toBeNull()
    expect(performanceTrend([game(1, 40, 95)], 'recent')!.points).toHaveLength(1)
  })

  it('由舊到新列出 WPM 與準確率，標題有時間、難度、結果', () => {
    const t = performanceTrend([game(1, 30, 88.5, false), game(2, 52, 97)], 'all')!
    expect(t.points).toEqual([
      { index: 1, wpm: 30, accuracy: 88.5, win: false, title: '11/15 14:01・普通・止步第 2 關' },
      { index: 2, wpm: 52, accuracy: 97, win: true, title: '11/15 14:02・普通・通關' },
    ])
  })

  it('recent 只取最近 10 場，all 取全部', () => {
    const history = Array.from({ length: 14 }, (_, i) => game(i + 1, 20 + i, 95))
    const recent = performanceTrend(history, 'recent')!
    expect(recent.points).toHaveLength(10)
    expect(recent.points[0]).toMatchObject({ index: 1, wpm: 24 })
    expect(performanceTrend(history, 'all')!.points).toHaveLength(14)
  })

  it('縱軸範圍：WPM 上限留空間並取整十，準確率下限取整十且不高於 90', () => {
    expect(performanceTrend([game(1, 52, 97)], 'all')).toMatchObject({ wpmMax: 60, accuracyMin: 90 })
    expect(performanceTrend([game(1, 5, 100)], 'all')).toMatchObject({ wpmMax: 20, accuracyMin: 90 })
    expect(performanceTrend([game(1, 100, 83.4), game(2, 80, 91)], 'all')).toMatchObject({ wpmMax: 120, accuracyMin: 80 })
    expect(performanceTrend([game(1, 30, 1)], 'all')).toMatchObject({ accuracyMin: 0 })
  })
})

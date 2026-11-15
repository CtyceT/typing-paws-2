import { describe, expect, it } from 'vitest'
import type { BattleResult } from './result.ts'
import {
  addResult,
  bestSummary,
  EMPTY_RECORDS,
  formatPlayedAt,
  hasRecords,
  HISTORY_LIMIT,
  mergeRecords,
  newRecordKind,
  parseRecords,
  recentHistory,
  recordOutcome,
  updateBest,
  type GameRecord,
  type Records,
} from './records.ts'

const result = (over: Partial<BattleResult> = {}): BattleResult => ({
  difficulty: 'easy',
  win: true,
  wpm: 40,
  accuracy: 95,
  maxCombo: 20,
  score: 3000,
  damage: 290,
  durationMs: 60000,
  stage: 3,
  stars: 3,
  ...over,
})

const row = (i: number, over: Partial<GameRecord> = {}): GameRecord => ({
  id: `r${i}`,
  playedAt: 1790000000000 + i * 60000,
  mode: 'classic',
  difficulty: 'easy',
  win: true,
  wpm: 40 + i,
  accuracy: 95,
  maxCombo: 20,
  score: 3000,
  damage: 290,
  durationMs: 60000,
  stage: 3,
  ...over,
})

describe('最佳紀錄', () => {
  it('第一次通關', () => {
    expect(updateBest(undefined, result())).toEqual({ score: 3000, wpm: 40, maxCombo: 20, accuracy: 95, clears: 1 })
  })

  it('各項分別取較好的，通關次數累加', () => {
    const prev = { score: 5000, wpm: 30, maxCombo: 50, accuracy: 99, clears: 2 }
    expect(updateBest(prev, result())).toEqual({ score: 5000, wpm: 40, maxCombo: 50, accuracy: 99, clears: 3 })
  })

  it('失敗的場次不更新 WPM 與準確率，也不算通關，但分數和 Combo 照算', () => {
    const prev = { score: 1000, wpm: 30, maxCombo: 10, accuracy: 90, clears: 1 }
    expect(updateBest(prev, result({ win: false, wpm: 99, accuracy: 100, score: 2000, maxCombo: 15 }))).toEqual({
      score: 2000,
      wpm: 30,
      maxCombo: 15,
      accuracy: 90,
      clears: 1,
    })
  })

  it('新紀錄：通關且 WPM 更快優先，其次是分數更高', () => {
    const prev = { score: 3000, wpm: 40, maxCombo: 20, accuracy: 95, clears: 1 }
    expect(newRecordKind(prev, result({ wpm: 41, score: 9999 }))).toBe('wpm')
    expect(newRecordKind(prev, result({ wpm: 40, score: 3001 }))).toBe('score')
    expect(newRecordKind(prev, result({ wpm: 40, score: 3000 }))).toBeNull()
    expect(newRecordKind(prev, result({ win: false, wpm: 99, score: 3001 }))).toBe('score')
    expect(newRecordKind(undefined, result())).toBe('wpm')
    expect(newRecordKind(undefined, result({ win: false, score: 0 }))).toBeNull()
  })
})

describe('addResult', () => {
  it('加到歷史最後並更新該難度的最佳紀錄，不改動原本的物件', () => {
    const next = addResult(EMPTY_RECORDS, result({ difficulty: 'hard' }), { id: 'a', playedAt: 123 })
    expect(next.history).toEqual([
      { id: 'a', playedAt: 123, mode: 'classic', difficulty: 'hard', win: true, wpm: 40, accuracy: 95, maxCombo: 20, score: 3000, damage: 290, durationMs: 60000, stage: 3 },
    ])
    expect(Object.keys(next.best)).toEqual(['hard'])
    expect(EMPTY_RECORDS).toEqual({ best: {}, history: [] })
  })

  it('歷史最多 30 場，超過丟掉最舊的；最佳紀錄不受影響', () => {
    let records: Records = EMPTY_RECORDS
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) records = addResult(records, result({ score: 100 + i }), { id: `r${i}`, playedAt: i })
    expect(records.history).toHaveLength(30)
    expect(records.history[0].id).toBe('r5')
    expect(records.best.easy).toMatchObject({ score: 134, clears: 35 })
  })
})

describe('mergeRecords', () => {
  it('最佳紀錄各項取較好的、通關次數相加；歷史依時間排序', () => {
    const a: Records = { best: { easy: { score: 100, wpm: 50, maxCombo: 5, accuracy: 90, clears: 1 } }, history: [row(2), row(4)] }
    const b: Records = {
      best: { easy: { score: 300, wpm: 20, maxCombo: 9, accuracy: 80, clears: 2 }, hard: { score: 7, wpm: 0, maxCombo: 1, accuracy: 0, clears: 0 } },
      history: [row(1), row(3)],
    }
    const m = mergeRecords(a, b)
    expect(m.best.easy).toEqual({ score: 300, wpm: 50, maxCombo: 9, accuracy: 90, clears: 3 })
    expect(m.best.hard).toMatchObject({ score: 7 })
    expect(m.best.normal).toBeUndefined()
    expect(m.history.map((r) => r.id)).toEqual(['r1', 'r2', 'r3', 'r4'])
  })

  it('同一筆不會重複，總數不超過 30', () => {
    const many = Array.from({ length: 30 }, (_, i) => row(i))
    const m = mergeRecords({ best: {}, history: many }, { best: {}, history: [row(3), row(40)] })
    expect(m.history).toHaveLength(30)
    expect(m.history[m.history.length - 1].id).toBe('r40')
    expect(m.history.filter((r) => r.id === 'r3')).toHaveLength(1)
  })
})

describe('parseRecords', () => {
  it('合法的資料原樣讀回', () => {
    const records = addResult(EMPTY_RECORDS, result(), { id: 'a', playedAt: 5 })
    expect(parseRecords(JSON.parse(JSON.stringify(records.best)), JSON.parse(JSON.stringify(records.history)))).toEqual(records)
  })

  it('壞掉的資料不會當機，壞的部分略過', () => {
    expect(parseRecords(null, undefined)).toEqual(EMPTY_RECORDS)
    expect(parseRecords('x', 42)).toEqual(EMPTY_RECORDS)
    expect(parseRecords([], {})).toEqual(EMPTY_RECORDS)
    const parsed = parseRecords(
      { easy: { score: 'lots' }, normal: { score: 1, wpm: 2, maxCombo: 3, accuracy: 4, clears: 5 }, nightmare: {} },
      [row(1), null, { ...row(2), difficulty: 'nightmare' }, { ...row(3), wpm: -1 }, { ...row(4), id: '' }, { ...row(5), damage: null, durationMs: null }],
    )
    expect(Object.keys(parsed.best)).toEqual(['normal'])
    expect(parsed.history.map((r) => r.id)).toEqual(['r1', 'r5'])
  })
})

describe('顯示用函式', () => {
  it('hasRecords', () => {
    expect(hasRecords(EMPTY_RECORDS)).toBe(false)
    expect(hasRecords({ best: {}, history: [row(1)] })).toBe(true)
  })

  it('難度卡片的最佳紀錄', () => {
    expect(bestSummary(undefined)).toBeNull()
    expect(bestSummary({ score: 0, wpm: 0, maxCombo: 0, accuracy: 0, clears: 0 })).toBeNull()
    expect(bestSummary({ score: 3210, wpm: 45, maxCombo: 31, accuracy: 96, clears: 2 })).toEqual([
      '🏅 最高分 3210 ・ 最快 45 WPM',
      '🔥 最高 Combo 31 ・ 通關 2 次',
    ])
    expect(bestSummary({ score: 500, wpm: 0, maxCombo: 8, accuracy: 0, clears: 0 })![0]).toBe('🏅 最高分 500 ・ 尚未通關')
  })

  it('戰績表取最近 6 場，新的在前', () => {
    const history = Array.from({ length: 8 }, (_, i) => row(i))
    expect(recentHistory(history).map((r) => r.id)).toEqual(['r7', 'r6', 'r5', 'r4', 'r3', 'r2'])
  })

  it('時間與結果欄', () => {
    expect(formatPlayedAt(new Date(2026, 10, 5, 9, 7).getTime())).toBe('11/5 09:07')
    expect(recordOutcome({ win: true, stage: 3 })).toBe('🏆')
    expect(recordOutcome({ win: false, stage: 2 })).toBe('💀 2關')
  })
})

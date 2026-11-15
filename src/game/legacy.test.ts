import { describe, expect, it } from 'vitest'
import { parseLegacyStore } from './legacy.ts'

const legacy = (data: unknown) => parseLegacyStore(JSON.stringify(data))

describe('parseLegacyStore', () => {
  it('沒有資料或格式不對回傳 null', () => {
    expect(parseLegacyStore(null)).toBeNull()
    expect(parseLegacyStore('')).toBeNull()
    expect(parseLegacyStore('{oops')).toBeNull()
    expect(parseLegacyStore('[1,2]')).toBeNull()
    expect(parseLegacyStore('"cat"')).toBeNull()
  })

  it('只有空紀錄、沒有任何值得匯入的內容回傳 null', () => {
    expect(legacy({ best: {}, history: [] })).toBeNull()
    expect(legacy({ best: { easy: { score: 0 } }, history: [], avatar: 'dragon' })).toBeNull()
  })

  it('轉換勇者、最佳紀錄與戰績', () => {
    const out = legacy({
      avatar: 'panda',
      best: { easy: { score: 3210, wpm: 45, combo: 31, acc: 96.5, clears: 2 } },
      history: [
        { t: 1790000000000, diff: 'easy', win: true, wpm: 45, acc: 96.5, combo: 31, score: 3210, stage: 3 },
        { t: 1790000100000, diff: 'hard', win: false, wpm: 30, acc: 80, combo: 9, score: 400, stage: 1 },
      ],
    })!
    expect(out.hero).toBe('panda')
    expect(out.records.best).toEqual({ easy: { score: 3210, wpm: 45, maxCombo: 31, accuracy: 96.5, clears: 2 } })
    expect(out.records.history).toEqual([
      { id: 'v1-1790000000000-0', playedAt: 1790000000000, mode: 'classic', difficulty: 'easy', win: true, wpm: 45, accuracy: 96.5, maxCombo: 31, score: 3210, damage: null, durationMs: null, stage: 3 },
      { id: 'v1-1790000100000-1', playedAt: 1790000100000, mode: 'classic', difficulty: 'hard', win: false, wpm: 30, accuracy: 80, maxCombo: 9, score: 400, damage: null, durationMs: null, stage: 1 },
    ])
  })

  it('只有勇者也可以匯入', () => {
    expect(legacy({ best: {}, history: [], avatar: 'bunny' })).toEqual({ hero: 'bunny', records: { best: {}, history: [] } })
  })

  it('壞掉的列略過，缺的數字當成 0', () => {
    const out = legacy({
      best: 'broken',
      history: [null, { t: 'yesterday', diff: 'easy' }, { t: 5, diff: 'nightmare' }, { t: 7, diff: 'normal', win: 'yes', wpm: 'fast' }],
    })!
    expect(out.hero).toBeNull()
    expect(out.records.history).toHaveLength(1)
    expect(out.records.history[0]).toMatchObject({ id: 'v1-7-3', difficulty: 'normal', win: false, wpm: 0, stage: 1 })
  })
})

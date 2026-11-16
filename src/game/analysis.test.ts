import { describe, expect, it } from 'vitest'
import { aggregateKeyStats, overallAvgMs } from './analysis.ts'
import { summarizeSession, type KeyEvent, type KeyStatKind, type KeyStatRow } from './keystats.ts'

const row = (sessionId: string, kind: KeyStatKind, key: string, attempts: number, errors: number, timedCount: number, totalMs: number): KeyStatRow => ({
  id: `${sessionId}:${kind}:${key}`,
  sessionId,
  playedAt: 1,
  kind,
  key,
  attempts,
  errors,
  timedCount,
  totalMs,
})

describe('aggregateKeyStats', () => {
  it('沒有資料回傳空陣列', () => {
    expect(aggregateKeyStats([])).toEqual([])
  })

  it('跨場次把同一個鍵加總，算出錯誤率與平均反應時間', () => {
    const out = aggregateKeyStats([row('s1', 'char', 'a', 10, 1, 8, 1600), row('s2', 'char', 'a', 30, 3, 12, 3000), row('s1', 'bigram', 'th', 4, 2, 0, 0)])
    expect(out).toEqual([
      { kind: 'char', key: 'a', attempts: 40, errors: 4, errorRate: 0.1, timedCount: 20, avgMs: 230 },
      { kind: 'bigram', key: 'th', attempts: 4, errors: 2, errorRate: 0.5, timedCount: 0, avgMs: null },
    ])
  })

  it('同一個字串的單鍵和組合不會混在一起；先排單鍵再排組合，各自依鍵排序', () => {
    const out = aggregateKeyStats([row('s1', 'bigram', 'he', 1, 0, 0, 0), row('s1', 'char', 'z', 1, 0, 0, 0), row('s1', 'bigram', 'an', 1, 0, 0, 0), row('s1', 'char', 'b', 1, 0, 0, 0)])
    expect(out.map((a) => `${a.kind}:${a.key}`)).toEqual(['char:b', 'char:z', 'bigram:an', 'bigram:he'])
  })

  it('用手寫的按鍵序列驗算：打兩次 "the"，第二次的 h 打錯一次', () => {
    const ok = (expected: string, prev: string | null, intervalMs: number | null): KeyEvent => ({ expected, actual: expected, correct: true, prev, intervalMs })
    const events: KeyEvent[] = [
      ok('t', null, null), // 開場第一鍵：不計時
      ok('h', 't', 200),
      ok('e', 'h', 100),
      ok('t', null, 400),
      { expected: 'h', actual: 'j', correct: false, prev: 't', intervalMs: 150 },
      ok('h', 't', 250), // 改錯的那一鍵：不計時
      ok('e', 'h', 120),
    ]
    const out = aggregateKeyStats(summarizeSession(events, { sessionId: 's1', playedAt: 1 }))
    const get = (kind: string, key: string) => out.find((a) => a.kind === kind && a.key === key)
    // 人工計算：
    // t：2 次、0 錯；計時 1 次（400）→ 平均 400
    // h：3 次、1 錯 → 33.3%；計時 1 次（200）→ 平均 200
    // e：2 次、0 錯；計時 2 次（100、120）→ 平均 110
    // th：3 次、1 錯；計時 1 次（200）    he：2 次、0 錯；計時 2 次 → 平均 110
    expect(get('char', 't')).toMatchObject({ attempts: 2, errors: 0, errorRate: 0, timedCount: 1, avgMs: 400 })
    expect(get('char', 'h')).toMatchObject({ attempts: 3, errors: 1, timedCount: 1, avgMs: 200 })
    expect(get('char', 'h')!.errorRate).toBeCloseTo(1 / 3)
    expect(get('char', 'e')).toMatchObject({ attempts: 2, errors: 0, timedCount: 2, avgMs: 110 })
    expect(get('bigram', 'th')).toMatchObject({ attempts: 3, errors: 1, timedCount: 1, avgMs: 200 })
    expect(get('bigram', 'he')).toMatchObject({ attempts: 2, errors: 0, timedCount: 2, avgMs: 110 })
    expect(out).toHaveLength(5)
  })
})

describe('overallAvgMs', () => {
  it('依計時次數加權，只看指定的種類', () => {
    const out = aggregateKeyStats([row('s1', 'char', 'a', 10, 0, 10, 1000), row('s1', 'char', 'b', 30, 0, 30, 9000), row('s1', 'bigram', 'ab', 5, 0, 5, 5000)])
    expect(overallAvgMs(out, 'char')).toBe(250)
    expect(overallAvgMs(out, 'bigram')).toBe(1000)
    expect(overallAvgMs([], 'char')).toBeNull()
  })
})

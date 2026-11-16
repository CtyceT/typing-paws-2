import { describe, expect, it } from 'vitest'
import { aggregateKeyStats, findWeaknesses, overallAvgMs, sessionMisses, weaknessDetail, weaknessEmptyText, weaknessKindLabel, type KeyAggregate, type Weakness } from './analysis.ts'
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

describe('findWeaknesses', () => {
  const agg = (kind: KeyStatKind, key: string, attempts: number, errors: number, avgMs: number | null = 200): KeyAggregate => ({
    kind,
    key,
    attempts,
    errors,
    errorRate: attempts > 0 ? errors / attempts : 0,
    timedCount: avgMs === null ? 0 : attempts - errors,
    avgMs,
  })
  /** 一批表現正常的字母，湊足樣本數 */
  const fine = (keys = 'abcdefghij') => [...keys].map((k) => agg('char', k, 30, 0))

  it('資料不足：總次數太少時不判斷，即使錯誤率很高', () => {
    const report = findWeaknesses([agg('char', 'q', 20, 10), agg('char', 'a', 30, 0)])
    expect(report).toEqual({ status: 'insufficient', items: [], totalAttempts: 50 })
    expect(findWeaknesses([]).status).toBe('insufficient')
  })

  it('全部都很好：資料夠而且沒有弱點', () => {
    const report = findWeaknesses([...fine(), agg('bigram', 'ab', 20, 1)])
    expect(report.status).toBe('good')
    expect(report.items).toEqual([])
    expect(report.totalAttempts).toBe(300)
  })

  it('明顯有弱點：依弱的程度排序，最多 5 個', () => {
    const report = findWeaknesses([
      ...fine(),
      agg('char', 'q', 20, 8), // 40%
      agg('char', 'z', 20, 4), // 20%
      agg('char', 'x', 20, 2), // 10%
      agg('char', 'p', 50, 5), // 10%，樣本比 x 多 → 排在 x 前面
      agg('bigram', 'qu', 10, 5), // 50%
      agg('bigram', 'th', 10, 3), // 30%
      agg('char', 'k', 25, 1), // 4%：不算弱點
    ])
    expect(report.status).toBe('weak')
    expect(report.items.map((w) => `${w.kind}:${w.key}`)).toEqual(['bigram:qu', 'char:q', 'bigram:th', 'char:z', 'char:p'])
    expect(report.items.every((w) => w.reason === 'errors')).toBe(true)
  })

  it('樣本太少的鍵不列入', () => {
    const report = findWeaknesses([...fine(), agg('char', 'q', 7, 7), agg('bigram', 'qu', 4, 4), agg('char', 'z', 8, 4), agg('bigram', 'zz', 5, 3)])
    expect(report.items.map((w) => w.key)).toEqual(['zz', 'z'])
  })

  it('打得特別慢也算弱點；又慢又常錯標成 both', () => {
    const report = findWeaknesses([...fine(), agg('char', 'y', 30, 0, 320), agg('char', 'q', 30, 6, 400), agg('char', 'w', 30, 0, 250)])
    expect(report.items.map((w) => [w.key, w.reason])).toEqual([
      ['q', 'both'],
      ['y', 'slow'],
    ])
    expect(report.items[1].slowness).toBeGreaterThan(0.35)
  })

  it('計時次數太少的不判斷快慢；空白鍵不列入', () => {
    const slowButFew: KeyAggregate = { kind: 'char', key: 'y', attempts: 30, errors: 0, errorRate: 0, timedCount: 4, avgMs: 900 }
    const report = findWeaknesses([...fine(), slowButFew, agg('char', ' ', 40, 20)])
    expect(report.status).toBe('good')
  })

  it('門檻可以調整', () => {
    const data = [...fine(), agg('char', 'q', 20, 1)]
    expect(findWeaknesses(data).status).toBe('good')
    expect(findWeaknesses(data, { errorRateThreshold: 0.05 }).items.map((w) => w.key)).toEqual(['q'])
    expect(findWeaknesses(data, { minTotalAttempts: 1000 }).status).toBe('insufficient')
    expect(findWeaknesses([...fine(), agg('char', 'q', 20, 8), agg('char', 'z', 20, 8)], { limit: 1 }).items).toHaveLength(1)
  })
})

describe('弱點排行榜的顯示文字', () => {
  const weak = (over: Partial<Weakness>): Weakness => ({ kind: 'char', key: 'q', attempts: 40, errors: 10, errorRate: 0.25, timedCount: 30, avgMs: 320, reason: 'both', slowness: 0.42, score: 0.33, ...over })

  it('種類標籤', () => {
    expect(weaknessKindLabel({ kind: 'char', key: 'q' })).toBe('字母')
    expect(weaknessKindLabel({ kind: 'char', key: '4' })).toBe('數字')
    expect(weaknessKindLabel({ kind: 'char', key: ';' })).toBe('符號')
    expect(weaknessKindLabel({ kind: 'bigram', key: 'th' })).toBe('組合')
  })

  it('兩行數字：錯誤率與反應時間', () => {
    expect(weaknessDetail(weak({}))).toEqual({ errors: '錯誤率 25%（打 40 次、錯 10 次）', speed: '平均 320 ms（比平均慢 42%）' })
    expect(weaknessDetail(weak({ slowness: 0.02 })).speed).toBe('平均 320 ms')
    expect(weaknessDetail(weak({ avgMs: null, slowness: 0 })).speed).toBe('反應時間：資料不足')
    expect(weaknessDetail(weak({ attempts: 9, errors: 1, errorRate: 1 / 9 })).errors).toBe('錯誤率 11.1%（打 9 次、錯 1 次）')
  })

  it('沒有弱點可列時的說明', () => {
    expect(weaknessEmptyText({ status: 'insufficient', items: [], totalAttempts: 37 })).toBe('資料還不夠 🐾\n目前統計了 37 次按鍵，累積到 100 次就會開始分析弱點')
    expect(weaknessEmptyText({ status: 'good', items: [], totalAttempts: 500 })).toMatch(/沒有明顯的弱點/)
    expect(weaknessEmptyText({ status: 'weak', items: [weak({})], totalAttempts: 500 })).toBeNull()
  })
})

describe('sessionMisses', () => {
  it('沒有打錯就是空的', () => {
    expect(sessionMisses([])).toEqual([])
    expect(sessionMisses([row('s1', 'char', 'a', 10, 0, 9, 1800)])).toEqual([])
  })

  it('列出錯最多次的 3 個鍵；次數相同時錯誤率高的在前；不看字母組合', () => {
    const rows = [
      row('s1', 'char', 'a', 20, 2, 0, 0),
      row('s1', 'char', 'e', 30, 6, 0, 0),
      row('s1', 'char', 'q', 4, 2, 0, 0),
      row('s1', 'char', ' ', 10, 1, 0, 0),
      row('s1', 'char', 't', 10, 0, 0, 0),
      row('s1', 'bigram', 'th', 9, 9, 0, 0),
    ]
    expect(sessionMisses(rows)).toEqual([
      { key: 'e', label: 'E', errors: 6, attempts: 30 },
      { key: 'q', label: 'Q', errors: 2, attempts: 4 },
      { key: 'a', label: 'A', errors: 2, attempts: 20 },
    ])
    expect(sessionMisses(rows, 4)[3]).toEqual({ key: ' ', label: '空白', errors: 1, attempts: 10 })
  })
})

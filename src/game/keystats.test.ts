import { describe, expect, it } from 'vitest'
import { appendSessionStats, isStatKey, parseKeyStats, type KeyStatRow } from './keystats.ts'

const row = (sessionId: string, playedAt: number, key = 'a', over: Partial<KeyStatRow> = {}): KeyStatRow => ({
  id: `${sessionId}:char:${key}`,
  sessionId,
  playedAt,
  kind: 'char',
  key,
  attempts: 10,
  errors: 1,
  timedCount: 8,
  totalMs: 1600,
  ...over,
})

describe('appendSessionStats', () => {
  it('把新一場的列加在最後', () => {
    const out = appendSessionStats([row('s1', 1)], [row('s2', 2, 'a'), row('s2', 2, 'b')])
    expect(out.map((r) => r.id)).toEqual(['s1:char:a', 's2:char:a', 's2:char:b'])
  })

  it('超過上限時整場一起丟掉最舊的', () => {
    const all = [row('s1', 1, 'a'), row('s1', 1, 'b'), row('s2', 2), row('s3', 3)]
    const out = appendSessionStats(all, [row('s4', 4)], 3)
    expect([...new Set(out.map((r) => r.sessionId))]).toEqual(['s2', 's3', 's4'])
  })

  it('同一場再存一次會取代舊的，不會重複', () => {
    const out = appendSessionStats([row('s1', 1, 'a'), row('s2', 2)], [row('s1', 1, 'a', { attempts: 99 })])
    expect(out).toHaveLength(2)
    expect(out.find((r) => r.sessionId === 's1')?.attempts).toBe(99)
  })

  it('不會改到傳進來的陣列', () => {
    const all = [row('s1', 1)]
    appendSessionStats(all, [row('s2', 2)], 1)
    expect(all).toHaveLength(1)
  })
})

describe('isStatKey', () => {
  it('char 是一個不含大寫的可列印 ASCII 字元', () => {
    for (const k of ['a', 'z', '1', ' ', ';', '!']) expect(isStatKey('char', k)).toBe(true)
    for (const k of ['A', 'ab', '', '中', '\n']) expect(isStatKey('char', k)).toBe(false)
  })

  it('bigram 是兩個小寫字母', () => {
    expect(isStatKey('bigram', 'th')).toBe(true)
    for (const k of ['t', 'Th', 't ', 'thr', 't1']) expect(isStatKey('bigram', k)).toBe(false)
  })
})

describe('parseKeyStats', () => {
  it('不是陣列就當作沒有資料', () => {
    for (const v of [null, undefined, 'x', 3, {}]) expect(parseKeyStats(v)).toEqual([])
  })

  it('合法的列原樣保留（多餘的欄位會被拿掉）', () => {
    const good = row('s1', 1)
    expect(parseKeyStats([{ ...good, extra: 1 }])).toEqual([good])
  })

  it('壞掉的列會被略過', () => {
    const good = row('s1', 1)
    const bad = [
      null,
      'x',
      { ...good, id: '' },
      { ...good, sessionId: 5 },
      { ...good, playedAt: -1 },
      { ...good, kind: 'word' },
      { ...good, key: 'A' },
      { ...good, kind: 'bigram', key: 'a' },
      { ...good, attempts: NaN },
      { ...good, errors: 11 },
      { ...good, timedCount: 11 },
      { ...good, totalMs: '1600' },
    ]
    expect(parseKeyStats([...bad, good])).toEqual([good])
  })
})

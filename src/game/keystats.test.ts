import { describe, expect, it } from 'vitest'
import { appendSessionStats, isStatKey, parseKeyStats, statKey, summarizeSession, type KeyEvent, type KeyStatRow } from './keystats.ts'

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

describe('summarizeSession', () => {
  const meta = { sessionId: 's1', playedAt: 1790000000000 }
  const ok = (expected: string, prev: string | null, intervalMs: number | null): KeyEvent => ({ expected, actual: expected, correct: true, prev, intervalMs })
  const miss = (expected: string, actual: string, prev: string | null, intervalMs: number | null): KeyEvent => ({ expected, actual, correct: false, prev, intervalMs })
  const find = (rows: KeyStatRow[], kind: string, key: string) => rows.find((r) => r.kind === kind && r.key === key)

  it('沒有按鍵就沒有統計', () => {
    expect(summarizeSession([], meta)).toEqual([])
  })

  it('每個鍵、每個字母組合各一列，帶著場次與時間', () => {
    // 打 "the"：t(第一鍵沒有間隔) h(200) e(150)
    const rows = summarizeSession([ok('t', null, null), ok('h', 't', 200), ok('e', 'h', 150)], meta)
    expect(rows.map((r) => r.id).sort()).toEqual(['s1:bigram:he', 's1:bigram:th', 's1:char:e', 's1:char:h', 's1:char:t'])
    expect(rows.every((r) => r.sessionId === 's1' && r.playedAt === 1790000000000)).toBe(true)
    expect(find(rows, 'char', 't')).toMatchObject({ attempts: 1, errors: 0, timedCount: 0, totalMs: 0 })
    expect(find(rows, 'char', 'h')).toMatchObject({ attempts: 1, errors: 0, timedCount: 1, totalMs: 200 })
    expect(find(rows, 'bigram', 'th')).toMatchObject({ attempts: 1, errors: 0, timedCount: 1, totalMs: 200 })
    expect(find(rows, 'bigram', 'he')).toMatchObject({ attempts: 1, errors: 0, timedCount: 1, totalMs: 150 })
  })

  it('打錯算一次錯誤；改對的那一鍵不算反應時間', () => {
    // 打 "th"：t，h 先打成 j（180），再打對（300）
    const rows = summarizeSession([ok('t', null, 250), miss('h', 'j', 't', 180), ok('h', 't', 300)], meta)
    expect(find(rows, 'char', 'h')).toMatchObject({ attempts: 2, errors: 1, timedCount: 0, totalMs: 0 })
    expect(find(rows, 'bigram', 'th')).toMatchObject({ attempts: 2, errors: 1, timedCount: 0, totalMs: 0 })
    expect(find(rows, 'char', 'j')).toBeUndefined() // 統計記在「應該打的鍵」上
  })

  it('大寫字母併到小寫；數字、標點、空白各自統計，但不組成字母組合', () => {
    // 打 "Hi 1!"
    const rows = summarizeSession([ok('H', null, null), ok('i', 'H', 100), ok(' ', 'i', 100), ok('1', ' ', 100), ok('!', '1', 100)], meta)
    expect(rows.filter((r) => r.kind === 'char').map((r) => r.key).sort()).toEqual([' ', '!', '1', 'h', 'i'])
    expect(rows.filter((r) => r.kind === 'bigram').map((r) => r.key)).toEqual(['hi'])
    expect(statKey('Q')).toBe('q')
    expect(statKey(';')).toBe(';')
  })

  it('間隔太長（發呆）或沒有間隔的按鍵不算反應時間，但仍算次數', () => {
    const rows = summarizeSession([ok('a', null, 100), ok('a', 'a', 2001), ok('a', 'a', null), ok('a', 'a', 2000)], meta)
    expect(find(rows, 'char', 'a')).toMatchObject({ attempts: 4, errors: 0, timedCount: 1, totalMs: 2000 })
  })

  it('同一個鍵的次數與時間會累加，時間總和取整數', () => {
    const rows = summarizeSession([ok('a', null, null), ok('a', 'a', 100.4), ok('a', 'a', 100.4), miss('a', 's', 'a', 90)], meta)
    expect(find(rows, 'char', 'a')).toMatchObject({ attempts: 4, errors: 1, timedCount: 2, totalMs: 201 })
    expect(find(rows, 'bigram', 'aa')).toMatchObject({ attempts: 3, errors: 1, timedCount: 2, totalMs: 201 })
  })

  it('產生的列都通得過讀取時的驗證', () => {
    const rows = summarizeSession([ok('T', null, null), ok('h', 'T', 120), miss('e', 'r', 'h', 90), ok('e', 'h', 200), ok('!', 'e', 300)], meta)
    expect(parseKeyStats(JSON.parse(JSON.stringify(rows)))).toEqual(rows)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KEY_STATS_SESSION_LIMIT, type KeyStatRow } from '../game/index.ts'
import { localKeyStatsStore as store } from './keyStats.ts'

const row = (sessionId: string, playedAt: number, key = 'a'): KeyStatRow => ({
  id: `${sessionId}:char:${key}`,
  sessionId,
  playedAt,
  kind: 'char',
  key,
  attempts: 10,
  errors: 1,
  timedCount: 8,
  totalMs: 1600,
})

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('按鍵統計的儲存（localStorage）', () => {
  it('沒有資料時是空的', () => {
    expect(store.load()).toEqual([])
  })

  it('存一場之後讀得回來，只用 typingPaws2. 開頭的鍵', () => {
    const rows = [row('s1', 1, 'a'), row('s1', 1, 'b')]
    expect(store.saveSession(rows)).toEqual(rows)
    expect(store.load()).toEqual(rows)
    expect(Object.keys(localStorage)).toEqual(['typingPaws2.keyStats'])
  })

  it('每存一場就多一場，超過上限丟掉最舊的', () => {
    for (let i = 1; i <= KEY_STATS_SESSION_LIMIT + 2; i++) store.saveSession([row(`s${i}`, i)])
    const sessions = store.load().map((r) => r.sessionId)
    expect(sessions).toHaveLength(KEY_STATS_SESSION_LIMIT)
    expect(sessions[0]).toBe('s3')
  })

  it('讀到壞掉的資料不會當機', () => {
    localStorage.setItem('typingPaws2.keyStats', '{not json')
    expect(store.load()).toEqual([])
    localStorage.setItem('typingPaws2.keyStats', JSON.stringify([{ nope: 1 }, row('s1', 1)]))
    expect(store.load()).toEqual([row('s1', 1)])
  })

  it('清除後回到空狀態，不動其他資料', () => {
    store.saveSession([row('s1', 1)])
    localStorage.setItem('typingPaws2.hero', 'panda')
    localStorage.setItem('typingPaws.v1', '{"best":{},"history":[]}')
    store.clear()
    expect(store.load()).toEqual([])
    expect(localStorage.getItem('typingPaws2.hero')).toBe('panda')
    expect(localStorage.getItem('typingPaws.v1')).toBe('{"best":{},"history":[]}')
  })

  it('localStorage 不能用時不會當機，saveSession 仍回傳這一場的列', () => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new Error('blocked')
      })
    }
    expect(store.load()).toEqual([])
    expect(store.saveSession([row('s1', 1)])).toEqual([row('s1', 1)])
    expect(() => store.clear()).not.toThrow()
  })
})

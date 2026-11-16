import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { findLegacyImport, markLegacyAsked } from './legacy.ts'

const LEGACY_KEY = 'typingPaws.v1'
const LEGACY_RAW = JSON.stringify({
  avatar: 'panda',
  best: { easy: { score: 3210, wpm: 45, combo: 31, acc: 96.5, clears: 2 } },
  history: [{ t: 1790000000000, diff: 'easy', win: true, wpm: 45, acc: 96.5, combo: 31, score: 3210, stage: 3 }],
})

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('1.0 舊紀錄的偵測', () => {
  it('沒有舊紀錄時是 null', () => {
    expect(findLegacyImport()).toBeNull()
  })

  it('有舊紀錄時轉成可匯入的資料，而且不改動舊紀錄', () => {
    localStorage.setItem(LEGACY_KEY, LEGACY_RAW)
    const found = findLegacyImport()!
    expect(found.hero).toBe('panda')
    expect(found.records.history).toHaveLength(1)
    expect(found.records.best.easy?.clears).toBe(2)
    expect(localStorage.getItem(LEGACY_KEY)).toBe(LEGACY_RAW)
  })

  it('舊紀錄壞掉或是空的就不詢問', () => {
    localStorage.setItem(LEGACY_KEY, '{oops')
    expect(findLegacyImport()).toBeNull()
    localStorage.setItem(LEGACY_KEY, '{"best":{},"history":[]}')
    expect(findLegacyImport()).toBeNull()
  })

  it.each(['imported', 'skipped'] as const)('回答過（%s）之後不再詢問，舊紀錄原封不動', (answer) => {
    localStorage.setItem(LEGACY_KEY, LEGACY_RAW)
    markLegacyAsked(answer)
    expect(localStorage.getItem('typingPaws2.legacyImport')).toBe(answer)
    expect(findLegacyImport()).toBeNull()
    expect(localStorage.getItem(LEGACY_KEY)).toBe(LEGACY_RAW)
  })

  it('只會讀取舊紀錄的鍵，不會寫入或刪除它', () => {
    localStorage.setItem(LEGACY_KEY, LEGACY_RAW)
    const set = vi.spyOn(Storage.prototype, 'setItem')
    const remove = vi.spyOn(Storage.prototype, 'removeItem')
    findLegacyImport()
    markLegacyAsked('imported')
    expect(set.mock.calls.every(([key]) => key.startsWith('typingPaws2.'))).toBe(true)
    expect(remove).not.toHaveBeenCalled()
  })

  it('localStorage 不能用時不會當機', () => {
    for (const method of ['getItem', 'setItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new Error('blocked')
      })
    }
    expect(findLegacyImport()).toBeNull()
    expect(() => markLegacyAsked('skipped')).not.toThrow()
  })
})

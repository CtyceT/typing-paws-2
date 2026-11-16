import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addResult, EMPTY_RECORDS, type BattleResult } from '../game/index.ts'
import { clearRecords, loadRecords, saveRecords } from './records.ts'

const LEGACY_KEY = 'typingPaws.v1'
const result: BattleResult = { difficulty: 'easy', win: true, wpm: 40, accuracy: 95, maxCombo: 20, score: 3000, damage: 290, durationMs: 60000, stage: 3, stars: 3 }
const sample = addResult(EMPTY_RECORDS, result, { id: 'a', playedAt: 1790000000000 })

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('戰績的儲存', () => {
  it('沒有資料時是空紀錄', () => {
    expect(loadRecords()).toEqual(EMPTY_RECORDS)
  })

  it('存了之後讀得回來，鍵都是 typingPaws2. 開頭', () => {
    saveRecords(sample)
    expect(loadRecords()).toEqual(sample)
    expect(Object.keys(localStorage).sort()).toEqual(['typingPaws2.best', 'typingPaws2.history'])
  })

  it('讀到壞掉的資料不會當機', () => {
    localStorage.setItem('typingPaws2.best', '{not json')
    localStorage.setItem('typingPaws2.history', '"oops"')
    expect(loadRecords()).toEqual(EMPTY_RECORDS)
  })

  it('其中一份壞掉時，另一份照常讀取', () => {
    saveRecords(sample)
    localStorage.setItem('typingPaws2.best', '{not json')
    expect(loadRecords()).toEqual({ best: {}, history: sample.history })
  })

  it('清除後回到空狀態，但不動勇者選擇和 1.0 的資料', () => {
    saveRecords(sample)
    localStorage.setItem('typingPaws2.hero', 'panda')
    localStorage.setItem(LEGACY_KEY, '{"best":{},"history":[]}')
    expect(clearRecords()).toEqual(EMPTY_RECORDS)
    expect(loadRecords()).toEqual(EMPTY_RECORDS)
    expect(localStorage.getItem('typingPaws2.hero')).toBe('panda')
    expect(localStorage.getItem(LEGACY_KEY)).toBe('{"best":{},"history":[]}')
  })

  it('localStorage 不能用時不會當機', () => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new Error('blocked')
      })
    }
    expect(loadRecords()).toEqual(EMPTY_RECORDS)
    expect(() => saveRecords(sample)).not.toThrow()
    expect(clearRecords()).toEqual(EMPTY_RECORDS)
  })
})

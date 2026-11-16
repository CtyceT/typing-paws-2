import { beforeEach, describe, expect, it } from 'vitest'
import { loadDirty, loadPending, saveDirty, savePending } from './pending.ts'

beforeEach(() => localStorage.clear())

describe('待上傳清單', () => {
  it('沒有資料時是空的；存了讀得回來，鍵在帳號底下', () => {
    expect(loadPending('u1')).toEqual([])
    savePending(['a', 'b'], 'u1')
    expect(loadPending('u1')).toEqual(['a', 'b'])
    expect(loadPending('u2')).toEqual([])
    expect(Object.keys(localStorage)).toEqual(['typingPaws2.u.u1.pending'])
  })

  it('清單空了就把鍵刪掉', () => {
    savePending(['a'], 'u1')
    savePending([], 'u1')
    expect(localStorage.length).toBe(0)
  })

  it('壞掉的資料當作空的，重複和不是字串的項目會被丟掉', () => {
    localStorage.setItem('typingPaws2.u.u1.pending', '{oops')
    expect(loadPending('u1')).toEqual([])
    localStorage.setItem('typingPaws2.u.u1.pending', JSON.stringify(['a', 1, 'a', '', null, 'b']))
    expect(loadPending('u1')).toEqual(['a', 'b'])
  })

  it('還沒上傳的記號：勇者和最佳紀錄各自一個', () => {
    expect(loadDirty('hero', 'u1')).toBe(false)
    saveDirty('hero', true, 'u1')
    saveDirty('best', true, 'u1')
    expect(loadDirty('hero', 'u1')).toBe(true)
    expect(Object.keys(localStorage).sort()).toEqual(['typingPaws2.u.u1.bestDirty', 'typingPaws2.u.u1.heroDirty'])
    saveDirty('hero', false, 'u1')
    expect(loadDirty('hero', 'u1')).toBe(false)
    expect(loadDirty('best', 'u1')).toBe(true)
    saveDirty('best', false, 'u1')
    expect(localStorage.length).toBe(0)
  })
})

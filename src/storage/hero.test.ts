import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadHero, saveHero } from './hero.ts'
import { STORAGE_KEYS, STORAGE_PREFIX } from './keys.ts'

const LEGACY_KEY = 'typingPaws.v1'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('儲存鍵', () => {
  it('全部以 typingPaws2. 開頭，不會撞到 1.0 的鍵', () => {
    expect(STORAGE_PREFIX).toBe('typingPaws2.')
    for (const key of Object.values(STORAGE_KEYS)) {
      expect(key.startsWith(STORAGE_PREFIX)).toBe(true)
      expect(key).not.toBe(LEGACY_KEY)
    }
  })
})

describe('勇者選擇的儲存', () => {
  it('沒有紀錄時是預設勇者', () => {
    expect(loadHero()).toBe('cat')
  })

  it('存了之後讀得回來', () => {
    saveHero('panda')
    expect(localStorage.getItem('typingPaws2.hero')).toBe('panda')
    expect(loadHero()).toBe('panda')
  })

  it('讀到不認識的值就用預設勇者', () => {
    localStorage.setItem('typingPaws2.hero', 'dragon')
    expect(loadHero()).toBe('cat')
  })

  it('不會動到 1.0 的紀錄', () => {
    const legacy = JSON.stringify({ best: {}, history: [], avatar: 'bunny' })
    localStorage.setItem(LEGACY_KEY, legacy)
    saveHero('shiba')
    expect(loadHero()).toBe('shiba')
    expect(localStorage.getItem(LEGACY_KEY)).toBe(legacy)
  })

  it('localStorage 不能用時不會當機', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(loadHero()).toBe('cat')
    expect(() => saveHero('bunny')).not.toThrow()
  })
})

import { describe, expect, it } from 'vitest'
import { createSeededRng } from './rng.ts'

describe('createSeededRng', () => {
  it('同一個種子產生同一串數字', () => {
    const a = createSeededRng(42)
    const b = createSeededRng(42)
    expect(Array.from({ length: 20 }, a)).toEqual(Array.from({ length: 20 }, b))
  })

  it('不同種子產生不同數字', () => {
    expect(createSeededRng(1)()).not.toBe(createSeededRng(2)())
  })

  it('數字都落在 [0, 1)', () => {
    const rng = createSeededRng(7)
    for (let i = 0; i < 1000; i++) {
      const n = rng()
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(1)
    }
  })
})

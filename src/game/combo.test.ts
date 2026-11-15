import { describe, expect, it } from 'vitest'
import { comboMultiplier, isCrit, wordDamage } from './combo.ts'

describe('comboMultiplier', () => {
  it('每 10 Combo +0.5', () => {
    expect(comboMultiplier(0)).toBe(1)
    expect(comboMultiplier(9)).toBe(1)
    expect(comboMultiplier(10)).toBe(1.5)
    expect(comboMultiplier(19)).toBe(1.5)
    expect(comboMultiplier(20)).toBe(2)
    expect(comboMultiplier(30)).toBe(2.5)
    expect(comboMultiplier(39)).toBe(2.5)
  })

  it('上限 ×3', () => {
    expect(comboMultiplier(40)).toBe(3)
    expect(comboMultiplier(50)).toBe(3)
    expect(comboMultiplier(9999)).toBe(3)
  })

  it('負數當成 0', () => {
    expect(comboMultiplier(-5)).toBe(1)
  })
})

describe('wordDamage', () => {
  it('字長 × 3 × 倍率', () => {
    expect(wordDamage(3, 0)).toBe(9)
    expect(wordDamage(6, 10)).toBe(27)
    expect(wordDamage(6, 20)).toBe(36)
    expect(wordDamage(13, 40)).toBe(117)
  })

  it('結果四捨五入', () => {
    expect(wordDamage(3, 10)).toBe(14) // 13.5 → 14
    expect(wordDamage(5, 30)).toBe(38) // 37.5 → 38
  })
})

describe('isCrit', () => {
  it('倍率 ×2 以上才是爆擊', () => {
    expect(isCrit(19)).toBe(false)
    expect(isCrit(20)).toBe(true)
  })
})

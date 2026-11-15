import { describe, expect, it } from 'vitest'
import { calcAccuracy, calcStars, calcWpm } from './stats.ts'

describe('calcWpm', () => {
  it('每 5 個正確字元算一個字', () => {
    expect(calcWpm(250, 60000)).toBe(50)
    expect(calcWpm(100, 30000)).toBe(40)
  })

  it('四捨五入', () => {
    expect(calcWpm(13, 60000)).toBe(3) // 2.6
    expect(calcWpm(12, 60000)).toBe(2) // 2.4
  })

  it('0 秒時是 0，不會除以零', () => {
    expect(calcWpm(0, 0)).toBe(0)
    expect(calcWpm(10, 0)).toBe(0)
  })

  it('沒有打對任何字是 0', () => {
    expect(calcWpm(0, 60000)).toBe(0)
  })
})

describe('calcAccuracy', () => {
  it('0 次按鍵時是 100', () => {
    expect(calcAccuracy(0, 0)).toBe(100)
  })

  it('保留一位小數', () => {
    expect(calcAccuracy(2, 3)).toBe(66.7)
    expect(calcAccuracy(95, 100)).toBe(95)
    expect(calcAccuracy(199, 200)).toBe(99.5)
  })

  it('全對與全錯', () => {
    expect(calcAccuracy(10, 10)).toBe(100)
    expect(calcAccuracy(0, 10)).toBe(0)
  })
})

describe('calcStars', () => {
  it('失敗一律 0 星', () => {
    expect(calcStars(false, 100, 100)).toBe(0)
  })

  it('準確率 ≥ 95 且血量 ≥ 50 得 3 星', () => {
    expect(calcStars(true, 95, 50)).toBe(3)
    expect(calcStars(true, 100, 100)).toBe(3)
  })

  it('準確率夠但血量不足只有 2 星', () => {
    expect(calcStars(true, 99, 49)).toBe(2)
  })

  it('準確率 85～95 得 2 星', () => {
    expect(calcStars(true, 94.9, 100)).toBe(2)
    expect(calcStars(true, 85, 10)).toBe(2)
  })

  it('準確率低於 85 得 1 星', () => {
    expect(calcStars(true, 84.9, 100)).toBe(1)
  })
})

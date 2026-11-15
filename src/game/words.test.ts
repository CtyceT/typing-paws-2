import { describe, expect, it } from 'vitest'
import { DIFFICULTY_ORDER } from './difficulty.ts'
import { isPrintableAscii, WORDS } from './words.ts'

describe('isPrintableAscii', () => {
  it('接受英數、空白與標點', () => {
    expect(isPrintableAscii('Hello, World!')).toBe(true)
    expect(isPrintableAscii(' ~')).toBe(true)
  })

  it('拒絕空字串、中文、全形、控制字元與 emoji', () => {
    expect(isPrintableAscii('')).toBe(false)
    expect(isPrintableAscii('貓')).toBe(false)
    expect(isPrintableAscii('ａｂｃ')).toBe(false)
    expect(isPrintableAscii('a\tb')).toBe(false)
    expect(isPrintableAscii('a\nb')).toBe(false)
    expect(isPrintableAscii('\x7F')).toBe(false)
    expect(isPrintableAscii('cat🐱')).toBe(false)
  })
})

describe.each(DIFFICULTY_ORDER)('WORDS.%s', (difficulty) => {
  const words = WORDS[difficulty]

  it('每個字都只含可列印 ASCII', () => {
    expect(words.filter((w) => !isPrintableAscii(w))).toEqual([])
  })

  it('頭尾沒有空白，中間沒有連續空白', () => {
    expect(words.filter((w) => w !== w.trim() || w.includes('  '))).toEqual([])
  })

  it('沒有重複的字', () => {
    expect(new Set(words).size).toBe(words.length)
  })

  it('字數足夠讓出題避開最近 8 個', () => {
    expect(words.length).toBeGreaterThan(8)
  })
})

describe('WORDS 難度特性', () => {
  it('簡單與普通只有小寫字母', () => {
    for (const w of [...WORDS.easy, ...WORDS.normal]) expect(w).toMatch(/^[a-z]+$/)
  })

  it('簡單 3～5 個字母，普通 5～8 個字母', () => {
    for (const w of WORDS.easy) expect(w.length, w).toBeGreaterThanOrEqual(3)
    for (const w of WORDS.easy) expect(w.length, w).toBeLessThanOrEqual(5)
    for (const w of WORDS.normal) expect(w.length, w).toBeGreaterThanOrEqual(5)
    for (const w of WORDS.normal) expect(w.length, w).toBeLessThanOrEqual(8)
  })
})

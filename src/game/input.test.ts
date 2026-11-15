import { describe, expect, it } from 'vitest'
import { isTypeable, normalizeChar, toHalfWidth } from './input.ts'

describe('toHalfWidth', () => {
  it('全形英數轉半形', () => {
    expect(toHalfWidth('ａ')).toBe('a')
    expect(toHalfWidth('Ｚ')).toBe('Z')
    expect(toHalfWidth('０')).toBe('0')
    expect(toHalfWidth('９')).toBe('9')
  })

  it('全形標點轉半形（範圍頭尾 ！ 與 ～）', () => {
    expect(toHalfWidth('！')).toBe('!')
    expect(toHalfWidth('～')).toBe('~')
    expect(toHalfWidth('，')).toBe(',')
    expect(toHalfWidth('；')).toBe(';')
    expect(toHalfWidth('＆')).toBe('&')
  })

  it('全形空白轉一般空白', () => {
    expect(toHalfWidth('　')).toBe(' ')
  })

  it('半形字元與其他字元不變', () => {
    expect(toHalfWidth('a')).toBe('a')
    expect(toHalfWidth(' ')).toBe(' ')
    expect(toHalfWidth('貓')).toBe('貓')
    expect(toHalfWidth('。')).toBe('。')
    expect(toHalfWidth('ㄅ')).toBe('ㄅ')
  })
})

describe('isTypeable', () => {
  it('接受可列印 ASCII 的頭尾與一般字元', () => {
    for (const ch of [' ', '~', 'a', 'Z', '5', '!', ';', '&']) expect(isTypeable(ch), ch).toBe(true)
  })

  it('拒絕控制字元', () => {
    for (const ch of ['\n', '\t', '\r', '\x00', '\x1F', '\x7F']) expect(isTypeable(ch)).toBe(false)
  })

  it('拒絕中文、注音、全形與 emoji', () => {
    for (const ch of ['貓', 'ㄅ', 'ａ', '　', '🐱']) expect(isTypeable(ch), ch).toBe(false)
  })

  it('拒絕空字串與多個字元', () => {
    expect(isTypeable('')).toBe(false)
    expect(isTypeable('ab')).toBe(false)
  })
})

describe('normalizeChar', () => {
  it('半形與全形英數都回傳半形字元', () => {
    expect(normalizeChar('a')).toBe('a')
    expect(normalizeChar('Ａ')).toBe('A')
    expect(normalizeChar('７')).toBe('7')
    expect(normalizeChar('　')).toBe(' ')
  })

  it('中文字、注音、控制字元回傳 null', () => {
    for (const ch of ['貓', 'ㄅ', '。', '\n', '\x7F', '']) expect(normalizeChar(ch)).toBeNull()
  })
})

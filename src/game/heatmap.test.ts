import { describe, expect, it } from 'vitest'
import type { KeyAggregate } from './analysis.ts'
import { formatRate, heatKeyInfo, heatLevel, heatmapRows, KEYBOARD_ROWS, physicalKey } from './heatmap.ts'
import { WORDS } from './words.ts'
import { statKey } from './keystats.ts'

const agg = (key: string, attempts: number, errors: number, avgMs: number | null = 200, timedCount = attempts - errors): KeyAggregate => ({
  kind: 'char',
  key,
  attempts,
  errors,
  errorRate: attempts > 0 ? errors / attempts : 0,
  timedCount: avgMs === null ? 0 : timedCount,
  avgMs,
})
const find = (rows: ReturnType<typeof heatmapRows>, key: string) => rows.flat().find((k) => k.key === key)!

describe('鍵盤配置', () => {
  it('每顆鍵只出現一次', () => {
    const keys = KEYBOARD_ROWS.join('')
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('Shift 符號併到原本的鍵，其他字元不變', () => {
    expect(physicalKey('!')).toBe('1')
    expect(physicalKey('&')).toBe('7')
    expect(physicalKey('+')).toBe('=')
    expect(physicalKey('a')).toBe('a')
    expect(physicalKey(';')).toBe(';')
  })

  it('內建字庫的每個字元都找得到對應的鍵', () => {
    const keys = new Set(KEYBOARD_ROWS.join(''))
    for (const word of Object.values(WORDS).flat()) {
      for (const ch of word) expect(keys.has(physicalKey(statKey(ch))), `「${word}」的 ${ch}`).toBe(true)
    }
  })
})

describe('heatLevel', () => {
  it('次數太少不上色', () => {
    expect(heatLevel(4, 1)).toBe(0)
    expect(heatLevel(0, 0)).toBe(0)
  })

  it('依錯誤率分成 5 級', () => {
    expect([0, 0.019, 0.02, 0.049, 0.05, 0.099, 0.1, 0.199, 0.2, 1].map((r) => heatLevel(50, r))).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
  })
})

describe('heatmapRows', () => {
  it('沒有資料時整個鍵盤都在，次數是 0、不上色', () => {
    const rows = heatmapRows([])
    expect(rows.map((r) => r.length)).toEqual([13, 13, 11, 10, 1])
    expect(rows.flat().every((k) => k.attempts === 0 && k.level === 0 && k.avgMs === null)).toBe(true)
    expect(find(rows, 'q').label).toBe('Q')
    expect(find(rows, ' ').label).toBe('空白')
  })

  it('把統計放到對應的鍵上，常打錯的鍵等級比較高', () => {
    const rows = heatmapRows([agg('e', 50, 12), agg('a', 50, 0), agg('q', 3, 3)])
    expect(find(rows, 'e')).toMatchObject({ attempts: 50, errors: 12, errorRate: 0.24, avgMs: 200, level: 5 })
    expect(find(rows, 'a')).toMatchObject({ attempts: 50, errors: 0, level: 1 })
    expect(find(rows, 'q')).toMatchObject({ attempts: 3, errors: 3, level: 0 })
  })

  it('Shift 符號和原本的鍵加在一起，平均時間依計時次數加權', () => {
    const rows = heatmapRows([agg('1', 10, 0, 100, 10), agg('!', 10, 5, 400, 5)])
    expect(find(rows, '1')).toMatchObject({ attempts: 20, errors: 5, errorRate: 0.25, avgMs: 200, level: 5 })
  })

  it('字母組合不會算進去', () => {
    const rows = heatmapRows([{ ...agg('th', 40, 20), kind: 'bigram' }])
    expect(rows.flat().every((k) => k.attempts === 0)).toBe(true)
  })
})

describe('顯示文字', () => {
  it('formatRate', () => {
    expect([0, 0.1, 0.115, 1 / 3, 1].map(formatRate)).toEqual(['0%', '10%', '11.5%', '33.3%', '100%'])
  })

  it('heatKeyInfo', () => {
    const rows = heatmapRows([agg('e', 52, 6, 210), agg('q', 3, 1, null)])
    expect(heatKeyInfo(find(rows, 'e'))).toBe('E：打了 52 次・錯 6 次（11.5%）・平均 210 ms')
    expect(heatKeyInfo(find(rows, 'q'))).toBe('Q：打了 3 次・錯 1 次（33.3%）・次數太少，先不上色')
    expect(heatKeyInfo(find(rows, 'z'))).toBe('Z：還沒有資料')
  })
})

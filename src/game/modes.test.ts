import { describe, expect, it } from 'vitest'
import { MODE_ORDER, MODES } from './modes.ts'

describe('遊戲模式', () => {
  it('順序包含所有模式且不重複', () => {
    expect([...MODE_ORDER].sort()).toEqual(Object.keys(MODES).sort())
    expect(new Set(MODE_ORDER).size).toBe(MODE_ORDER.length)
  })

  it('每個模式都有名稱、圖示與說明', () => {
    for (const id of MODE_ORDER) {
      const m = MODES[id]
      expect(m.label).not.toBe('')
      expect(m.icon).not.toBe('')
      expect(m.desc).not.toBe('')
    }
  })

  it('目前可以玩的是經典闖關與弱點特訓，經典闖關排在第一個', () => {
    expect(MODE_ORDER[0]).toBe('classic')
    expect(MODE_ORDER.filter((id) => MODES[id].available)).toEqual(['classic', 'training'])
  })
})

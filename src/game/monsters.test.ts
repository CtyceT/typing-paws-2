import { describe, expect, it } from 'vitest'
import { MONSTERS } from './monsters.ts'

describe('MONSTERS', () => {
  it('共有三關', () => {
    expect(MONSTERS).toHaveLength(3)
  })

  it('每隻怪物都有名字、台詞與正的數值', () => {
    for (const m of MONSTERS) {
      expect(m.emoji).not.toBe('')
      expect(m.name).not.toBe('')
      expect(m.line).not.toBe('')
      expect(m.hp).toBeGreaterThan(0)
      expect(m.damageScale).toBeGreaterThan(0)
    }
  })

  it('只有最後一隻是魔王', () => {
    expect(MONSTERS.map((m) => m.boss)).toEqual([false, false, true])
  })

  it('血量一關比一關高', () => {
    expect(MONSTERS[0].hp).toBeLessThan(MONSTERS[1].hp)
    expect(MONSTERS[1].hp).toBeLessThan(MONSTERS[2].hp)
  })
})

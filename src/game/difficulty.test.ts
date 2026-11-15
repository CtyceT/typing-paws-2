import { describe, expect, it } from 'vitest'
import { DIFFICULTIES, DIFFICULTY_ORDER } from './difficulty.ts'

describe('DIFFICULTIES', () => {
  it('順序清單與設定的鍵一致', () => {
    expect([...DIFFICULTY_ORDER].sort()).toEqual(Object.keys(DIFFICULTIES).sort())
    expect(DIFFICULTY_ORDER).toEqual(['easy', 'normal', 'hard'])
  })

  it('每個難度都有文字與正的數值', () => {
    for (const d of DIFFICULTY_ORDER) {
      const c = DIFFICULTIES[d]
      expect(c.label).not.toBe('')
      expect(c.icon).not.toBe('')
      expect(c.desc).not.toBe('')
      expect(c.chargeIntervalMs).toBeGreaterThan(0)
      expect(c.monsterDamage).toBeGreaterThan(0)
      expect(c.hpScale).toBeGreaterThan(0)
    }
  })

  it('越難的難度怪物出手越快、越痛、血越厚', () => {
    const [easy, normal, hard] = DIFFICULTY_ORDER.map((d) => DIFFICULTIES[d])
    expect(easy.chargeIntervalMs).toBeGreaterThan(normal.chargeIntervalMs)
    expect(normal.chargeIntervalMs).toBeGreaterThan(hard.chargeIntervalMs)
    expect(easy.monsterDamage).toBeLessThan(normal.monsterDamage)
    expect(normal.monsterDamage).toBeLessThan(hard.monsterDamage)
    expect(easy.hpScale).toBeLessThan(normal.hpScale)
    expect(normal.hpScale).toBeLessThan(hard.hpScale)
  })
})

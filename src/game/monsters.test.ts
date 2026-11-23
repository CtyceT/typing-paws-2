import { describe, expect, it } from 'vitest'
import PROFILE_FILE from './monster-profiles.json'
import { MONSTER_IDS, MONSTER_THEMES, MONSTERS, monsterById, randomTheme, SLOT_STATS, themeLineup, validateThemeProfiles } from './monsters.ts'

describe('monster-profiles.json（LLM 產生的設定）', () => {
  it('每個主題的 3 隻都通過驗證，而且資料和驗證後的結果完全相同', () => {
    for (const theme of MONSTER_THEMES) {
      const raw = PROFILE_FILE.monsters.filter((m) => m.theme === theme).map((m) => ({ name: m.name, line: m.line, weak_keys: m.weakKeys, look: m.look }))
      const v = validateThemeProfiles({ monsters: raw }, theme)
      expect(v.ok).toBe(true)
      if (v.ok) expect(v.profiles).toEqual(PROFILE_FILE.monsters.filter((m) => m.theme === theme))
    }
  })

  it('12 隻的名字都不重複', () => {
    expect(new Set(MONSTERS.map((m) => m.name)).size).toBe(12)
  })
})

describe('MONSTERS', () => {
  it('共 12 隻，依編號排列', () => {
    expect(MONSTERS.map((m) => m.id)).toEqual(MONSTER_IDS)
  })

  it('每隻都有 emoji 備案、正的數值、1～2 個弱點字母', () => {
    for (const m of MONSTERS) {
      expect(m.emoji).not.toBe('')
      expect(m.hp).toBeGreaterThan(0)
      expect(m.damageScale).toBeGreaterThan(0)
      expect(m.weakKeys.length).toBeGreaterThanOrEqual(1)
      expect(m.weakKeys.length).toBeLessThanOrEqual(2)
    }
  })

  it('找不到的編號會丟出錯誤', () => {
    expect(() => monsterById('monster-13' as never)).toThrow()
  })
})

describe('themeLineup', () => {
  it('每個主題三關：小怪、小怪、魔王，編號連續', () => {
    expect(themeLineup('daily').map((m) => m.id)).toEqual(['monster-01', 'monster-02', 'monster-03'])
    expect(themeLineup('fantasy').map((m) => m.id)).toEqual(['monster-04', 'monster-05', 'monster-06'])
    expect(themeLineup('space').map((m) => m.id)).toEqual(['monster-07', 'monster-08', 'monster-09'])
    expect(themeLineup('school').map((m) => m.id)).toEqual(['monster-10', 'monster-11', 'monster-12'])
  })

  it('只有第 3 隻是魔王，血量一關比一關高，數值和 1.0 版的三關相同', () => {
    for (const theme of MONSTER_THEMES) {
      const lineup = themeLineup(theme)
      expect(lineup.map((m) => m.boss)).toEqual([false, false, true])
      expect(lineup.map((m) => m.theme)).toEqual([theme, theme, theme])
      expect(lineup.map((m) => ({ hp: m.hp, damageScale: m.damageScale }))).toEqual(SLOT_STATS)
    }
    expect(SLOT_STATS.map((s) => s.hp)).toEqual([60, 90, 140])
  })
})

describe('randomTheme', () => {
  it('依亂數平均挑四個主題之一', () => {
    expect(randomTheme(() => 0)).toBe('daily')
    expect(randomTheme(() => 0.25)).toBe('fantasy')
    expect(randomTheme(() => 0.5)).toBe('space')
    expect(randomTheme(() => 0.99)).toBe('school')
  })
})

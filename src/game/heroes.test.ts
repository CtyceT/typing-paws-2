import { describe, expect, it } from 'vitest'
import { DEFAULT_HERO, HERO_ORDER, HEROES, INK, toHeroId } from './heroes.ts'

const HEX = /^#[0-9a-f]{6}$/

describe('HEROES', () => {
  it('有四位勇者，順序清單與資料的鍵一致', () => {
    expect(HERO_ORDER).toEqual(['cat', 'shiba', 'bunny', 'panda'])
    expect([...HERO_ORDER].sort()).toEqual(Object.keys(HEROES).sort())
  })

  it('每位勇者都有名字、副標與合法色碼', () => {
    expect(INK).toMatch(HEX)
    for (const id of HERO_ORDER) {
      const h = HEROES[id]
      expect(h.name).not.toBe('')
      expect(h.sub).not.toBe('')
      for (const color of [h.main, h.scarf, h.dark, h.light, h.inner]) {
        if (color !== undefined) expect(color).toMatch(HEX)
      }
    }
  })

  it('預設勇者是喵喵', () => {
    expect(DEFAULT_HERO).toBe('cat')
    expect(HEROES[DEFAULT_HERO].name).toBe('喵喵')
  })
})

describe('toHeroId', () => {
  it('合法代號原樣回傳', () => {
    for (const id of HERO_ORDER) expect(toHeroId(id)).toBe(id)
  })

  it('不合法的值退回預設勇者', () => {
    for (const v of ['dragon', '', undefined, null, 3, {}]) expect(toHeroId(v)).toBe(DEFAULT_HERO)
  })
})

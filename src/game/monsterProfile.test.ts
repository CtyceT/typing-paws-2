import { describe, expect, it } from 'vitest'
import { MONSTER_IDS, monsterIdFor, validateMonsterProfile, validateThemeProfiles } from './monsterProfile.ts'

const slot = { id: 'monster-07', theme: 'space', boss: false } as const
const good = { name: '流星小鼠', line: '嘰嘰！你的手指追得上流星嗎？', weak_keys: ['s', 'r'], look: 'a tiny round mouse riding a glowing meteor' }

describe('monsterIdFor', () => {
  it('編號依主題排列：01～03 日常、04～06 奇幻、07～09 太空、10～12 校園', () => {
    expect(monsterIdFor('daily', 0)).toBe('monster-01')
    expect(monsterIdFor('fantasy', 2)).toBe('monster-06')
    expect(monsterIdFor('space', 0)).toBe('monster-07')
    expect(monsterIdFor('school', 2)).toBe('monster-12')
    expect(MONSTER_IDS).toHaveLength(12)
  })
})

describe('validateMonsterProfile', () => {
  it('正常的輸出：補上編號、主題，弱點轉小寫去重複', () => {
    const v = validateMonsterProfile({ ...good, name: '  流星小鼠 ', weak_keys: ['S', 's', 'R'] }, slot)
    expect(v).toEqual({ ok: true, profile: { ...slot, name: '流星小鼠', line: good.line, weakKeys: ['s', 'r'], look: good.look } })
  })

  it('名字可以夾英文字，但不能只有英文、不能有 emoji 或標點、不能太長', () => {
    expect(validateMonsterProfile({ ...good, name: 'Typo 幽靈' }, slot).ok).toBe(true)
    expect(validateMonsterProfile({ ...good, name: 'Typo Ghost' }, slot)).toEqual({ ok: false, issue: 'bad_name' })
    expect(validateMonsterProfile({ ...good, name: '流星🐭' }, slot)).toEqual({ ok: false, issue: 'bad_name' })
    expect(validateMonsterProfile({ ...good, name: '流星！鼠' }, slot)).toEqual({ ok: false, issue: 'bad_name' })
    expect(validateMonsterProfile({ ...good, name: '超級無敵宇宙銀河流星小老鼠' }, slot)).toEqual({ ok: false, issue: 'bad_name' })
    expect(validateMonsterProfile({ ...good, name: '鼠' }, slot)).toEqual({ ok: false, issue: 'bad_name' })
  })

  it('台詞：允許全形標點和～…，不能有 emoji、不能太長太短、不能全是英文', () => {
    expect(validateMonsterProfile({ ...good, line: '嘿嘿～你一定會打錯字的…' }, slot).ok).toBe(true)
    expect(validateMonsterProfile({ ...good, line: '嘿嘿～你一定會打錯字的💥' }, slot)).toEqual({ ok: false, issue: 'bad_line' })
    expect(validateMonsterProfile({ ...good, line: '吼！' }, slot)).toEqual({ ok: false, issue: 'bad_line' })
    expect(validateMonsterProfile({ ...good, line: '一'.repeat(31) }, slot)).toEqual({ ok: false, issue: 'bad_line' })
    expect(validateMonsterProfile({ ...good, line: 'You will never win!' }, slot)).toEqual({ ok: false, issue: 'bad_line' })
  })

  it('弱點：1～2 個 a～z 字母', () => {
    expect(validateMonsterProfile({ ...good, weak_keys: ['q'] }, slot).ok).toBe(true)
    expect(validateMonsterProfile({ ...good, weak_keys: [] }, slot)).toEqual({ ok: false, issue: 'bad_weak_keys' })
    expect(validateMonsterProfile({ ...good, weak_keys: ['a', 'b', 'c'] }, slot)).toEqual({ ok: false, issue: 'bad_weak_keys' })
    expect(validateMonsterProfile({ ...good, weak_keys: ['th'] }, slot)).toEqual({ ok: false, issue: 'bad_weak_keys' })
    expect(validateMonsterProfile({ ...good, weak_keys: ['4'] }, slot)).toEqual({ ok: false, issue: 'bad_weak_keys' })
    expect(validateMonsterProfile({ ...good, weak_keys: 'sr' }, slot)).toEqual({ ok: false, issue: 'bad_weak_keys' })
  })

  it('外觀描述：排版用的連字號、引號、刪節號先換成 ASCII', () => {
    const v = validateMonsterProfile({ ...good, look: 'candy\u2011cane whiskers \u2014 \u201cbig\u201d eyes\u2026' }, slot)
    expect(v.ok && v.profile.look).toBe('candy-cane whiskers - "big" eyes...')
  })

  it('外觀描述：可列印 ASCII，200 字元以內', () => {
    expect(validateMonsterProfile({ ...good, look: '一隻老鼠' }, slot)).toEqual({ ok: false, issue: 'bad_look' })
    expect(validateMonsterProfile({ ...good, look: 'x'.repeat(201) }, slot)).toEqual({ ok: false, issue: 'bad_look' })
    expect(validateMonsterProfile({ ...good, look: '' }, slot)).toEqual({ ok: false, issue: 'bad_look' })
  })

  it('不是物件', () => {
    expect(validateMonsterProfile(null, slot)).toEqual({ ok: false, issue: 'not_object' })
    expect(validateMonsterProfile([good], slot)).toEqual({ ok: false, issue: 'not_object' })
    expect(validateMonsterProfile('流星小鼠', slot)).toEqual({ ok: false, issue: 'not_object' })
  })
})

describe('validateThemeProfiles', () => {
  const three = [good, { ...good, name: '黑洞水母' }, { ...good, name: '星雲巨龍王' }]

  it('三隻都合格：依序是小怪、小怪、魔王，編號對應主題', () => {
    const v = validateThemeProfiles({ monsters: three }, 'space')
    expect(v.ok).toBe(true)
    if (!v.ok) return
    expect(v.profiles.map((p) => [p.id, p.boss])).toEqual([
      ['monster-07', false],
      ['monster-08', false],
      ['monster-09', true],
    ])
  })

  it('數量不是 3、名字重複、其中一隻不合格', () => {
    expect(validateThemeProfiles({ monsters: three.slice(0, 2) }, 'space')).toEqual({ ok: false, issue: 'bad_count' })
    expect(validateThemeProfiles(three, 'space')).toEqual({ ok: false, issue: 'bad_count' })
    expect(validateThemeProfiles({ monsters: [good, good, three[2]] }, 'space')).toEqual({ ok: false, issue: 'duplicate_name' })
    expect(validateThemeProfiles({ monsters: [good, { ...good, name: 'X' }, three[2]] }, 'space')).toEqual({ ok: false, issue: 'bad_name', index: 1 })
  })
})

import { describe, expect, it } from 'vitest'
import { effectsForEvents } from './effects.ts'

describe('effectsForEvents', () => {
  it('沒有事件就沒有特效', () => {
    expect(effectsForEvents([])).toEqual([])
  })

  it('打錯：題目晃一下；Combo 不到 10 不提示中斷', () => {
    expect(effectsForEvents([{ type: 'miss', comboLost: 9 }])).toEqual([{ type: 'shake', target: 'word', delayMs: 0 }])
  })

  it('打錯且 Combo 達 10：多一個「Combo 中斷…」', () => {
    expect(effectsForEvents([{ type: 'miss', comboLost: 10 }])).toContainEqual({
      type: 'float',
      target: 'combo',
      text: 'Combo 中斷…',
      tone: 'ouch',
      delayMs: 0,
    })
  })

  it('每 10 Combo：數字彈一下並跳出提示', () => {
    expect(effectsForEvents([{ type: 'comboMilestone', combo: 20 }])).toEqual([
      { type: 'shake', target: 'combo', delayMs: 0 },
      { type: 'float', target: 'combo', text: '20 COMBO!', tone: 'crit', delayMs: 0 },
    ])
  })

  it('打完一個字：勇者衝出去，0.12 秒後怪物被打到、跳傷害數字與 7 顆粒子', () => {
    const fx = effectsForEvents([{ type: 'wordComplete', word: 'cat', damage: 9, crit: false }])
    expect(fx).toEqual([
      { type: 'sprite', target: 'hero', anim: 'attack', delayMs: 0, durationMs: 350 },
      { type: 'sprite', target: 'monster', anim: 'hit', delayMs: 120, durationMs: 400 },
      { type: 'float', target: 'monster', text: '-9', tone: 'normal', delayMs: 120 },
      { type: 'burst', target: 'monster', emojis: ['✨', '💖', '⭐'], count: 7, delayMs: 120 },
    ])
  })

  it('爆擊：顯示 CRIT! 和 12 顆粒子', () => {
    const fx = effectsForEvents([{ type: 'wordComplete', word: 'pineapple', damage: 54, crit: true }])
    expect(fx).toContainEqual({ type: 'float', target: 'monster', text: 'CRIT! 54', tone: 'crit', delayMs: 120 })
    expect(fx.find((c) => c.type === 'burst')).toMatchObject({ count: 12 })
  })

  it('最後一擊：怪物直接倒地（不播被打到），多 16 顆慶祝粒子', () => {
    const fx = effectsForEvents([
      { type: 'wordComplete', word: 'cat', damage: 9, crit: false },
      { type: 'monsterDefeated', stage: 0, bonus: 800 },
    ])
    const monsterAnims = fx.filter((c) => c.type === 'sprite' && c.target === 'monster').map((c) => c.type === 'sprite' && c.anim)
    expect(monsterAnims).toEqual(['ko'])
    expect(fx.filter((c) => c.type === 'burst').map((c) => c.type === 'burst' && c.count)).toEqual([7, 16])
    expect(fx).toContainEqual({ type: 'float', target: 'monster', text: '-9', tone: 'normal', delayMs: 120 })
  })

  it('怪物攻擊：怪物衝過來，0.15 秒後勇者被打到、畫面震動', () => {
    expect(effectsForEvents([{ type: 'monsterAttack', damage: 8, comboLost: 3 }])).toEqual([
      { type: 'sprite', target: 'monster', anim: 'attack', delayMs: 0, durationMs: 400 },
      { type: 'sprite', target: 'hero', anim: 'hit', delayMs: 150, durationMs: 400 },
      { type: 'float', target: 'hero', text: '-8', tone: 'ouch', delayMs: 150 },
      { type: 'burst', target: 'hero', emojis: ['💢', '💫'], count: 5, delayMs: 150 },
      { type: 'shake', target: 'arena', delayMs: 150 },
    ])
  })

  it('怪物攻擊打斷 10 以上的 Combo 會提示', () => {
    expect(effectsForEvents([{ type: 'monsterAttack', damage: 8, comboLost: 25 }])).toContainEqual({
      type: 'float',
      target: 'combo',
      text: 'Combo 被打斷！',
      tone: 'ouch',
      delayMs: 150,
    })
  })

  it('勇者被打倒：被打到的動畫之後才倒地', () => {
    const fx = effectsForEvents([{ type: 'monsterAttack', damage: 8, comboLost: 0 }, { type: 'playerDefeated' }])
    expect(fx).toContainEqual({ type: 'sprite', target: 'hero', anim: 'ko', delayMs: 450, durationMs: 0 })
  })

  it('通關本身沒有額外特效', () => {
    expect(effectsForEvents([{ type: 'victory' }])).toEqual([])
  })
})

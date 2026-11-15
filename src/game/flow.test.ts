import { describe, expect, it } from 'vitest'
import { createBattle, type BattleState } from './battle.ts'
import { COUNTDOWN_STEPS, introMessage, stageClearMessage } from './flow.ts'
import { MONSTERS } from './monsters.ts'

const state = (over: Partial<BattleState>): BattleState => ({ ...createBattle('normal'), ...over })

describe('倒數', () => {
  it('3、2、1 各 0.65 秒，GO! 0.5 秒', () => {
    expect(COUNTDOWN_STEPS.map((s) => s.text)).toEqual(['3', '2', '1', 'GO!'])
    expect(COUNTDOWN_STEPS.reduce((sum, s) => sum + s.ms, 0)).toBe(2450)
  })
})

describe('introMessage', () => {
  it('顯示怪物名字、台詞與輸入法提醒', () => {
    const m = introMessage(MONSTERS[0])
    expect(m.emoji).toBe('🐛')
    expect(m.title).toBe('小 Bug 蟲 出現了！')
    expect(m.text).toContain('「嘰嘰！我會讓你的程式跑不動！」')
    expect(m.text).toContain('英文')
  })
})

describe('stageClearMessage', () => {
  it('顯示獎勵、回血與下一個對手', () => {
    const m = stageClearMessage(state({ stage: 0, phase: 'stageClear', playerHp: 70 }), '喵喵')
    expect(m.title).toBe('第 1 關 CLEAR！')
    expect(m.text).toBe('過關獎勵 +650 分，喵喵恢復 20 HP。\n下一個對手：👻 Typo 幽靈\n「嘿嘿～你一定會打錯字的～」')
  })

  it('血量接近全滿時只補到滿', () => {
    expect(stageClearMessage(state({ stage: 1, phase: 'stageClear', playerHp: 92 }), '柴柴').text).toContain('柴柴恢復 8 HP')
  })

  it('滿血時不提回血', () => {
    const m = stageClearMessage(state({ stage: 0, phase: 'stageClear', playerHp: 100 }), '喵喵')
    expect(m.text.split('\n')[0]).toBe('過關獎勵 +800 分。')
  })
})

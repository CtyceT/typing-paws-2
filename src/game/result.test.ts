import { describe, expect, it } from 'vitest'
import { createBattle, type BattleState } from './battle.ts'
import { battleResult, resultComment, resultStats, resultSubtitle, resultTitle } from './result.ts'

const ended = (over: Partial<BattleState>): BattleState => ({ ...createBattle('normal'), ...over })

describe('battleResult', () => {
  it('通關：算出各項數據與星等', () => {
    const r = battleResult(ended({ phase: 'won', stage: 2, correct: 200, typed: 208, activeMs: 60000, maxCombo: 33, score: 4321, damage: 300, playerHp: 60 }))
    expect(r).toEqual({ difficulty: 'normal', win: true, wpm: 40, accuracy: 96.2, maxCombo: 33, score: 4321, damage: 300, durationMs: 60000, stage: 3, stars: 3 })
  })

  it('星等：血量不到 50 最多 2 星，準確率不到 85 只有 1 星', () => {
    expect(battleResult(ended({ phase: 'won', stage: 2, correct: 96, typed: 100, playerHp: 49 })).stars).toBe(2)
    expect(battleResult(ended({ phase: 'won', stage: 2, correct: 80, typed: 100, playerHp: 100 })).stars).toBe(1)
  })

  it('被打倒：0 星，記錄止步的關卡', () => {
    const r = battleResult(ended({ phase: 'lost', stage: 1, playerHp: 0, correct: 50, typed: 50 }))
    expect(r).toMatchObject({ win: false, stars: 0, stage: 2 })
  })
})

describe('結算文字', () => {
  const win = battleResult(ended({ phase: 'won', stage: 2, correct: 200, typed: 208, activeMs: 60000, maxCombo: 33, score: 4321, damage: 300 }))
  const lost = battleResult(ended({ phase: 'lost', stage: 1, playerHp: 0 }))

  it('標題與副標', () => {
    expect(resultTitle(win, '喵喵')).toBe('🏆 通關成功！')
    expect(resultSubtitle(win)).toBe('普通模式 ・ 打倒了 Deadline 龍王！')
    expect(resultTitle(lost, '熊熊')).toBe('熊熊被打倒了…')
    expect(resultSubtitle(lost)).toBe('普通模式 ・ 止步於第 2 關（Typo 幽靈）')
  })

  it('六項數據', () => {
    expect(resultStats(win)).toEqual([
      { label: 'WPM', value: '40' },
      { label: '準確率', value: '96.2%' },
      { label: '最高 Combo', value: '33' },
      { label: '分數', value: '4321' },
      { label: '總傷害', value: '300' },
      { label: '用時', value: '60.0s' },
    ])
  })
})

describe('resultComment', () => {
  const c = (win: boolean, accuracy: number, wpm: number, maxCombo: number) => resultComment({ win, accuracy, wpm, maxCombo })

  it('失敗：準確率低提醒先求穩，否則鼓勵', () => {
    expect(c(false, 84.9, 90, 50)).toContain('先求穩再求快')
    expect(c(false, 85, 90, 50)).toContain('差一點點')
  })

  it('通關：依序看手速、Combo、準確率', () => {
    expect(c(true, 99, 70, 50)).toContain('手速驚人')
    expect(c(true, 99, 69, 40)).toContain('Combo 大師')
    expect(c(true, 97, 69, 39)).toContain('幾乎零失誤')
    expect(c(true, 96.9, 69, 39)).toContain('順利通關')
  })
})

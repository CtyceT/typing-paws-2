import { describe, expect, it } from 'vitest'
import { createBattle, type BattleState } from './battle.ts'
import { battleHud, wordChars } from './hud.ts'
import { createSeededRng } from './rng.ts'

const base = (over: Partial<BattleState> = {}): BattleState => ({
  ...createBattle('easy', { words: ['cat', 'dog', 'sun', 'moon', 'star'], rng: createSeededRng(1) }),
  ...over,
})

describe('wordChars', () => {
  it('依打到的位置標出已打、目前、未打', () => {
    expect(wordChars('cat', 1, false).map((c) => c.status)).toEqual(['done', 'cur', 'todo'])
  })

  it('打錯只標在目前的字元', () => {
    expect(wordChars('cat', 1, true).map((c) => c.error)).toEqual([false, true, false])
  })

  it('標出空白字元', () => {
    expect(wordChars('a b', 0, false).map((c) => c.space)).toEqual([false, true, false])
  })
})

describe('battleHud', () => {
  it('開場狀態', () => {
    const hud = battleHud(base())
    expect(hud.stageLabel).toBe('第 1 / 3 關 ・ 簡單')
    expect(hud.timeText).toBe('0.0s')
    expect(hud.wpm).toBe(0)
    expect(hud.accuracyText).toBe('100%')
    expect(hud.score).toBe(0)
    expect(hud.playerHpText).toBe('100/100')
    expect(hud.playerHpRatio).toBe(1)
    expect(hud.monsterHpText).toBe('60/60')
    expect(hud.monsterHpRatio).toBe(1)
    expect(hud.chargeText).toBe('0%')
    expect(hud.chargeDanger).toBe(false)
    expect(hud.combo).toBe(0)
    expect(hud.multiplierText).toBe('×1.0')
    expect(hud.multiplierTone).toBe('normal')
    expect(hud.preview).toHaveLength(2)
    expect(hud.chars.map((c) => c.char).join('')).toBe(base().queue.current)
  })

  it('時間、WPM、準確率照舊版公式', () => {
    const hud = battleHud(base({ activeMs: 30000, correct: 100, typed: 110 }))
    expect(hud.timeText).toBe('30.0s')
    expect(hud.wpm).toBe(40)
    expect(hud.accuracyText).toBe('90.9%')
  })

  it('血量文字：勇者無條件進位、不會低於 0', () => {
    expect(battleHud(base({ playerHp: 71.2 })).playerHpText).toBe('72/100')
    expect(battleHud(base({ playerHp: 0, monsterHp: 0 })).playerHpText).toBe('0/100')
    expect(battleHud(base({ monsterHp: 15 })).monsterHpRatio).toBe(0.25)
  })

  it('蓄力超過 75% 才算危險，數字無條件捨去', () => {
    expect(battleHud(base({ charge: 0.75 })).chargeDanger).toBe(false)
    const hud = battleHud(base({ charge: 0.759 }))
    expect(hud.chargeDanger).toBe(true)
    expect(hud.chargeText).toBe('75%')
    expect(battleHud(base({ charge: 1.3 })).chargeRatio).toBe(1)
  })

  it('倍率標籤的顏色跟著 Combo 變', () => {
    expect(battleHud(base({ combo: 9 })).multiplierTone).toBe('normal')
    expect(battleHud(base({ combo: 10 }))).toMatchObject({ multiplierText: '×1.5', multiplierTone: 'hot' })
    expect(battleHud(base({ combo: 20 }))).toMatchObject({ multiplierText: '×2.0', multiplierTone: 'fire' })
    expect(battleHud(base({ combo: 99 })).multiplierText).toBe('×3.0')
  })

  it('關卡標籤包含關數與難度', () => {
    expect(battleHud({ ...createBattle('hard'), stage: 2 }).stageLabel).toBe('第 3 / 3 關 ・ 困難')
  })
})

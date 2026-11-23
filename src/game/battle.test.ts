import { describe, expect, it } from 'vitest'
import {
  battleReducer,
  createBattle,
  MAX_TICK_MS,
  monsterAttackDamage,
  monsterMaxHp,
  stageBonus,
  stageHealAmount,
  type BattleAction,
  type BattleEvent,
  type BattleState,
} from './battle.ts'
import { comboMultiplier } from './combo.ts'
import type { Difficulty } from './difficulty.ts'
import { createSeededRng } from './rng.ts'
import { themeLineup } from './monsters.ts'
import { calcAccuracy, calcStars } from './stats.ts'
import { WORDS } from './words.ts'

const DAILY = themeLineup('daily')

const run = (state: BattleState, ...actions: BattleAction[]) => actions.reduce(battleReducer, state)
const char = (c: string, roll = 0.5): BattleAction => ({ type: 'char', char: c, roll })
const tick = (dtMs = MAX_TICK_MS): BattleAction => ({ type: 'tick', dtMs })

/** 把目前的字剩下的部分全部打對 */
function typeWord(state: BattleState, roll = 0.5): BattleState {
  const word = state.queue.current
  let s = state
  for (const c of word.slice(state.index)) s = battleReducer(s, char(c, roll))
  return s
}

/** 建立一場已經開始的戰鬥 */
function started(difficulty: Difficulty = 'easy', words?: readonly string[]): BattleState {
  return run(createBattle(difficulty, { words, rng: createSeededRng(1) }), { type: 'start' })
}

/** 連續 tick 直到怪物攻擊一次 */
function tickUntilAttack(state: BattleState): BattleState {
  let s = state
  for (let i = 0; i < 1000; i++) {
    s = battleReducer(s, tick())
    if (s.events.some((e) => e.type === 'monsterAttack')) return s
  }
  throw new Error('怪物一直沒有攻擊')
}

describe('數值公式', () => {
  it('怪物血量 = 基礎血量 × 難度倍率', () => {
    expect(DAILY.map((m) => monsterMaxHp(m, 'easy'))).toEqual([60, 90, 140])
    expect(DAILY.map((m) => monsterMaxHp(m, 'normal'))).toEqual([96, 144, 224])
    expect(DAILY.map((m) => monsterMaxHp(m, 'hard'))).toEqual([156, 234, 364])
  })

  it('怪物傷害 = 難度傷害 × 怪物倍率', () => {
    expect(DAILY.map((m) => monsterAttackDamage(m, 'easy'))).toEqual([8, 9, 10])
    expect(DAILY.map((m) => monsterAttackDamage(m, 'normal'))).toEqual([12, 13, 16])
    expect(DAILY.map((m) => monsterAttackDamage(m, 'hard'))).toEqual([15, 17, 20])
  })

  it('過關獎勵 = 300 × 關卡 + 剩餘血量 × 5', () => {
    expect(stageBonus(0, 100)).toBe(800)
    expect(stageBonus(1, 64)).toBe(920)
    expect(stageBonus(2, 1)).toBe(905)
  })

  it('過關補血最多 20，不超過血量上限', () => {
    expect(stageHealAmount(50)).toBe(20)
    expect(stageHealAmount(92)).toBe(8)
    expect(stageHealAmount(100)).toBe(0)
  })
})

describe('createBattle', () => {
  it('初始狀態', () => {
    const s = createBattle('normal', { rng: createSeededRng(1) })
    expect(s).toMatchObject({
      difficulty: 'normal', stage: 0, phase: 'ready', paused: false,
      playerHp: 100, monsterHp: 96, monsterMaxHp: 96, charge: 0, index: 0,
      combo: 0, score: 0, typed: 0, activeMs: 0,
    })
    expect(WORDS.normal).toContain(s.queue.current)
  })

  it('可以用自訂字庫；空的自訂字庫退回內建字庫', () => {
    expect(createBattle('easy', { words: ['zzz', 'yyy'] }).queue.current).toMatch(/zzz|yyy/)
    expect(WORDS.easy).toContain(createBattle('easy', { words: [] }).queue.current)
  })

  it('同一個種子開出同樣的題目', () => {
    const a = createBattle('hard', { rng: createSeededRng(5) })
    const b = createBattle('hard', { rng: createSeededRng(5) })
    expect(a.queue).toEqual(b.queue)
  })
})

describe('打字', () => {
  it('還沒開始（ready）時打字與計時都沒有作用', () => {
    const s = createBattle('easy', { rng: createSeededRng(1) })
    expect(run(s, char(s.queue.current[0]))).toBe(s)
    expect(run(s, tick())).toBe(s)
  })

  it('打對：前進一個字元、Combo +1', () => {
    const s0 = started('easy', ['abc', 'def', 'ghi'])
    const s1 = run(s0, char(s0.queue.current[0]))
    expect(s1).toMatchObject({ index: 1, combo: 1, maxCombo: 1, correct: 1, typed: 1, wrong: 0, errorFlash: false })
    expect(s1.events).toEqual([])
  })

  it('打錯：不前進、Combo 歸零、怪物蓄力 +8%', () => {
    const s0 = started('easy', ['abc', 'def', 'ghi'])
    const s1 = run(s0, char(s0.queue.current[0]), char('!'))
    expect(s1).toMatchObject({ index: 1, combo: 0, maxCombo: 1, correct: 1, typed: 2, wrong: 1, errorFlash: true })
    expect(s1.charge).toBeCloseTo(0.08)
    expect(s1.events).toEqual([{ type: 'miss', comboLost: 1 }])
  })

  it('打錯後再打對會清除紅色標記', () => {
    const s0 = started('easy', ['abc', 'def', 'ghi'])
    const s1 = run(s0, char('!'), char(s0.queue.current[0]))
    expect(s1.errorFlash).toBe(false)
  })

  it('大小寫要完全相同', () => {
    const s0 = started('easy', ['abc', 'def', 'ghi'])
    expect(run(s0, char(s0.queue.current[0].toUpperCase())).wrong).toBe(1)
  })

  it('連續打錯，蓄力最多到 100%', () => {
    let s = started('easy')
    for (let i = 0; i < 20; i++) s = battleReducer(s, char('!'))
    expect(s.charge).toBe(1)
  })

  it('不會修改傳入的 state', () => {
    const s0 = started('easy')
    const snapshot = structuredClone(s0)
    typeWord(s0)
    battleReducer(s0, tick())
    expect(s0).toEqual(snapshot)
  })
})

describe('完成單字', () => {
  it('造成 字長 × 3 的傷害，得 傷害 × 10 分，換下一個字', () => {
    const s0 = started('easy', ['abcd', 'efgh', 'ijkl', 'mnop', 'qrst'])
    const first = s0.queue.current
    const s1 = typeWord(s0)
    expect(s1.monsterHp).toBe(60 - 12)
    expect(s1).toMatchObject({ damage: 12, score: 120, wordsCompleted: 1, index: 0, combo: 4, phase: 'running' })
    expect(s1.queue.current).toBe(s0.queue.upcoming[0])
    expect(s1.queue.current).not.toBe(first)
    expect(s1.events).toEqual([{ type: 'wordComplete', word: first, damage: 12, crit: false }])
  })

  it('打完一個字讓怪物蓄力倒退 15%，最低到 0', () => {
    const s0 = started('easy', ['abcd', 'efgh', 'ijkl', 'mnop', 'qrst'])
    const charged = { ...s0, charge: 0.5 }
    expect(typeWord(charged).charge).toBeCloseTo(0.35)
    expect(typeWord({ ...s0, charge: 0.1 }).charge).toBe(0)
  })

  it('Combo 到 10 的倍數時發出里程碑事件，傷害套用新倍率', () => {
    const s0 = { ...started('hard', ['abcdefghij', 'klmnopqrst', 'uvwxyzabcd']), monsterHp: 999 }
    const s1 = typeWord(s0)
    expect(s1.combo).toBe(10)
    expect(s1.events).toEqual([
      { type: 'comboMilestone', combo: 10 },
      { type: 'wordComplete', word: s0.queue.current, damage: 45, crit: false }, // 10 × 3 × 1.5
    ])
    const s2 = typeWord(s1)
    expect(s2.events.at(-1)).toMatchObject({ damage: 60, crit: true }) // 10 × 3 × 2
  })
})

describe('怪物蓄力與攻擊', () => {
  it('時間前進會累積時間與蓄力', () => {
    const s = run(started('easy'), tick(100), tick(100))
    expect(s.activeMs).toBe(200)
    expect(s.charge).toBeCloseTo(200 / 7000)
  })

  it('單次 tick 最多算 100 毫秒，負數不算', () => {
    const s0 = started('easy')
    expect(run(s0, tick(5000)).activeMs).toBe(MAX_TICK_MS)
    expect(run(s0, tick(-50))).toBe(s0)
  })

  it('蓄力滿了就攻擊：扣血、蓄力歸零、Combo 歸零', () => {
    const s0 = { ...started('easy'), charge: 0.999, combo: 12, maxCombo: 12 }
    const s1 = run(s0, tick())
    expect(s1).toMatchObject({ playerHp: 92, charge: 0, combo: 0, maxCombo: 12, phase: 'running' })
    expect(s1.events).toEqual([{ type: 'monsterAttack', damage: 8, comboLost: 12 }])
  })

  it('簡單難度大約每 7 秒攻擊一次', () => {
    const s = tickUntilAttack(started('easy'))
    expect(s.activeMs).toBeGreaterThanOrEqual(7000)
    expect(s.activeMs).toBeLessThanOrEqual(7100)
  })

  it('血量歸零就落敗，之後的動作都沒有作用', () => {
    const s0 = { ...started('hard'), playerHp: 10, charge: 0.999 }
    const s1 = run(s0, tick())
    expect(s1).toMatchObject({ playerHp: 0, phase: 'lost' })
    expect(s1.events.map((e) => e.type)).toEqual(['monsterAttack', 'playerDefeated'])
    expect(run(s1, char('a'), tick(), { type: 'start' }, { type: 'nextStage', roll: 0 })).toBe(s1)
  })

  it('完全不打字：簡單難度被打 13 次後落敗', () => {
    let s = started('easy')
    let attacks = 0
    while (s.phase === 'running') {
      s = tickUntilAttack(s)
      attacks++
    }
    expect(attacks).toBe(13) // 100 ÷ 8
    expect(s).toMatchObject({ phase: 'lost', playerHp: 0, stage: 0, score: 0 })
  })
})

describe('暫停', () => {
  it('暫停時不計時、不蓄力、不能打字', () => {
    const s0 = run(started('easy'), tick())
    const paused = run(s0, { type: 'pause' })
    expect(paused.paused).toBe(true)
    let s = paused
    for (let i = 0; i < 100; i++) s = battleReducer(s, tick()) // 10 秒
    s = battleReducer(s, char(s.queue.current[0]))
    expect(s).toBe(paused)
  })

  it('繼續後恢復計時', () => {
    const s = run(started('easy'), tick(), { type: 'pause' }, tick(), { type: 'resume' }, tick())
    expect(s.paused).toBe(false)
    expect(s.activeMs).toBe(200)
  })

  it('不在戰鬥中時不能暫停', () => {
    const ready = createBattle('easy', { rng: createSeededRng(1) })
    expect(run(ready, { type: 'pause' })).toBe(ready)
    expect(run(started('easy'), { type: 'resume' }).paused).toBe(false)
  })
})

describe('過關', () => {
  /** 一直打字直到這一關結束 */
  function clearStage(state: BattleState): BattleState {
    let s = state
    while (s.phase === 'running') s = typeWord(s)
    return s
  }

  it('打倒怪物：進入 stageClear，拿到過關獎勵', () => {
    const s0 = started('easy')
    const s1 = clearStage(s0)
    expect(s1).toMatchObject({ phase: 'stageClear', stage: 0, monsterHp: 0 })
    expect(s1.score).toBe(s1.damage * 10 + 800)
    expect(s1.events.at(-1)).toEqual({ type: 'monsterDefeated', stage: 0, bonus: 800 })
    expect(run(s1, char('a'), tick())).toBe(s1) // 過關訊息期間不計時
  })

  it('進入下一關：補血 20（不超過上限）、換怪物、蓄力歸零、保留 Combo', () => {
    const cleared = { ...clearStage(started('easy')), playerHp: 70, charge: 0.4 }
    const next = run(cleared, { type: 'nextStage', roll: 0.3 })
    expect(next).toMatchObject({
      stage: 1, phase: 'ready', playerHp: 90, monsterHp: 90, monsterMaxHp: 90, charge: 0, index: 0,
      combo: cleared.combo,
    })
    expect(next.queue.current).toBe(cleared.queue.upcoming[0])
    expect(run({ ...cleared, playerHp: 95 }, { type: 'nextStage', roll: 0.3 }).playerHp).toBe(100)
  })

  it('還沒過關不能跳關', () => {
    const s = started('easy')
    expect(run(s, { type: 'nextStage', roll: 0 })).toBe(s)
  })
})

describe('完整三關', () => {
  /**
   * 照規則另外算一次分數來對照：每個字 = round(字長 × 3 × 倍率)，
   * 每關獎勵 = 300 × 關卡 + 血量 × 5。missEvery > 0 時每隔幾個字故意打錯一次。
   */
  function playThrough(difficulty: Difficulty, seed: number, missEvery = 0) {
    const rng = createSeededRng(seed)
    let s = createBattle(difficulty, { rng })
    const events: BattleEvent[] = []
    const dispatch = (a: BattleAction) => {
      s = battleReducer(s, a)
      events.push(...s.events)
    }
    let expectedScore = 0
    let expectedDamage = 0
    let combo = 0
    let wordCount = 0

    dispatch({ type: 'start' })
    for (let guard = 0; guard < 10000 && s.phase !== 'won' && s.phase !== 'lost'; guard++) {
      if (s.phase === 'stageClear') {
        dispatch({ type: 'nextStage', roll: rng() })
        dispatch({ type: 'start' })
        continue
      }
      const word = s.queue.current
      const stage = s.stage
      if (missEvery > 0 && wordCount % missEvery === 0) {
        dispatch(char('\x7F', rng())) // 一定不在字庫裡的字元
        combo = 0
      }
      for (const c of word) dispatch(char(c, rng()))
      combo += word.length
      wordCount++
      const dmg = Math.round(word.length * 3 * comboMultiplier(combo))
      expectedDamage += dmg
      expectedScore += dmg * 10
      if (s.stage !== stage || s.phase !== 'running') expectedScore += 300 * (stage + 1) + s.playerHp * 5
    }
    return { state: s, events, expectedScore, expectedDamage, wordCount }
  }

  it.each(['easy', 'normal', 'hard'] as const)('%s：全部打對可以通關，分數與規則一致', (difficulty) => {
    const { state, events, expectedScore, expectedDamage, wordCount } = playThrough(difficulty, 2024)
    expect(state).toMatchObject({ phase: 'won', stage: 2, playerHp: 100, monsterHp: 0, wrong: 0 })
    expect(state.damage).toBe(expectedDamage)
    expect(state.score).toBe(expectedScore)
    expect(state.score).toBe(state.damage * 10 + 800 + 1100 + 1400)
    expect(state.wordsCompleted).toBe(wordCount)
    expect(state.correct).toBe(state.typed)
    expect(state.maxCombo).toBe(state.correct)
    expect(events.filter((e) => e.type === 'monsterDefeated')).toHaveLength(3)
    expect(events.at(-1)).toEqual({ type: 'victory' })
    expect(calcStars(true, calcAccuracy(state.correct, state.typed), state.playerHp)).toBe(3)
  })

  it('中途打錯會中斷 Combo，分數仍與規則一致', () => {
    const { state, expectedScore, expectedDamage, wordCount } = playThrough('normal', 7, 3)
    expect(state.phase).toBe('won')
    expect(state.wrong).toBe(Math.ceil(wordCount / 3))
    expect(state.typed).toBe(state.correct + state.wrong)
    expect(state.damage).toBe(expectedDamage)
    expect(state.score).toBe(expectedScore)
    expect(state.maxCombo).toBeLessThan(state.correct)
  })

  it('同一個種子的整場戰鬥可以完全重現', () => {
    expect(playThrough('hard', 99).state).toEqual(playThrough('hard', 99).state)
  })

  it('一邊打字一邊被攻擊：過關獎勵用當下的血量計算', () => {
    let s = started('easy')
    s = tickUntilAttack(s) // 被打一次，剩 92
    while (s.phase === 'running') s = typeWord(s)
    expect(s.playerHp).toBe(92)
    expect(s.score).toBe(s.damage * 10 + 300 + 92 * 5)
  })
})

describe('按鍵紀錄', () => {
  it('記錄預期字元、實際字元、對錯、同一個字裡的前一個字元', () => {
    const s0 = started('easy', ['cat'])
    const s = run(s0, char('c'), char('x'), char('a'), char('t'))
    expect(s.keyLog.map(({ expected, actual, correct, prev }) => ({ expected, actual, correct, prev }))).toEqual([
      { expected: 'c', actual: 'c', correct: true, prev: null },
      { expected: 'a', actual: 'x', correct: false, prev: 'c' },
      { expected: 'a', actual: 'a', correct: true, prev: 'c' },
      { expected: 't', actual: 't', correct: true, prev: 'a' },
    ])
    // 換下一個字之後，第一個字元沒有前一個字元
    expect(run(s, char('c')).keyLog[4].prev).toBeNull()
  })

  it('間隔是和上一鍵之間實際戰鬥的時間；開始後的第一鍵沒有間隔', () => {
    const s = run(started('easy', ['cat']), tick(100), char('c'), tick(100), tick(50), char('a'), char('t'))
    expect(s.keyLog.map((k) => k.intervalMs)).toEqual([null, 150, 0])
  })

  it('暫停期間的時間不算進間隔，暫停後的第一鍵不算間隔', () => {
    let s = run(started('easy', ['cat']), char('c'), tick(100), { type: 'pause' })
    for (let i = 0; i < 100; i++) s = battleReducer(s, tick(100)) // 暫停 10 秒
    s = run(s, { type: 'resume' }, tick(80), char('a'), tick(60), char('t'))
    expect(s.activeMs).toBe(240)
    expect(s.keyLog.map((k) => k.intervalMs)).toEqual([null, null, 60])
  })

  it('不合時機的按鍵（暫停中、還沒開始）不會被記錄', () => {
    const ready = createBattle('easy', { words: ['cat'], rng: createSeededRng(1) })
    expect(run(ready, char('c')).keyLog).toEqual([])
    expect(run(started('easy', ['cat']), { type: 'pause' }, char('c')).keyLog).toEqual([])
  })

  it('進入下一關後的第一鍵沒有間隔，紀錄會延續整場', () => {
    let s = started('easy', ['cat'])
    while (s.phase === 'running') s = run(typeWord(s), tick(50))
    expect(s.phase).toBe('stageClear')
    const before = s.keyLog.length
    s = run(s, { type: 'nextStage', roll: 0.5 }, { type: 'start' }, tick(100), char('c'))
    expect(s.keyLog).toHaveLength(before + 1)
    expect(s.keyLog[before].intervalMs).toBeNull()
  })
})

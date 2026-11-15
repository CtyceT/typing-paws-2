import { comboMultiplier, COMBO_STEP, isCrit, wordDamage } from './combo.ts'
import { CHARGE_PUSHBACK, MISS_PENALTY, PLAYER_MAX_HP, STAGE_HEAL } from './constants.ts'
import { DIFFICULTIES, type Difficulty } from './difficulty.ts'
import { MONSTERS, type Monster } from './monsters.ts'
import { advanceQueue, createQueue, type WordQueue } from './queue.ts'
import type { Rng } from './rng.ts'
import { WORDS } from './words.ts'

/**
 * 戰鬥階段：
 * - ready：這一關準備好了，等開場訊息與倒數結束（不計時、不能打字）
 * - running：戰鬥中
 * - stageClear：打倒這一關的怪物，等玩家按繼續
 * - won / lost：整場結束
 */
export type BattlePhase = 'ready' | 'running' | 'stageClear' | 'won' | 'lost'

/** 上一個動作產生的事件，給畫面播動畫、跳數字用 */
export type BattleEvent =
  | { type: 'miss'; comboLost: number }
  | { type: 'comboMilestone'; combo: number }
  | { type: 'wordComplete'; word: string; damage: number; crit: boolean }
  | { type: 'monsterDefeated'; stage: number; bonus: number }
  | { type: 'monsterAttack'; damage: number; comboLost: number }
  | { type: 'victory' }
  | { type: 'playerDefeated' }

export interface BattleState {
  difficulty: Difficulty
  /** 這場用的字庫（內建字庫或 AI 出的題目） */
  words: readonly string[]
  /** 目前第幾關，從 0 開始 */
  stage: number
  phase: BattlePhase
  paused: boolean
  playerHp: number
  monsterHp: number
  monsterMaxHp: number
  /** 怪物蓄力，0～1，滿了就攻擊 */
  charge: number
  queue: WordQueue
  /** 目前的字打到第幾個字元 */
  index: number
  /** 目前這個字元剛打錯（畫面標紅），打對後清除 */
  errorFlash: boolean
  combo: number
  maxCombo: number
  /** 打對的字元數 */
  correct: number
  /** 總按鍵數 */
  typed: number
  /** 打錯的次數 */
  wrong: number
  /** 完成的單字數 */
  wordsCompleted: number
  score: number
  /** 累計造成的傷害 */
  damage: number
  /** 實際戰鬥的毫秒數（暫停、倒數、過關訊息都不算） */
  activeMs: number
  events: readonly BattleEvent[]
}

export type BattleAction =
  /** 倒數結束，開始或繼續戰鬥 */
  | { type: 'start' }
  /** 玩家打了一個字元。roll 是 [0, 1) 的亂數，換字時用來選新題目 */
  | { type: 'char'; char: string; roll: number }
  /** 時間前進 dtMs 毫秒 */
  | { type: 'tick'; dtMs: number }
  /** 過關後進入下一關。roll 用來選新題目 */
  | { type: 'nextStage'; roll: number }
  | { type: 'pause' }
  | { type: 'resume' }

/** 單次 tick 最多前進的毫秒數，避免分頁被凍結後一口氣補一大段時間 */
export const MAX_TICK_MS = 100
/** 過關獎勵：每關的基礎分 × 關卡數 */
export const STAGE_BONUS = 300
/** 過關獎勵：每點剩餘血量的分數 */
export const HP_BONUS = 5
/** 每點傷害的分數 */
export const SCORE_PER_DAMAGE = 10

export function currentMonster(state: Pick<BattleState, 'stage'>): Monster {
  return MONSTERS[state.stage]
}

export function monsterMaxHp(stage: number, difficulty: Difficulty): number {
  return Math.round(MONSTERS[stage].hp * DIFFICULTIES[difficulty].hpScale)
}

/** 怪物這一關每次攻擊的傷害 */
export function monsterAttackDamage(stage: number, difficulty: Difficulty): number {
  return Math.round(DIFFICULTIES[difficulty].monsterDamage * MONSTERS[stage].damageScale)
}

/** 過關獎勵分數 */
export function stageBonus(stage: number, playerHp: number): number {
  return STAGE_BONUS * (stage + 1) + Math.round(playerHp) * HP_BONUS
}

/** 進入下一關時實際會恢復多少血 */
export function stageHealAmount(playerHp: number): number {
  return Math.min(STAGE_HEAL, PLAYER_MAX_HP - playerHp)
}

export interface CreateBattleOptions {
  /** 自訂字庫；不給就用該難度的內建字庫 */
  words?: readonly string[]
  rng?: Rng
}

export function createBattle(difficulty: Difficulty, options: CreateBattleOptions = {}): BattleState {
  const words = options.words && options.words.length > 0 ? options.words : WORDS[difficulty]
  const maxHp = monsterMaxHp(0, difficulty)
  return {
    difficulty,
    words,
    stage: 0,
    phase: 'ready',
    paused: false,
    playerHp: PLAYER_MAX_HP,
    monsterHp: maxHp,
    monsterMaxHp: maxHp,
    charge: 0,
    queue: createQueue(words, options.rng ?? Math.random),
    index: 0,
    errorFlash: false,
    combo: 0,
    maxCombo: 0,
    correct: 0,
    typed: 0,
    wrong: 0,
    wordsCompleted: 0,
    score: 0,
    damage: 0,
    activeMs: 0,
    events: [],
  }
}

const isActive = (s: BattleState) => s.phase === 'running' && !s.paused

function onChar(s: BattleState, char: string, roll: number): BattleState {
  const word = s.queue.current

  if (char !== word[s.index]) {
    return {
      ...s,
      typed: s.typed + 1,
      wrong: s.wrong + 1,
      combo: 0,
      charge: Math.min(1, s.charge + MISS_PENALTY),
      errorFlash: true,
      events: [{ type: 'miss', comboLost: s.combo }],
    }
  }

  const combo = s.combo + 1
  const events: BattleEvent[] = []
  if (combo % COMBO_STEP === 0) events.push({ type: 'comboMilestone', combo })
  const typedOk: BattleState = {
    ...s,
    typed: s.typed + 1,
    correct: s.correct + 1,
    index: s.index + 1,
    combo,
    maxCombo: Math.max(s.maxCombo, combo),
    errorFlash: false,
    events,
  }
  if (typedOk.index < word.length) return typedOk

  // 打完一個字：攻擊怪物
  const damage = wordDamage(word.length, combo)
  events.push({ type: 'wordComplete', word, damage, crit: isCrit(combo) })
  const hit: BattleState = {
    ...typedOk,
    monsterHp: Math.max(0, s.monsterHp - damage),
    damage: s.damage + damage,
    score: s.score + damage * SCORE_PER_DAMAGE,
    wordsCompleted: s.wordsCompleted + 1,
    charge: Math.max(0, s.charge - CHARGE_PUSHBACK),
  }

  if (hit.monsterHp > 0) {
    return { ...hit, queue: advanceQueue(s.queue, s.words, () => roll), index: 0 }
  }

  // 怪物被打倒
  const bonus = stageBonus(s.stage, s.playerHp)
  events.push({ type: 'monsterDefeated', stage: s.stage, bonus })
  const last = s.stage >= MONSTERS.length - 1
  if (last) events.push({ type: 'victory' })
  return { ...hit, score: hit.score + bonus, phase: last ? 'won' : 'stageClear' }
}

function onTick(s: BattleState, dtMs: number): BattleState {
  const dt = Math.max(0, Math.min(MAX_TICK_MS, dtMs))
  if (dt === 0) return s
  const charge = s.charge + dt / DIFFICULTIES[s.difficulty].chargeIntervalMs
  const ticked = { ...s, activeMs: s.activeMs + dt }
  if (charge < 1) return { ...ticked, charge, events: [] }

  // 蓄力滿了：怪物攻擊
  const damage = monsterAttackDamage(s.stage, s.difficulty)
  const playerHp = Math.max(0, s.playerHp - damage)
  const events: BattleEvent[] = [{ type: 'monsterAttack', damage, comboLost: s.combo }]
  if (playerHp <= 0) events.push({ type: 'playerDefeated' })
  return { ...ticked, charge: 0, playerHp, combo: 0, phase: playerHp <= 0 ? 'lost' : 'running', events }
}

function onNextStage(s: BattleState, roll: number): BattleState {
  const stage = s.stage + 1
  const maxHp = monsterMaxHp(stage, s.difficulty)
  return {
    ...s,
    stage,
    phase: 'ready',
    playerHp: Math.min(PLAYER_MAX_HP, s.playerHp + STAGE_HEAL),
    monsterHp: maxHp,
    monsterMaxHp: maxHp,
    charge: 0,
    queue: advanceQueue(s.queue, s.words, () => roll),
    index: 0,
    errorFlash: false,
    events: [],
  }
}

/**
 * 戰鬥狀態的 reducer。純函式：需要的亂數由 action 帶進來，
 * 不合時機的動作（例如暫停時打字）會原樣回傳 state。
 */
export function battleReducer(state: BattleState, action: BattleAction): BattleState {
  switch (action.type) {
    case 'start':
      return state.phase === 'ready' ? { ...state, phase: 'running', paused: false, events: [] } : state
    case 'char':
      return isActive(state) ? onChar(state, action.char, action.roll) : state
    case 'tick':
      return isActive(state) ? onTick(state, action.dtMs) : state
    case 'nextStage':
      return state.phase === 'stageClear' ? onNextStage(state, action.roll) : state
    case 'pause':
      return isActive(state) ? { ...state, paused: true, events: [] } : state
    case 'resume':
      return state.phase === 'running' && state.paused ? { ...state, paused: false, events: [] } : state
  }
}

/** 目前的傷害倍率（給畫面顯示 ×1.5 之類的標籤） */
export function currentMultiplier(state: Pick<BattleState, 'combo'>): number {
  return comboMultiplier(state.combo)
}

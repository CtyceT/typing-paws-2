import { calcAccuracy, calcWpm } from './stats.ts'
import { comboMultiplier, CRIT_MULTIPLIER } from './combo.ts'
import { PLAYER_MAX_HP } from './constants.ts'
import { DIFFICULTIES } from './difficulty.ts'
import { MONSTERS } from './monsters.ts'
import { previewWords } from './queue.ts'
import type { BattleState } from './battle.ts'

/** 蓄力超過這個百分比，蓄力條變紅 */
export const CHARGE_DANGER_PCT = 75

/** done：已打完；cur：目前要打的；todo：還沒打到 */
export type CharStatus = 'done' | 'cur' | 'todo'

export interface CharView {
  char: string
  status: CharStatus
  /** 這個字元剛打錯（只會出現在 cur） */
  error: boolean
  /** 是空白字元（畫面上用「·」提示） */
  space: boolean
}

/** 倍率標籤的顏色：normal ×1.0；hot 大於 ×1.0；fire 達到爆擊倍率 */
export type MultiplierTone = 'normal' | 'hot' | 'fire'

/** 戰鬥畫面要顯示的所有文字與比例，全部由 BattleState 算出來 */
export interface BattleHud {
  stageLabel: string
  timeText: string
  wpm: number
  accuracyText: string
  score: number
  playerHpText: string
  playerHpRatio: number
  monsterHpText: string
  monsterHpRatio: number
  chargeRatio: number
  chargeText: string
  chargeDanger: boolean
  combo: number
  multiplierText: string
  multiplierTone: MultiplierTone
  /** 目前這個字的每個字元 */
  chars: readonly CharView[]
  /** 預覽的後兩個字 */
  preview: readonly string[]
}

/** 目前這個字每個字元的狀態 */
export function wordChars(word: string, index: number, errorFlash: boolean): CharView[] {
  return [...word].map((char, i) => ({
    char,
    status: i < index ? 'done' : i === index ? 'cur' : 'todo',
    error: i === index && errorFlash,
    space: char === ' ',
  }))
}

export function battleHud(state: BattleState): BattleHud {
  const chargeRatio = Math.max(0, Math.min(1, state.charge))
  const chargePct = chargeRatio * 100
  const multiplier = comboMultiplier(state.combo)
  return {
    stageLabel: `第 ${state.stage + 1} / ${MONSTERS.length} 關 ・ ${DIFFICULTIES[state.difficulty].label}`,
    timeText: `${(state.activeMs / 1000).toFixed(1)}s`,
    wpm: calcWpm(state.correct, state.activeMs),
    accuracyText: `${calcAccuracy(state.correct, state.typed)}%`,
    score: state.score,
    playerHpText: `${Math.max(0, Math.ceil(state.playerHp))}/${PLAYER_MAX_HP}`,
    playerHpRatio: state.playerHp / PLAYER_MAX_HP,
    monsterHpText: `${Math.max(0, state.monsterHp)}/${state.monsterMaxHp}`,
    monsterHpRatio: state.monsterHp / state.monsterMaxHp,
    chargeRatio,
    chargeText: `${Math.floor(chargePct)}%`,
    chargeDanger: chargePct > CHARGE_DANGER_PCT,
    combo: state.combo,
    multiplierText: `×${multiplier.toFixed(1)}`,
    multiplierTone: multiplier >= CRIT_MULTIPLIER ? 'fire' : multiplier > 1 ? 'hot' : 'normal',
    chars: wordChars(state.queue.current, state.index, state.errorFlash),
    preview: previewWords(state.queue),
  }
}

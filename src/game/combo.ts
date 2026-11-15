import { DAMAGE_PER_CHAR } from './constants.ts'

/** 每累積幾下 Combo 提升一次倍率 */
export const COMBO_STEP = 10
/** 每次提升的倍率 */
export const COMBO_BONUS = 0.5
/** 倍率上限 */
export const MAX_MULTIPLIER = 3
/** 倍率達到這個值算爆擊（畫面顯示 CRIT!） */
export const CRIT_MULTIPLIER = 2

/** Combo 傷害倍率：每 10 Combo +0.5，上限 ×3 */
export function comboMultiplier(combo: number): number {
  return Math.min(MAX_MULTIPLIER, 1 + Math.floor(Math.max(0, combo) / COMBO_STEP) * COMBO_BONUS)
}

/** 打完一個字造成的傷害：字長 × 3 × 倍率，四捨五入 */
export function wordDamage(wordLength: number, combo: number): number {
  return Math.round(wordLength * DAMAGE_PER_CHAR * comboMultiplier(combo))
}

export function isCrit(combo: number): boolean {
  return comboMultiplier(combo) >= CRIT_MULTIPLIER
}

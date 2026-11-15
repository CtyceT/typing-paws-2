/** 難度代號，也是字庫與最佳紀錄的索引鍵 */
export type Difficulty = 'easy' | 'normal' | 'hard'

export interface DifficultyConfig {
  /** 顯示名稱（繁中） */
  label: string
  icon: string
  /** 選單上的一句話說明 */
  desc: string
  /** 怪物蓄力條從 0 到滿所需的毫秒數 */
  chargeIntervalMs: number
  /** 怪物每次攻擊的基礎傷害（還要乘上怪物的 damageScale） */
  monsterDamage: number
  /** 怪物血量倍率 */
  hpScale: number
}

export const DIFFICULTY_ORDER: readonly Difficulty[] = ['easy', 'normal', 'hard']

export const DIFFICULTIES: Readonly<Record<Difficulty, DifficultyConfig>> = {
  easy: {
    label: '簡單',
    icon: '🌱',
    desc: '3～5 字母短單字，怪物攻擊慢慢來',
    chargeIntervalMs: 7000,
    monsterDamage: 8,
    hpScale: 1.0,
  },
  normal: {
    label: '普通',
    icon: '🌟',
    desc: '5～8 字母單字，節奏剛剛好',
    chargeIntervalMs: 5200,
    monsterDamage: 12,
    hpScale: 1.6,
  },
  hard: {
    label: '困難',
    icon: '🔥',
    desc: '片語＋大小寫＋標點，怪物出手很快',
    chargeIntervalMs: 4400,
    monsterDamage: 15,
    hpScale: 2.6,
  },
}

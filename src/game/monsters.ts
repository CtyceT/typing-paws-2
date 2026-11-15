export interface Monster {
  emoji: string
  name: string
  /** 基礎血量（還要乘上難度的 hpScale） */
  hp: number
  /** 傷害倍率（乘上難度的 monsterDamage） */
  damageScale: number
  /** 出場台詞 */
  line: string
  /** 是否為魔王（畫面上會放大顯示） */
  boss: boolean
}

/** 三關的怪物，依出場順序排列 */
export const MONSTERS: readonly Monster[] = [
  { emoji: '🐛', name: '小 Bug 蟲', hp: 60, damageScale: 1.0, line: '嘰嘰！我會讓你的程式跑不動！', boss: false },
  { emoji: '👻', name: 'Typo 幽靈', hp: 90, damageScale: 1.1, line: '嘿嘿～你一定會打錯字的～', boss: false },
  { emoji: '🐲', name: 'Deadline 龍王', hp: 140, damageScale: 1.3, line: '吼！截止時間就要到了！', boss: true },
]

/** 遊戲模式代號 */
export type GameMode = 'classic' | 'story' | 'training' | 'daily'

export interface GameModeConfig {
  /** 顯示名稱（繁中） */
  label: string
  icon: string
  /** 選單上的一句話說明 */
  desc: string
  /** 是否已經可以玩；false 的模式在選單上顯示「即將推出」 */
  available: boolean
}

export const MODE_ORDER: readonly GameMode[] = ['classic', 'story', 'training', 'daily']

export const MODES: Readonly<Record<GameMode, GameModeConfig>> = {
  classic: { label: '經典闖關', icon: '⚔️', desc: '連闖三關打倒怪物，挑戰最高分', available: true },
  story: { label: '故事模式', icon: '📖', desc: '跟著 AI 寫的故事一路打下去', available: false },
  training: { label: '弱點特訓', icon: '🎯', desc: 'AI 針對你常打錯的鍵出題', available: false },
  daily: { label: '每日挑戰', icon: '📅', desc: '每天一題，和大家比速度', available: false },
}

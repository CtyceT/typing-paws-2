import type { IconName, IconTone } from './icons.ts'

/** 遊戲模式代號 */
export type GameMode = 'classic' | 'story' | 'training' | 'daily'

export interface GameModeConfig {
  /** 顯示名稱（繁中） */
  label: string
  icon: IconName
  /** 圖示的色塊顏色 */
  tone: IconTone
  /** 選單上的一句話說明 */
  desc: string
  /** 是否已經可以玩；false 的模式在選單上顯示「即將推出」 */
  available: boolean
}

export const MODE_ORDER: readonly GameMode[] = ['classic', 'story', 'training', 'daily']

export const MODES: Readonly<Record<GameMode, GameModeConfig>> = {
  classic: { label: '經典闖關', icon: 'sword', tone: 'pink', desc: '連闖三關打倒怪物，挑戰最高分', available: true },
  story: { label: '故事模式', icon: 'book', tone: 'lilac', desc: '跟著 AI 寫的故事一路打下去', available: false },
  training: { label: '弱點特訓', icon: 'target', tone: 'mint', desc: 'AI 針對你常打錯的鍵出題', available: true },
  daily: { label: '每日挑戰', icon: 'calendar', tone: 'yellow', desc: '每天一題，和大家比速度', available: false },
}

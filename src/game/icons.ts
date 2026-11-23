// 介面圖示的代號（D90）。src/game 只用代號，畫面再用 src/components/Icon.tsx 對應到 Phosphor 的圖示，
// 遊戲邏輯不需要依賴 React 或圖示套件。介面不使用 emoji（怪物的 emoji 備案除外，見 D86）。
export const ICON_NAMES = [
  'sword', 'book', 'target', 'calendar',
  'plant', 'star', 'fire',
  'coffee', 'magic', 'rocket', 'backpack',
  'trendDown', 'trendUp', 'minus', 'sparkle',
  'confetti', 'trophy', 'heartBreak', 'medal',
  'syncing', 'warning', 'cloudCheck',
  'paw', 'key', 'sad', 'package', 'download',
  'gamepad', 'chartLine', 'chartBar', 'broom',
  'keyboard', 'hourglass', 'pause', 'play', 'flag', 'pointer', 'capsLock',
  'books', 'robot', 'retry', 'home', 'lock', 'user', 'lightning',
] as const
export type IconName = (typeof ICON_NAMES)[number]

/** 圖示的色塊顏色，只用 CLAUDE.md 的色票 */
export type IconTone = 'pink' | 'mint' | 'yellow' | 'lilac'

/** 一個圖示加一段文字 */
export interface IconText {
  icon: IconName
  text: string
}

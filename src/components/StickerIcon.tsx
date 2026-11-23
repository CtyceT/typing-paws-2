import type { IconName, IconTone } from '../game/index.ts'
import { Icon } from './Icon.tsx'
import iconStyles from './Icon.module.css'
import styles from './StickerIcon.module.css'

export interface StickerIconProps {
  name: IconName
  /** 色塊的顏色（只用色票） */
  tone: IconTone
  /** circle 圓形、rounded 圓角方形 */
  shape?: 'circle' | 'rounded'
  /** 色塊的邊長（px） */
  size?: number
  /** 沒有旁邊的文字可以說明時要給（例如訊息視窗的大圖示另有標題就不用） */
  label?: string
  className?: string
}

/**
 * 貼紙風的大圖示（D90）：色票色塊底、粗深紫外框、偏移陰影，中間是 Phosphor Duotone 圖示。
 * 模式卡片、玩法說明、訊息視窗標題這類「大圖示」用它；按鈕和文字裡的小圖示直接用 Icon。
 */
export function StickerIcon({ name, tone, shape = 'circle', size = 56, label, className }: StickerIconProps) {
  const classes = [styles.sticker, styles[shape], styles[tone], className].filter(Boolean).join(' ')
  return (
    <span className={classes} style={{ width: size, height: size }} {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
      <Icon name={name} size={Math.round(size * 0.58)} className={iconStyles.onSticker} />
    </span>
  )
}

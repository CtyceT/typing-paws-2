import type { IconName, IconTone } from '../game/index.ts'
import { ICON_PATHS } from './icon-paths.ts'
import styles from './Icon.module.css'

export interface IconProps {
  name: IconName
  /** 有給就是獨立的圖示（螢幕閱讀器會念出來）；沒給表示旁邊有文字說明，圖示本身對輔助科技隱藏 */
  label?: string
  /** Duotone 的淡色色塊改成色票的顏色；不給就是線條同色的淡色 */
  tone?: IconTone
  /** 大小，預設跟著文字大小（1.15em） */
  size?: number | string
  className?: string
}

/**
 * 文字裡、按鈕上的小圖示：Phosphor Icons 的 Duotone 樣式（形狀由 scripts/build-icons.mjs 產生），線條用文字顏色。
 * 規則（D90）：每個圖示都要有 label，或旁邊有文字說明。
 */
export function Icon({ name, label, tone, size = '1.15em', className }: IconProps) {
  const [light, line] = ICON_PATHS[name]
  const classes = [styles.icon, tone && styles[tone], className].filter(Boolean).join(' ')
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const }
  return (
    <svg className={classes} width={size} height={size} viewBox="0 0 256 256" fill="currentColor" data-icon={name} {...a11y}>
      <path className={styles.light} d={light} />
      <path d={line} />
    </svg>
  )
}

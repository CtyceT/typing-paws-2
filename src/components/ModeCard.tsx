import type { HTMLAttributes } from 'react'
import { MODES, type GameMode } from '../game/index.ts'
import { StickerIcon } from './StickerIcon.tsx'
import styles from './ModeCard.module.css'

export interface ModeCardProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  mode: GameMode
  /** 目前選中的模式：黃底加打勾 */
  selected?: boolean
}

/** 遊戲模式卡片。可以玩的模式是按鈕，點了就切換過去；還沒開放的模式是灰色、標「即將推出」，不能點 */
export function ModeCard({ mode, selected = false, className, ...rest }: ModeCardProps) {
  const m = MODES[mode]
  const classes = [styles.card, selected && styles.selected, !m.available && styles.soon, m.available && styles.clickable, className]
  const Element = m.available ? 'button' : 'div'
  return (
    <Element
      {...(m.available ? { type: 'button' } : { 'aria-disabled': 'true' })}
      className={classes.filter(Boolean).join(' ')}
      aria-current={selected ? 'true' : undefined}
      {...rest}
    >
      <StickerIcon name={m.icon} tone={m.tone} size={48} className={styles.icon} />
      <div className={styles.name}>{m.label}</div>
      <div className={styles.desc}>{m.desc}</div>
      {!m.available && <div className={styles.badge}>即將推出</div>}
    </Element>
  )
}

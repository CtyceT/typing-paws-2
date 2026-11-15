import type { HTMLAttributes } from 'react'
import { MODES, type GameMode } from '../game/index.ts'
import styles from './ModeCard.module.css'

export interface ModeCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  mode: GameMode
  /** 目前選中的模式：黃底加打勾 */
  selected?: boolean
}

/** 遊戲模式卡片。還沒開放的模式是灰色、標「即將推出」，不能點 */
export function ModeCard({ mode, selected = false, className, ...rest }: ModeCardProps) {
  const m = MODES[mode]
  const classes = [styles.card, selected && styles.selected, !m.available && styles.soon, className]
  return (
    <div
      className={classes.filter(Boolean).join(' ')}
      aria-current={selected ? 'true' : undefined}
      aria-disabled={m.available ? undefined : 'true'}
      {...rest}
    >
      <div className={styles.icon} aria-hidden="true">
        {m.icon}
      </div>
      <div className={styles.name}>{m.label}</div>
      <div className={styles.desc}>{m.desc}</div>
      {!m.available && <div className={styles.badge}>即將推出</div>}
    </div>
  )
}

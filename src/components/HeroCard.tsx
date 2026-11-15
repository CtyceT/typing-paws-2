import { useState, type ButtonHTMLAttributes } from 'react'
import { HEROES, type HeroId } from '../game/index.ts'
import { HeroAvatar } from './HeroAvatar.tsx'
import styles from './HeroCard.module.css'

export interface HeroCardProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  hero: HeroId
  selected?: boolean
}

/** 勇者選擇卡片：滑過會浮起並變成開心表情，選中的是黃底加打勾 */
export function HeroCard({ hero, selected = false, className, onMouseEnter, onMouseLeave, ...rest }: HeroCardProps) {
  const [hovered, setHovered] = useState(false)
  const info = HEROES[hero]
  return (
    <button
      type="button"
      className={[styles.card, selected && styles.selected, className].filter(Boolean).join(' ')}
      aria-pressed={selected}
      onMouseEnter={(e) => {
        setHovered(true)
        onMouseEnter?.(e)
      }}
      onMouseLeave={(e) => {
        setHovered(false)
        onMouseLeave?.(e)
      }}
      {...rest}
    >
      <HeroAvatar hero={hero} expression={hovered ? 'happy' : 'normal'} className={styles.avatar} />
      <div className={styles.name}>{info.name}勇者</div>
      <div className={styles.sub}>{info.sub}</div>
    </button>
  )
}

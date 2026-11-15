import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { DIFFICULTIES, type Difficulty } from '../game/index.ts'
import styles from './DifficultyCard.module.css'

export interface DifficultyCardProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  difficulty: Difficulty
  /** 最佳紀錄那一格的內容；沒給就顯示「還沒有紀錄」 */
  best?: ReactNode
}

/** 難度卡片：整張可以點，點了就開始戰鬥 */
export function DifficultyCard({ difficulty, best, className, ...rest }: DifficultyCardProps) {
  const d = DIFFICULTIES[difficulty]
  return (
    <button type="button" className={[styles.card, styles[difficulty], className].filter(Boolean).join(' ')} {...rest}>
      <div className={styles.icon} aria-hidden="true">
        {d.icon}
      </div>
      <div className={styles.name}>{d.label}</div>
      <div className={styles.desc}>{d.desc}</div>
      <div className={styles.best}>{best ?? '還沒有紀錄，來當第一次挑戰吧！'}</div>
    </button>
  )
}

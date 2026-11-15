import type { ReactNode } from 'react'
import type { Difficulty } from '../game/index.ts'
import styles from './Tag.module.css'

/** 小標籤，顏色跟著難度走（簡單綠、普通黃、困難粉） */
export function Tag({ tone, children }: { tone: Difficulty; children: ReactNode }) {
  return <span className={`${styles.tag} ${styles[tone]}`}>{children}</span>
}

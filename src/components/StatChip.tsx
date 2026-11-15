import type { ReactNode } from 'react'
import styles from './StatChip.module.css'

export interface StatChipProps {
  label: string
  value: ReactNode
}

/** 戰鬥畫面頂部的小數據（時間、WPM…） */
export function StatChip({ label, value }: StatChipProps) {
  return (
    <div className={styles.chip}>
      <small>{label}</small>
      <span>{value}</span>
    </div>
  )
}

import styles from './ProgressBar.module.css'

export interface ProgressBarProps {
  /** 進度，0～1；超出範圍會被夾住 */
  value: number
  /** player：勇者血條（綠）；monster：怪物血條（粉）；charge：怪物蓄力條（黃，較細） */
  tone: 'player' | 'monster' | 'charge'
  /** 蓄力條快滿時變紅 */
  danger?: boolean
  /** 給螢幕閱讀器的名稱 */
  label: string
}

/** 貼紙風進度條：血條與蓄力條共用 */
export function ProgressBar({ value, tone, danger = false, label }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100
  const classes = [styles.bar, styles[tone], danger && styles.danger].filter(Boolean).join(' ')
  return (
    <div className={classes} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <i className={styles.fill} style={{ width: `${pct}%` }} />
    </div>
  )
}

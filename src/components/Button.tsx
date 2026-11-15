import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary：黃色主要按鈕；ghost：白色次要按鈕 */
  variant?: 'primary' | 'ghost'
  size?: 'normal' | 'small'
}

/** 貼紙風膠囊按鈕：滑過會浮起，按下會壓扁 */
export function Button({ variant = 'primary', size = 'normal', className, type = 'button', ...rest }: ButtonProps) {
  const classes = [styles.btn, variant === 'ghost' && styles.ghost, size === 'small' && styles.small, className]
  return <button type={type} className={classes.filter(Boolean).join(' ')} {...rest} />
}

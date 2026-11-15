import type { HTMLAttributes } from 'react'
import styles from './Card.module.css'

/** 貼紙風卡片：白底、粗深紫外框、偏移陰影 */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={[styles.card, className].filter(Boolean).join(' ')} {...rest} />
}

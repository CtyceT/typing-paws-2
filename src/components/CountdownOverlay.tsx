import styles from './CountdownOverlay.module.css'

export interface CountdownOverlayProps {
  /** 目前要顯示的字（3、2、1、GO!） */
  text: string
}

/** 開打前蓋住整個畫面的倒數大字 */
export function CountdownOverlay({ text }: CountdownOverlayProps) {
  return (
    <div className={styles.overlay} role="status" aria-live="assertive">
      {/* key 讓每換一個字就重播一次彈出動畫 */}
      <div key={text} className={styles.count}>
        {text}
      </div>
    </div>
  )
}

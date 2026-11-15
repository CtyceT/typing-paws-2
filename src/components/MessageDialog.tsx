import { Fragment, useEffect, useId, type ReactNode } from 'react'
import { Button } from './Button.tsx'
import { Card } from './Card.tsx'
import styles from './MessageDialog.module.css'

export interface DialogButton {
  label: string
  /** 主要按鈕（黃色）；按 Enter 會觸發第一個主要按鈕 */
  primary?: boolean
  onClick: () => void
}

export interface MessageDialogProps {
  open: boolean
  /** 上方的大圖示，可以是 emoji 或任何元素 */
  emoji: ReactNode
  title: string
  /** 內文，用 \n 換行 */
  text: string
  buttons: readonly DialogButton[]
}

/** 置中的訊息視窗，蓋住整個畫面（開場、過關、暫停等訊息用） */
export function MessageDialog({ open, emoji, title, text, buttons }: MessageDialogProps) {
  const titleId = useId()
  const primary = buttons.find((b) => b.primary)?.onClick

  useEffect(() => {
    if (!open || !primary) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.isComposing) return
      e.preventDefault()
      primary()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, primary])

  if (!open) return null
  const lines = text.split('\n')
  return (
    <div className={styles.overlay}>
      <Card className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className={styles.emoji}>{emoji}</div>
        <h2 className={styles.title} id={titleId}>
          {title}
        </h2>
        <p className={styles.text}>
          {lines.map((line, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              {line}
            </Fragment>
          ))}
        </p>
        <div className={styles.buttons}>
          {buttons.map((b) => (
            <Button key={b.label} variant={b.primary ? 'primary' : 'ghost'} onClick={b.onClick}>
              {b.label}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  )
}

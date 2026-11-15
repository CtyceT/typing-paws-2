import type { CharView } from '../game/index.ts'
import styles from './WordDisplay.module.css'

export interface WordDisplayProps {
  chars: readonly CharView[]
}

/** 目前要打的字：已打的變綠、目前的字元有底線、打錯變紅、空白用「·」提示 */
export function WordDisplay({ chars }: WordDisplayProps) {
  const word = chars.map((c) => c.char).join('')
  return (
    <div className={styles.word} role="img" aria-label={`目前的題目：${word}`} data-word={word}>
      {chars.map((c, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={[styles.ch, styles[c.status], c.error && styles.err, c.space && styles.space].filter(Boolean).join(' ')}
        >
          {c.space ? '' : c.char}
        </span>
      ))}
    </div>
  )
}

import { useState } from 'react'
import { HEAT_LEGEND, heatKeyInfo, type HeatKey } from '../game/index.ts'
import styles from './KeyboardHeatmap.module.css'

const HINT = '把滑鼠移到按鍵上（手機用點的）可以看詳細數字'

/** 鍵盤熱力圖：QWERTY 鍵盤上依錯誤率上色，移到按鍵上會在下方顯示數字 */
export function KeyboardHeatmap({ rows }: { rows: readonly (readonly HeatKey[])[] }) {
  const [active, setActive] = useState<HeatKey | null>(null)
  return (
    <div>
      <div className={styles.keyboard} role="group" aria-label="鍵盤熱力圖" onMouseLeave={() => setActive(null)}>
        {rows.map((row, i) => (
          <div key={i} className={styles.row}>
            {row.map((k) => (
              <button
                key={k.key}
                type="button"
                className={[styles.key, styles[`l${k.level}`], k.key === ' ' && styles.space, active?.key === k.key && styles.active].filter(Boolean).join(' ')}
                data-key={k.key}
                data-level={k.level}
                title={heatKeyInfo(k)}
                aria-label={heatKeyInfo(k)}
                onMouseEnter={() => setActive(k)}
                onFocus={() => setActive(k)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(k)}
              >
                {k.label}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className={styles.info} aria-live="polite">
        {active ? heatKeyInfo(active) : HINT}
      </div>
      <div className={styles.legend}>
        <span className={styles.legendTitle}>錯誤率</span>
        {[1, 2, 3, 4, 5, 0].map((level) => (
          <span key={level} className={styles.legendItem}>
            <span className={`${styles.swatch} ${styles[`l${level}`]}`} aria-hidden="true" />
            {HEAT_LEGEND[level]}
          </span>
        ))}
      </div>
    </div>
  )
}

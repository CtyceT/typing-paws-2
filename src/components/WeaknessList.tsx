import { Fragment } from 'react'
import { WEAKNESS_REASON_LABEL, weaknessDetail, weaknessEmptyText, weaknessKindLabel, type WeaknessReport } from '../game/index.ts'
import styles from './WeaknessList.module.css'

/** 弱點排行榜：最弱的排第一；資料不足或沒有弱點時顯示說明文字 */
export function WeaknessList({ report }: { report: WeaknessReport }) {
  const empty = weaknessEmptyText(report)
  if (empty !== null) {
    return (
      <div className={styles.empty}>
        {empty.split('\n').map((line, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            {line}
          </Fragment>
        ))}
      </div>
    )
  }
  return (
    <ol className={styles.list} aria-label="弱點排行榜">
      {report.items.map((w, i) => {
        const detail = weaknessDetail(w)
        return (
          <li key={`${w.kind}:${w.key}`} className={styles.item} data-weakness={`${w.kind}:${w.key}`}>
            <span className={styles.rank} aria-hidden="true">
              {i + 1}
            </span>
            <span className={styles.keys} aria-label={`${weaknessKindLabel(w)} ${w.key}`}>
              {[...w.key].map((ch, j) => (
                <kbd key={j} className={styles.keycap}>
                  {ch.toUpperCase()}
                </kbd>
              ))}
            </span>
            <span className={styles.body}>
              <span className={styles.head}>
                <span className={styles.kind}>{weaknessKindLabel(w)}</span>
                <b>{WEAKNESS_REASON_LABEL[w.reason]}</b>
              </span>
              <span className={styles.detail}>{detail.errors}</span>
              <span className={styles.detail}>{detail.speed}</span>
              {/* 錯誤率的長條：滿格是 50%，超過就頂到底 */}
              <span className={styles.bar} aria-hidden="true">
                <span className={styles.barFill} style={{ width: `${Math.min(100, w.errorRate * 200)}%` }} />
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

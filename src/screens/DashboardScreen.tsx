import { useMemo } from 'react'
import { Button, Card } from '../components/index.ts'
import { aggregateKeyStats, dashboardSummary, hasDashboardData, summaryStats, type KeyStatRow, type Records } from '../game/index.ts'
import styles from './DashboardScreen.module.css'

export interface DashboardScreenProps {
  records: Records
  /** 最近幾場的按鍵統計 */
  keyStats: readonly KeyStatRow[]
  onBack: () => void
}

/** 數據儀表板：總覽、鍵盤熱力圖、趨勢圖、弱點排行 */
export function DashboardScreen({ records, keyStats, onBack }: DashboardScreenProps) {
  const aggregates = useMemo(() => aggregateKeyStats(keyStats), [keyStats])
  const summary = dashboardSummary(records.history, aggregates)

  return (
    <main>
      <header className={styles.header}>
        <h1 className={styles.title}>📊 數據儀表板</h1>
        <Button variant="ghost" size="small" onClick={onBack}>
          🏠 回到選單
        </Button>
      </header>

      {hasDashboardData(records.history, aggregates) ? (
        <>
          <p className={styles.note}>統計最近 {summary.games} 場的表現（最多保留 30 場）・資料只存在你自己的瀏覽器</p>
          <div className={styles.summary}>
            {summaryStats(summary).map((s) => (
              <div key={s.label} className={styles.stat}>
                <div className={styles.value}>{s.value}</div>
                <div className={styles.label}>{s.label}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Card className={styles.guide}>
          <div className={styles.guideEmoji} aria-hidden="true">
            🐾
          </div>
          <h2 className={styles.guideTitle}>還沒有數據</h2>
          <p className={styles.guideText}>
            打完一場戰鬥後，這裡會出現你的
            <br />
            鍵盤熱力圖、進步趨勢和弱點排行。
          </p>
          <Button onClick={onBack}>⚔️ 去打一場</Button>
        </Card>
      )}
    </main>
  )
}

import { useMemo, useState } from 'react'
import { Button, Card, KeyboardHeatmap, PerformanceTrendChart, WeaknessList } from '../components/index.ts'
import {
  aggregateKeyStats,
  dashboardSummary,
  findWeaknesses,
  hasDashboardData,
  heatmapRows,
  performanceTrend,
  summaryStats,
  TREND_COUNT,
  type KeyStatRow,
  type Records,
  type TrendRange,
} from '../game/index.ts'
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
  const hasKeyStats = summary.keyCount > 0
  const weaknesses = useMemo(() => findWeaknesses(aggregates), [aggregates])
  const [range, setRange] = useState<TrendRange>('recent')
  const trend = performanceTrend(records.history, range)
  const ranges: { id: TrendRange; label: string }[] = [
    { id: 'recent', label: `最近 ${TREND_COUNT} 場` },
    { id: 'all', label: `全部（${records.history.length} 場）` },
  ]

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

          <h2 className={styles.sectionTitle}>⌨️ 鍵盤熱力圖</h2>
          <Card>
            {hasKeyStats ? (
              <KeyboardHeatmap rows={heatmapRows(aggregates)} />
            ) : (
              <div className={styles.empty}>
                還沒有按鍵統計 🐾
                <br />
                在 2.0 打完一場戰鬥後，這裡會標出你常打錯的鍵
              </div>
            )}
          </Card>

          <div className={styles.sectionRow}>
            <h2 className={styles.sectionTitle}>📈 WPM／準確率趨勢</h2>
            <div className={styles.toggle} role="group" aria-label="趨勢圖的範圍">
              {ranges.map((r) => (
                <button key={r.id} type="button" className={styles.toggleBtn} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <Card>{trend ? <PerformanceTrendChart trend={trend} /> : <div className={styles.empty}>還沒有戰績 🐾</div>}</Card>

          <h2 className={styles.sectionTitle}>🎯 弱點排行榜</h2>
          <Card>
            <WeaknessList report={weaknesses} />
            <p className={styles.footnote}>
              依最近的按鍵統計，列出最常打錯或打得特別慢的字母與字母組合（最多 5 個）。之後的「弱點特訓」會針對這些出題。
            </p>
          </Card>
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

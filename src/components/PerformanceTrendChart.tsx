import { lazy, Suspense } from 'react'
import type { ChartData, ChartOptions } from 'chart.js'
import type { PerformancePoint, PerformanceTrend } from '../game/index.ts'
import styles from './PerformanceTrendChart.module.css'

/** Chart.js 用到的時候才下載；外框有固定高度，載入前後版面不會跳動 */
const Line = lazy(() => import('./ChartLine.tsx'))

const INK = '#4a3550'
const INK_SOFT = '#8a7590'
const GRID = '#f1e1d6'
const MINT = '#6fd6b0'
const PINK = '#ff8fab'
const FONT = "Fredoka, 'PingFang TC', 'Microsoft JhengHei', sans-serif"

const prefersReducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface PanelProps {
  title: string
  unit: string
  points: readonly PerformancePoint[]
  pick: (p: PerformancePoint) => number
  /** 線底下的填色 */
  fill: string
  min: number
  max: number
  /** true：max 只是建議值，讓 Chart.js 自己取整齊的刻度 */
  looseMax?: boolean
}

/** 一張單一指標的折線圖。點的顏色和形狀都代表結果：綠色圓點是通關、粉紅三角是被打倒 */
function Panel({ title, unit, points, pick, fill, min, max, looseMax = false }: PanelProps) {
  const data: ChartData<'line'> = {
    labels: points.map((p) => String(p.index)),
    datasets: [
      {
        label: title,
        data: points.map(pick),
        borderColor: INK,
        borderWidth: 2.5,
        borderJoinStyle: 'round',
        backgroundColor: fill,
        fill: 'start',
        pointRadius: points.map((p) => (p.win ? 5 : 6)),
        pointHoverRadius: 8,
        pointBorderWidth: 2,
        pointBorderColor: INK,
        pointStyle: points.map((p) => (p.win ? 'circle' : 'triangle')),
        pointBackgroundColor: points.map((p) => (p.win ? MINT : PINK)),
        pointHoverBackgroundColor: points.map((p) => (p.win ? MINT : PINK)),
        clip: false,
      },
    ],
  }
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: prefersReducedMotion() ? false : { duration: 400 },
    layout: { padding: { top: 10, right: 12 } },
    // 滑鼠在圖上任何高度都會選到最近的那一場，不用對準小圓點
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        offset: points.length === 1,
        grid: { display: false },
        border: { color: GRID, width: 2 },
        ticks: { color: INK_SOFT, font: { family: FONT, size: 11 }, maxRotation: 0, autoSkipPadding: 12 },
      },
      y: {
        min,
        ...(looseMax ? { suggestedMax: max } : { max }),
        border: { display: false },
        grid: { color: GRID },
        ticks: { color: INK_SOFT, font: { family: FONT, size: 11 }, maxTicksLimit: 5, callback: (v) => `${v}${unit}` },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        backgroundColor: INK,
        titleFont: { family: FONT, weight: 500 },
        bodyFont: { family: FONT, weight: 600, size: 14 },
        cornerRadius: 10,
        padding: 8,
        callbacks: {
          title: (items) => points[items[0].dataIndex].title,
          label: (item) => `${title} ${item.formattedValue}${unit}`,
        },
      },
    },
  }
  return (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>{title}</div>
      <div className={styles.canvas}>
        <Suspense fallback={null}>
          <Line data={data} options={options} role="img" aria-label={`${title} 趨勢`} />
        </Suspense>
      </div>
    </div>
  )
}

/**
 * WPM 與準確率的趨勢：兩張上下排列、橫軸相同的折線圖。
 * 兩個指標的單位不同，所以不畫在同一張圖的雙縱軸上（雙縱軸很容易讓人誤讀兩條線的交叉）。
 */
export function PerformanceTrendChart({ trend }: { trend: PerformanceTrend }) {
  const { points } = trend
  return (
    <div>
      <Panel title="WPM" unit="" points={points} pick={(p) => p.wpm} fill="rgba(255, 217, 227, 0.7)" min={0} max={trend.wpmMax} looseMax />
      <Panel title="準確率" unit="%" points={points} pick={(p) => p.accuracy} fill="rgba(226, 214, 248, 0.7)" min={trend.accuracyMin} max={100} />
      <div className={styles.caption}>
        橫軸是第幾場（由舊到新）・<span className={styles.win} aria-hidden="true" /> 通關・<span className={styles.loss} aria-hidden="true" /> 被打倒
      </div>
      <details className={styles.details}>
        <summary>用表格看這些數字</summary>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>場</th>
              <th>時間・難度・結果</th>
              <th>WPM</th>
              <th>準確率</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.index}>
                <td>{p.index}</td>
                <td>{p.title}</td>
                <td>{p.wpm}</td>
                <td>{p.accuracy}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

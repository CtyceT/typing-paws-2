import { lazy, Suspense } from 'react'
import type { ChartData, ChartOptions, Plugin } from 'chart.js'
import type { WpmTrend } from '../game/index.ts'
import styles from './WpmTrendChart.module.css'

/** Chart.js 用到的時候才下載；外框有固定高度，載入前後版面不會跳動 */
const Line = lazy(() => import('./ChartLine.tsx'))

const INK = '#4a3550'
const MINT = '#6fd6b0'
const PINK = '#ff8fab'
const FONT = "Fredoka, 'PingFang TC', 'Microsoft JhengHei', sans-serif"

/** 照 1.0 版的走勢圖：底部一條淡淡的基準線，最後一個點的上方標出最近一場的 WPM */
const decorations: Plugin<'line'> = {
  id: 'typingPawsDecorations',
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea } = chart
    ctx.save()
    ctx.strokeStyle = '#e8d8e0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(chartArea.left, chartArea.bottom)
    ctx.lineTo(chartArea.right, chartArea.bottom)
    ctx.stroke()
    ctx.restore()
  },
  afterDatasetsDraw(chart) {
    const points = chart.getDatasetMeta(0).data
    const last = points[points.length - 1]
    const value = chart.data.datasets[0].data[points.length - 1]
    if (!last || typeof value !== 'number') return
    const { ctx } = chart
    ctx.save()
    ctx.font = `700 13px ${FONT}`
    ctx.fillStyle = INK
    ctx.textAlign = 'right'
    ctx.fillText(String(value), last.x, last.y - 12)
    ctx.restore()
  },
}

const prefersReducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** 最近幾場的 WPM 走勢圖：綠點是通關、粉紅點是被打倒，滑鼠移到點上看得到該場的說明 */
export function WpmTrendChart({ trend }: { trend: WpmTrend }) {
  const data: ChartData<'line'> = {
    labels: trend.points.map((_, i) => String(i + 1)),
    datasets: [
      {
        data: trend.points.map((p) => p.wpm),
        borderColor: INK,
        borderWidth: 3,
        borderJoinStyle: 'round',
        borderCapStyle: 'round',
        backgroundColor: 'rgba(255, 217, 227, 0.7)',
        fill: 'origin',
        pointRadius: 6,
        pointHoverRadius: 7,
        pointBorderWidth: 2.5,
        pointHoverBorderWidth: 2.5,
        pointBorderColor: INK,
        pointBackgroundColor: trend.points.map((p) => (p.win ? MINT : PINK)),
        pointHoverBackgroundColor: trend.points.map((p) => (p.win ? MINT : PINK)),
        clip: false,
      },
    ],
  }
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: prefersReducedMotion() ? false : { duration: 400 },
    layout: { padding: 18 },
    scales: {
      x: { display: false, offset: false },
      y: { display: false, min: 0, max: trend.yMax },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        backgroundColor: INK,
        titleFont: { family: FONT },
        bodyFont: { family: FONT, weight: 600 },
        cornerRadius: 10,
        padding: 8,
        callbacks: {
          title: () => '',
          label: (item) => trend.points[item.dataIndex].tooltip,
        },
      },
    },
  }
  return (
    <div className={styles.chart}>
      <Suspense fallback={null}>
        <Line data={data} options={options} plugins={[decorations]} role="img" aria-label="WPM 走勢" />
      </Suspense>
    </div>
  )
}

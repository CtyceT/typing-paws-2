// Chart.js 只從這個檔案載入。圖表元件用 lazy() 動態載入它，所以不需要畫圖的畫面
// （沒有戰績的主選單、戰鬥、結算）不會下載 Chart.js（ROADMAP 11.5）。
import { CategoryScale, Chart as ChartJS, Filler, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Filler, Tooltip)

export default Line

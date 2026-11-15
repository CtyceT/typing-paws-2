import { useState } from 'react'
import { Button, Card, MessageDialog, ProgressBar, Tag, type MessageDialogProps } from '../components/index.ts'
import { DIFFICULTIES, DIFFICULTY_ORDER, MONSTERS } from '../game/index.ts'
import styles from './DemoPage.module.css'

/** 文字內容刻意和 1.0 版相同，方便截圖並排比對 */
const HOW = [
  { e: '⌨️', title: '打字＝攻擊', text: '打完一個單字就會對怪物造成傷害，字越長越痛' },
  { e: '🔥', title: '連擊加成', text: '連續打對累積 Combo，每 10 下傷害倍率 +0.5（最高 ×3）' },
  { e: '⏳', title: '小心反擊', text: '怪物的黃色蓄力條滿了就會攻擊你；打錯字會讓它蓄力更快' },
  { e: '🏆', title: '三關闖關', text: '打倒 3 隻怪物就通關，成績與最佳紀錄會自動保存' },
]

type DialogContent = Omit<MessageDialogProps, 'open'>

/** 共用元件展示頁，只在開發模式用 ?demo 開啟 */
export default function DemoPage() {
  const [dialog, setDialog] = useState<DialogContent | null>(null)
  const [value, setValue] = useState(0.64)
  const close = () => setDialog(null)
  const first = MONSTERS[0]

  const openIntro = () =>
    setDialog({
      emoji: first.emoji,
      title: `${first.name} 出現了！`,
      text: `「${first.line}」\n把字打完就能攻擊，小心黃色蓄力條！\n⌨️ 記得先切換成「英文」輸入法喔`,
      buttons: [{ label: '⚔️ 開打！（Enter）', primary: true, onClick: close }],
    })
  const openPause = () =>
    setDialog({
      emoji: '⏸',
      title: '暫停中',
      text: '喘口氣，準備好再繼續！',
      buttons: [
        { label: '▶ 繼續（Esc）', primary: true, onClick: close },
        { label: '🏳 放棄回選單', onClick: close },
      ],
    })

  return (
    <main>
      <h1>共用元件展示</h1>

      <div className={styles.title}>卡片 Card</div>
      <div className={styles.howGrid} data-demo="cards">
        {HOW.map((h) => (
          <Card key={h.title} className={styles.how}>
            <div className={styles.e}>{h.e}</div>
            <b>{h.title}</b>
            <small>{h.text}</small>
          </Card>
        ))}
      </div>

      <div className={styles.title}>按鈕 Button</div>
      <div className={styles.row} data-demo="buttons">
        <Button data-demo="btn-primary">⚔️ 開打！（Enter）</Button>
        <Button variant="ghost" data-demo="btn-ghost">
          🏳 放棄回選單
        </Button>
        <Button size="small">小的主要按鈕</Button>
      </div>

      <div className={styles.title}>卡片裡的小按鈕與標籤 Tag</div>
      <Card>
        <div className={styles.row} data-demo="tags">
          {DIFFICULTY_ORDER.map((d) => (
            <Tag key={d} tone={d}>
              {DIFFICULTIES[d].label}
            </Tag>
          ))}
          <Button variant="ghost" size="small" data-demo="btn-small-ghost">
            🧹 清除紀錄
          </Button>
        </div>
      </Card>

      <div className={styles.title}>進度條 ProgressBar</div>
      <div className={styles.bars} data-demo="bars">
        <ProgressBar tone="player" value={value} label="勇者血量" />
        <ProgressBar tone="monster" value={value} label="怪物血量" />
        <ProgressBar tone="charge" value={value} danger={value > 0.75} label="怪物蓄力" />
      </div>
      <label className={styles.slider}>
        進度
        <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => setValue(Number(e.target.value))} />
        {Math.round(value * 100)}%（蓄力條超過 75% 變紅）
      </label>

      <div className={styles.title}>訊息視窗 MessageDialog</div>
      <div className={styles.row}>
        <Button variant="ghost" data-demo="open-intro" onClick={openIntro}>
          開場訊息
        </Button>
        <Button variant="ghost" data-demo="open-pause" onClick={openPause}>
          暫停訊息
        </Button>
      </div>

      {dialog && <MessageDialog open {...dialog} />}
    </main>
  )
}

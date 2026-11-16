import { useState, type ReactNode } from 'react'
import { AccountBar, Button, Card, DifficultyCard, HeroAvatar, HeroCard, MessageDialog, ModeCard, Tag, WpmTrendChart } from '../components/index.ts'
import {
  bestSummary,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  formatPlayedAt,
  hasRecords,
  HERO_ORDER,
  MODE_ORDER,
  MODES,
  recentHistory,
  recordOutcome,
  wpmTrend,
  type BestRecord,
  type Difficulty,
  type HeroId,
  type Records,
} from '../game/index.ts'
import styles from './MenuScreen.module.css'

const HOW = [
  { e: '⌨️', title: '打字＝攻擊', text: '打完一個單字就會對怪物造成傷害，字越長越痛' },
  { e: '🔥', title: '連擊加成', text: '連續打對累積 Combo，每 10 下傷害倍率 +0.5（最高 ×3）' },
  { e: '⏳', title: '小心反擊', text: '怪物的黃色蓄力條滿了就會攻擊你；打錯字會讓它蓄力更快' },
  { e: '🏆', title: '三關闖關', text: '打倒 3 隻怪物就通關，成績與最佳紀錄會自動保存' },
]

export interface MenuScreenProps {
  hero: HeroId
  /** 最佳紀錄與歷史戰績 */
  records: Records
  /** 是否已登入；訪客（預設）會看到「紀錄只存在這個瀏覽器」的說明 */
  signedIn?: boolean
  /** 右上角的帳號列；沒給就只顯示訪客標示 */
  accountBar?: ReactNode
  onSelectHero: (hero: HeroId) => void
  /** 點難度卡片：用經典闖關模式開始戰鬥 */
  onStart: (difficulty: Difficulty) => void
  /** 打開數據儀表板 */
  onOpenDashboard: () => void
  /** 確認清除所有紀錄之後呼叫 */
  onClearRecords: () => void
}

/** 難度卡片上的最佳紀錄：兩行文字；沒有紀錄時交給卡片顯示預設文字 */
function bestLines(best: BestRecord | undefined) {
  const lines = bestSummary(best)
  return lines ? (
    <>
      {lines[0]}
      <br />
      {lines[1]}
    </>
  ) : undefined
}

/** 主選單：選勇者、選模式、選難度、玩法說明、戰績 */
export function MenuScreen({ hero, records, signedIn = false, accountBar, onSelectHero, onStart, onOpenDashboard, onClearRecords }: MenuScreenProps) {
  const [confirmingClear, setConfirmingClear] = useState(false)
  const trend = wpmTrend(records.history)
  const recent = recentHistory(records.history)
  return (
    <main>
      {accountBar ?? <AccountBar user={null} />}

      <header className={styles.hero}>
        <div className={styles.mascot}>
          <HeroAvatar hero={hero} className={styles.mascotSvg} />
        </div>
        <h1 className={styles.title}>
          喵喵打字<span>大冒險</span> 2.0
        </h1>
        <p className={styles.subtitle}>Typing Paws — AI 個人化英文打字冒險</p>
      </header>

      <h2 className={styles.sectionTitle}>🐾 選擇你的勇者</h2>
      <div className={styles.grid4}>
        {HERO_ORDER.map((id) => (
          <HeroCard key={id} hero={id} selected={id === hero} onClick={() => onSelectHero(id)} />
        ))}
      </div>

      <h2 className={styles.sectionTitle}>🎮 選擇模式</h2>
      <div className={styles.grid4}>
        {MODE_ORDER.map((id) => (
          <ModeCard key={id} mode={id} selected={id === 'classic'} />
        ))}
      </div>

      <h2 className={styles.sectionTitle}>
        {MODES.classic.icon} {MODES.classic.label}：選擇難度開始戰鬥
      </h2>
      <div className={styles.grid3}>
        {DIFFICULTY_ORDER.map((d) => (
          <DifficultyCard key={d} difficulty={d} best={bestLines(records.best[d])} onClick={() => onStart(d)} />
        ))}
      </div>

      <h2 className={styles.sectionTitle}>📖 玩法說明</h2>
      <div className={styles.howGrid}>
        {HOW.map((h) => (
          <Card key={h.title} className={styles.how}>
            <div className={styles.e} aria-hidden="true">
              {h.e}
            </div>
            <b>{h.title}</b>
            <small>{h.text}</small>
          </Card>
        ))}
      </div>

      <div className={styles.sectionRow}>
        <h2 className={styles.sectionTitle}>📈 我的戰績</h2>
        <Button size="small" onClick={onOpenDashboard}>
          📊 數據儀表板
        </Button>
      </div>
      <div className={styles.historyWrap}>
        <Card>
          <div className={styles.sparkLabel}>
            <span>最近 10 場 WPM 走勢</span>
            {trend && <span>最高 {trend.best} ・ 綠點＝通關</span>}
          </div>
          {trend ? <WpmTrendChart trend={trend} /> : <div className={styles.empty}>玩 2 場以上就會畫出你的進步曲線 📈</div>}
        </Card>
        <Card>
          {recent.length === 0 ? (
            <div className={styles.empty}>
              還沒有戰績 🐾
              <br />
              完成一場戰鬥後會出現在這裡
            </div>
          ) : (
            <table className={styles.hist}>
              <thead>
                <tr>
                  <th>時間</th>
                  <th>難度</th>
                  <th>結果</th>
                  <th>WPM</th>
                  <th>準確</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td>{formatPlayedAt(r.playedAt)}</td>
                    <td>
                      <Tag tone={r.difficulty}>{DIFFICULTIES[r.difficulty].label}</Tag>
                    </td>
                    <td>{recordOutcome(r)}</td>
                    <td>
                      <b>{r.wpm}</b>
                    </td>
                    <td>{r.accuracy}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className={styles.rowEnd}>
            <Button variant="ghost" size="small" onClick={() => hasRecords(records) && setConfirmingClear(true)}>
              🧹 清除紀錄
            </Button>
          </div>
        </Card>
      </div>

      <footer className={styles.footer}>
        小提示：戰鬥中按 <b>Esc</b> 可以暫停 ・ {signedIn ? '紀錄會同步到你的帳號' : '目前是訪客模式，紀錄只存在這個瀏覽器'}
      </footer>

      <MessageDialog
        open={confirmingClear}
        emoji="🧹"
        title="清除所有紀錄？"
        text={'最佳紀錄、歷史戰績和按鍵統計都會被刪除，\n這個動作無法復原。'}
        buttons={[
          { label: '先不要（Enter）', primary: true, onClick: () => setConfirmingClear(false) },
          {
            label: '🧹 確定清除',
            onClick: () => {
              setConfirmingClear(false)
              onClearRecords()
            },
          },
        ]}
      />
    </main>
  )
}

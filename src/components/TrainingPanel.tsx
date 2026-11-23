import {
  DIFFICULTY_ORDER,
  THEME_INFO,
  TRAINING_DAILY_LIMIT,
  TRAINING_THEMES,
  type Difficulty,
  type TrainingPlan,
  type TrainingTheme,
} from '../game/index.ts'
import { Button } from './Button.tsx'
import { Card } from './Card.tsx'
import { DifficultyCard } from './DifficultyCard.tsx'
import { Icon } from './Icon.tsx'
import { StickerIcon } from './StickerIcon.tsx'
import styles from './TrainingPanel.module.css'

export interface TrainingPanelProps {
  /** 是否已登入；訪客不能使用 AI 功能 */
  signedIn: boolean
  /** 打開登入視窗；沒有登入功能（沒設定 Supabase）時不給 */
  onSignIn?: () => void
  /** 每個難度要練哪些鍵 */
  plans: Readonly<Record<Difficulty, TrainingPlan>>
  theme: TrainingTheme
  onSelectTheme: (theme: TrainingTheme) => void
  /** 點難度卡片：請 AI 出題並開始特訓 */
  onStart: (difficulty: Difficulty) => void
  /** 資料不足時的「去打經典闖關」 */
  onGoClassic: () => void
}

/** 鍵帽樣式的目標鍵；空白以外的符號原樣顯示 */
function Targets({ plan }: { plan: TrainingPlan }) {
  if (plan.status !== 'ready') return <>資料還不夠，先打幾場經典闖關</>
  return (
    <>
      <Icon name="target" /> 要練的鍵：
      {plan.targets.map((t) => (
        <kbd key={`${t.kind}:${t.key}`} className={styles.keycap}>
          {t.key}
        </kbd>
      ))}
    </>
  )
}

/** 主選單上「弱點特訓」的內容：訪客看到登入說明；資料不足看到引導；否則選主題、選難度開始 */
export function TrainingPanel({ signedIn, onSignIn, plans, theme, onSelectTheme, onStart, onGoClassic }: TrainingPanelProps) {
  if (!signedIn) {
    return (
      <Card className={styles.notice}>
        <StickerIcon name="lock" tone="lilac" className={styles.noticeIcon} />
        <b className={styles.noticeTitle}>登入後即可使用</b>
        <p className={styles.noticeText}>
          弱點特訓會請 AI 依照你的按鍵統計出題。AI 的免費額度是所有玩家共用的，所以需要登入才能使用；
          <br />
          不登入也可以繼續玩經典闖關，紀錄一樣會留在這個瀏覽器。
        </p>
        {onSignIn ? <Button onClick={onSignIn}>
            <Icon name="key" /> 登入
          </Button> : <p className={styles.noticeText}>（這個版本沒有開啟登入功能）</p>}
      </Card>
    )
  }
  // 困難難度可以練數字與符號，資料是否足夠三個難度的判斷相同，看任何一個都可以
  const sample = plans.normal.status === 'ready' ? plans.normal : plans.hard
  if (sample.status === 'insufficient') {
    return (
      <Card className={styles.notice}>
        <StickerIcon name="paw" tone="yellow" className={styles.noticeIcon} />
        <b className={styles.noticeTitle}>資料還不夠</b>
        <p className={styles.noticeText}>
          目前統計了 {sample.totalAttempts} 次按鍵，累積到 {sample.needed} 次就能找出你的弱點。
          <br />
          先打一兩場經典闖關吧！
        </p>
        <Button onClick={onGoClassic}>
          <Icon name="sword" /> 去打經典闖關
        </Button>
      </Card>
    )
  }
  return (
    <>
      <div className={styles.themeRow}>
        <span className={styles.themeLabel} id="training-theme-label">
          題目主題
        </span>
        <div className={styles.themes} role="group" aria-labelledby="training-theme-label">
          {TRAINING_THEMES.map((id) => (
            <button key={id} type="button" className={`${styles.theme} ${id === theme ? styles.themeOn : ''}`} aria-pressed={id === theme} onClick={() => onSelectTheme(id)}>
              <Icon name={THEME_INFO[id].icon} /> {THEME_INFO[id].label}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.grid3}>
        {DIFFICULTY_ORDER.map((d) => (
          <DifficultyCard key={d} difficulty={d} best={<Targets plan={plans[d]} />} disabled={plans[d].status !== 'ready'} onClick={() => onStart(d)} />
        ))}
      </div>
      <p className={styles.hint}>
        {sample.relative && '目前沒有明顯的弱點，先練相對比較弱的鍵。'}
        每天可以請 AI 出題 {TRAINING_DAILY_LIMIT} 次；同樣的組合 24 小時內會重複使用題目，不扣次數。特訓的成績不列入最佳紀錄。
      </p>
    </>
  )
}

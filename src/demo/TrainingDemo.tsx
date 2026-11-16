import { useState } from 'react'
import { TrainingPanel } from '../components/index.ts'
import { DEFAULT_THEME, type BattleResult, type Difficulty, type TrainingPlan, type TrainingTarget, type TrainingTheme } from '../game/index.ts'
import { ResultScreen } from '../screens/ResultScreen.tsx'
import { TrainingLoadingScreen } from '../screens/TrainingLoadingScreen.tsx'
import styles from './DemoPage.module.css'

const TARGETS: TrainingTarget[] = [
  { kind: 'char', key: 'q', errorRate: 0.4, attempts: 20 },
  { kind: 'char', key: 'z', errorRate: 0.3, attempts: 20 },
  { kind: 'bigram', key: 'th', errorRate: 0.25, attempts: 20 },
]
const READY: TrainingPlan = { status: 'ready', relative: false, targets: TARGETS }
const HARD: TrainingPlan = { status: 'ready', relative: false, targets: [{ kind: 'char', key: ';', errorRate: 0.5, attempts: 12 }, ...TARGETS.slice(0, 2)] }
const PLANS: Record<Difficulty, TrainingPlan> = { easy: READY, normal: READY, hard: HARD }
const NOT_ENOUGH: TrainingPlan = { status: 'insufficient', totalAttempts: 42, needed: 100 }
const RESULT: BattleResult = { difficulty: 'normal', win: true, wpm: 48, accuracy: 94.2, maxCombo: 31, score: 4380, damage: 464, durationMs: 91200, stage: 3, stars: 2 }
const never = new Promise<never>(() => {})
const noop = () => {}

/** 弱點特訓各種畫面的展示頁，只在開發模式用 ?demo=training 開啟（截圖檢查版面用） */
export default function TrainingDemo() {
  const [theme, setTheme] = useState<TrainingTheme>(DEFAULT_THEME)
  const panel = { theme, onSelectTheme: setTheme, onStart: noop, onGoClassic: noop }
  return (
    <>
      <main>
        <div className={styles.title}>弱點特訓：訪客</div>
        <TrainingPanel {...panel} signedIn={false} onSignIn={noop} plans={PLANS} />
        <div className={styles.title}>弱點特訓：資料不足</div>
        <TrainingPanel {...panel} signedIn plans={{ easy: NOT_ENOUGH, normal: NOT_ENOUGH, hard: NOT_ENOUGH }} />
        <div className={styles.title}>弱點特訓：可以開始</div>
        <TrainingPanel {...panel} signedIn plans={PLANS} />
        <div className={styles.title}>出題中</div>
      </main>
      <TrainingLoadingScreen targets={TARGETS} theme={theme} loading={never} onReady={noop} onCancel={noop} />
      <main>
        <div className={styles.title}>結算：特訓成效</div>
      </main>
      <ResultScreen
        hero="cat"
        result={RESULT}
        misses={[{ key: 'q', label: 'q', attempts: 25, errors: 3 }]}
        training={{
          source: 'ai',
          rows: [
            { kind: 'char', key: 'q', attempts: 25, errors: 3, rate: 0.12, beforeRate: 0.4, change: 'better' },
            { kind: 'char', key: 'z', attempts: 18, errors: 6, rate: 1 / 3, beforeRate: 0.3, change: 'worse' },
            { kind: 'bigram', key: 'th', attempts: 0, errors: 0, rate: null, beforeRate: 0.25, change: 'none' },
          ],
        }}
        onDashboard={noop}
        onRetry={noop}
        onMenu={noop}
      />
    </>
  )
}

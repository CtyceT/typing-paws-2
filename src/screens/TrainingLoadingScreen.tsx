import { useEffect, useState } from 'react'
import { Button, Card, Icon, MessageDialog, StickerIcon } from '../components/index.ts'
import { THEME_INFO, type TrainingTarget, type TrainingTheme } from '../game/index.ts'
import type { TrainingWords } from '../training/loadTrainingWords.ts'
import styles from './TrainingLoadingScreen.module.css'

export interface TrainingLoadingScreenProps {
  /** 這次要練的鍵 */
  targets: readonly TrainingTarget[]
  theme: TrainingTheme
  /** 出題的結果（已經開始了）；一定會有結果，失敗時是內建字庫加上說明 */
  loading: Promise<TrainingWords>
  /** 題目準備好了，開始戰鬥 */
  onReady: (words: TrainingWords) => void
  /** 取消，回主選單 */
  onCancel: () => void
}

/**
 * 「AI 出題中」的畫面。AI 成功就直接開始戰鬥；
 * 退回內建字庫時先跳出說明，讓玩家知道這場不是 AI 出的題，再決定要不要開始。
 */
export function TrainingLoadingScreen({ targets, theme, loading, onReady, onCancel }: TrainingLoadingScreenProps) {
  const [fallback, setFallback] = useState<TrainingWords | null>(null)

  useEffect(() => {
    let alive = true
    void loading.then((words) => {
      if (!alive) return
      if (words.source === 'builtin') setFallback(words)
      else onReady(words)
    })
    return () => {
      alive = false
    }
  }, [loading, onReady])

  return (
    <main>
      <Card className={styles.card}>
        <StickerIcon name="robot" tone="mint" size={72} className={styles.robot} />
        <h1 className={styles.title} role="status">
          {fallback ? '改用內建字庫' : 'AI 正在為你出題…'}
        </h1>
        <p className={styles.text}>
          這次要練的鍵：
          {targets.map((t) => (
            <kbd key={`${t.kind}:${t.key}`} className={styles.keycap}>
              {t.key}
            </kbd>
          ))}
          <br />
          主題：<Icon name={THEME_INFO[theme].icon} /> {THEME_INFO[theme].label}
        </p>
        {!fallback && <p className={styles.small}>通常幾秒內就好；等太久會自動改用內建字庫，不會卡住。</p>}
        <Button variant="ghost" onClick={onCancel}>
          取消，回到選單
        </Button>
      </Card>
      <MessageDialog
        open={fallback !== null}
        icon={<StickerIcon name="books" tone="yellow" />}
        title="這場先用內建字庫"
        text={fallback?.notice ?? ''}
        buttons={[
          { label: '開始特訓（Enter）', icon: 'sword', primary: true, onClick: () => fallback && onReady(fallback) },
          { label: '回到選單', onClick: onCancel },
        ]}
      />
    </main>
  )
}

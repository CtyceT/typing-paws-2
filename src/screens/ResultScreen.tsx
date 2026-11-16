import { Button, Card, HeroAvatar } from '../components/index.ts'
import { HEROES, resultComment, resultStats, resultSubtitle, resultTitle, type BattleResult, type HeroId, type NewRecordKind, type SessionMiss, type SyncStatus } from '../game/index.ts'
import styles from './ResultScreen.module.css'

export interface ResultScreenProps {
  hero: HeroId
  result: BattleResult
  /** 這一場破了什麼紀錄 */
  newRecord?: NewRecordKind
  /** 這一場最常打錯的鍵（錯最多的在前）；沒給就不顯示這一區 */
  misses?: readonly SessionMiss[]
  /** 這一場有沒有存到雲端；訪客沒有這一行 */
  sync?: SyncStatus
  /** 打開數據儀表板；沒給就不顯示按鈕 */
  onDashboard?: () => void
  onRetry: () => void
  onMenu: () => void
}

const NEW_RECORD_LABEL = { wpm: '最快 WPM', score: '最高分' } as const

/** 結算畫面：星等、六項數據、評語、新紀錄標示、本場最常打錯的鍵 */
export function ResultScreen({ hero, result, newRecord = null, misses, sync, onDashboard, onRetry, onMenu }: ResultScreenProps) {
  return (
    <main>
      <Card className={styles.result}>
        <div className={styles.mascot}>
          <HeroAvatar hero={hero} expression={result.win ? 'happy' : 'hurt'} className={styles.mascotSvg} />
        </div>
        <h1 className={styles.title}>{resultTitle(result, HEROES[hero].name)}</h1>
        <div className={styles.subtitle}>{resultSubtitle(result)}</div>
        <div className={styles.stars} role="img" aria-label={`${result.stars} 顆星（滿分 3 顆）`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={i < result.stars ? undefined : styles.off} style={{ animationDelay: `${0.15 * i + 0.1}s` }}>
              ⭐
            </span>
          ))}
        </div>
        {newRecord && <div className={styles.newRecord}>✨ 新紀錄！{NEW_RECORD_LABEL[newRecord]} ✨</div>}
        <div className={styles.statGrid}>
          {resultStats(result).map((s) => (
            <div key={s.label} className={styles.stat}>
              <div className={styles.value}>{s.value}</div>
              <div className={styles.label}>{s.label}</div>
            </div>
          ))}
        </div>
        <div className={styles.comment}>{resultComment(result)}</div>
        {misses && (
          <div className={styles.misses}>
            <div className={styles.missesTitle}>⌨️ 這場最常打錯的鍵</div>
            {misses.length > 0 ? (
              <ul className={styles.missList} aria-label="這場最常打錯的鍵">
                {misses.map((m) => (
                  <li key={m.key} className={styles.miss}>
                    <kbd className={styles.keycap}>{m.label}</kbd>
                    <span>
                      錯 {m.errors} 次<small>／{m.attempts} 次</small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.noMiss}>這場一個鍵都沒打錯 🎉</div>
            )}
          </div>
        )}
        {sync && (
          <div className={`${styles.sync} ${sync.tone === 'warn' ? styles.syncWarn : ''}`} role="status">
            {sync.text}
          </div>
        )}
        <div className={styles.buttons}>
          <Button onClick={onRetry}>🔁 再挑戰一次</Button>
          <Button variant="ghost" onClick={onMenu}>
            🏠 回到選單
          </Button>
          {onDashboard && (
            <Button variant="ghost" onClick={onDashboard}>
              📊 數據儀表板
            </Button>
          )}
        </div>
      </Card>
    </main>
  )
}

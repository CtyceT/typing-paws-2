import { Button } from '../components/index.ts'
import type { Difficulty, HeroId } from '../game/index.ts'
import styles from './BattleScreen.module.css'
import { BattleView } from './BattleView.tsx'
import { useBattleSession } from './useBattleSession.ts'

export interface BattleScreenProps {
  hero: HeroId
  difficulty: Difficulty
  onExit: () => void
}

/** 戰鬥畫面：BattleView 負責畫面，useBattleSession 負責流程 */
export function BattleScreen({ hero, difficulty, onExit }: BattleScreenProps) {
  const session = useBattleSession(difficulty)
  return (
    <main>
      <BattleView state={session.battle} hero={hero} focusLost={session.focusLost} onRequestFocus={session.focusInput}>
        {/* type=password：瀏覽器在密碼欄位會關閉中文輸入法，避免注音／拼音吃掉按鍵 */}
        <input
          {...session.inputProps}
          className={styles.hiddenInput}
          type="password"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore
          aria-label="打字輸入"
        />
      </BattleView>
      {/* 暫時的出口，暫停視窗完成後（ROADMAP 1.13）拿掉 */}
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Button variant="ghost" size="small" onClick={onExit}>
          ← 回選單
        </Button>
      </div>
    </main>
  )
}

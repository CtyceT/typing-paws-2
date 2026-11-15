import { CountdownOverlay, HeroAvatar, MessageDialog } from '../components/index.ts'
import { currentMonster, finishMessage, HEROES, introMessage, stageClearMessage, type Difficulty, type HeroId } from '../game/index.ts'
import styles from './BattleScreen.module.css'
import { BattleView } from './BattleView.tsx'
import { useBattleSession } from './useBattleSession.ts'

export interface BattleScreenProps {
  hero: HeroId
  difficulty: Difficulty
  /** 回主選單 */
  onExit: () => void
  /** 同樣的難度再打一場 */
  onRetry: () => void
}

/** 戰鬥畫面：BattleView 負責畫面，useBattleSession 負責流程，這裡把訊息視窗接上去 */
export function BattleScreen({ hero, difficulty, onExit, onRetry }: BattleScreenProps) {
  const session = useBattleSession(difficulty)
  const { battle } = session
  const heroName = HEROES[hero].name

  let dialog = null
  if (session.introOpen) {
    dialog = (
      <MessageDialog open {...introMessage(currentMonster(battle))} buttons={[{ label: '⚔️ 開打！（Enter）', primary: true, onClick: session.begin }]} />
    )
  } else if (session.pauseOpen === 'user') {
    dialog = (
      <MessageDialog
        open
        emoji="⏸"
        title="暫停中"
        text="喘口氣，準備好再繼續！"
        buttons={[
          { label: '▶ 繼續（Esc）', primary: true, onClick: session.resume },
          { label: '🏳 放棄回選單', onClick: onExit },
        ]}
      />
    )
  } else if (session.pauseOpen === 'ime') {
    dialog = (
      <MessageDialog
        open
        emoji="⌨️"
        title="好像切到中文輸入法了"
        text={'遊戲先幫你暫停 ⏸\n請按 Shift 切回英文輸入（Mac 可按 Caps Lock 或 Ctrl+Space），\n切好之後再按繼續。'}
        buttons={[{ label: '▶ 切好了，繼續', primary: true, onClick: session.resumeFromIme }]}
      />
    )
  } else if (session.stageClearOpen) {
    dialog = (
      <MessageDialog
        open
        {...stageClearMessage(battle, heroName)}
        buttons={[{ label: '⚔️ 繼續戰鬥（Enter）', primary: true, onClick: session.continueToNextStage }]}
      />
    )
  } else if (session.finishOpen) {
    // 暫時用訊息視窗顯示結果，完整的結算畫面在 ROADMAP 1.16
    const message = finishMessage(battle, heroName)
    dialog = (
      <MessageDialog
        open
        {...message}
        emoji={<HeroAvatar hero={hero} expression={battle.phase === 'won' ? 'happy' : 'hurt'} className={styles.resultAvatar} />}
        buttons={[
          { label: '🔁 再挑戰一次', primary: true, onClick: onRetry },
          { label: '🏠 回到選單', onClick: onExit },
        ]}
      />
    )
  }

  let warning = null
  if (session.warning === 'ime') {
    warning = (
      <>
        ⚠️ 偵測到中文輸入法！請按 <kbd>Shift</kbd> 切回英文（Mac 可按 <kbd>Caps Lock</kbd> 或 <kbd>Ctrl</kbd>+<kbd>Space</kbd>）
      </>
    )
  } else if (session.warning === 'capsLock') {
    warning = '🔠 Caps Lock 開著喔！字母會變成大寫，可能一直打錯'
  }

  return (
    <main>
      <BattleView state={battle} hero={hero} onPause={session.togglePause} warning={warning} focusLost={session.focusLost} onRequestFocus={session.focusInput}>
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
      {session.countdown !== null && <CountdownOverlay text={session.countdown} />}
      {dialog}
    </main>
  )
}

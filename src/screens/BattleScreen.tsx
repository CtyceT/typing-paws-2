import { useEffect, useRef } from 'react'
import { CountdownOverlay, MessageDialog } from '../components/index.ts'
import { preloadMonsterImages } from '../components/monsterImages.ts'
import { currentMonster, HEROES, introMessage, stageClearMessage, type BattleState, type Difficulty, type HeroId, type Monster } from '../game/index.ts'
import styles from './BattleScreen.module.css'
import { BattleView } from './BattleView.tsx'
import { useBattleEffects } from './useBattleEffects.ts'
import { useBattleSession } from './useBattleSession.ts'

export interface BattleScreenProps {
  hero: HeroId
  difficulty: Difficulty
  /** 這一場的題目；沒給就用這個難度的內建字庫（弱點特訓會傳 AI 出的題目進來） */
  words?: readonly string[]
  /** 這一場的三關怪物；沒給就用日常主題 */
  monsters?: readonly Monster[]
  /** 放棄，回主選單（不記錄成績） */
  onExit: () => void
  /** 整場結束（通關或被打倒），帶著結束時的戰鬥狀態 */
  onFinish: (state: BattleState) => void
}

/** 戰鬥畫面：BattleView 負責畫面，useBattleSession 負責流程，這裡把訊息視窗接上去 */
export function BattleScreen({ hero, difficulty, words, monsters, onExit, onFinish }: BattleScreenProps) {
  const session = useBattleSession(difficulty, words, monsters)
  const { battle } = session
  const effects = useBattleEffects(session.eventLog, battle.stage)
  const heroName = HEROES[hero].name

  // 進戰鬥時下載這一場三關的怪物圖（D84）
  useEffect(() => preloadMonsterImages(battle.monsters), [battle.monsters])

  // 結束的動畫播完後通知外面切到結算畫面（只通知一次）
  const reported = useRef(false)
  useEffect(() => {
    if (!session.finishOpen || reported.current) return
    reported.current = true
    onFinish(battle)
  }, [session.finishOpen, battle, onFinish])

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
      <BattleView state={battle} hero={hero} effects={effects} onPause={session.togglePause} warning={warning} focusLost={session.focusLost} onRequestFocus={session.focusInput}>
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

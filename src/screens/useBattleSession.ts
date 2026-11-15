import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  battleReducer,
  COUNTDOWN_STEPS,
  createBattle,
  DEFEAT_DELAY_MS,
  interpretKey,
  interpretText,
  STAGE_CLEAR_DELAY_MS,
  VICTORY_DELAY_MS,
  type BattlePhase,
  type Difficulty,
} from '../game/index.ts'

/** 打倒怪物或整場結束後，隔多久才跳出訊息 */
const REVEAL_DELAY_MS: Partial<Record<BattlePhase, number>> = {
  stageClear: STAGE_CLEAR_DELAY_MS,
  won: VICTORY_DELAY_MS,
  lost: DEFEAT_DELAY_MS,
}

/**
 * 一場戰鬥的流程控制：開場訊息 → 倒數 → 戰鬥 → 過關訊息 → 倒數 → … → 結束。
 * 規則都在 src/game 的純函式裡，這裡只負責計時、接瀏覽器事件、管理輸入框焦點。
 */
export function useBattleSession(difficulty: Difficulty) {
  const [battle, dispatch] = useReducer(battleReducer, difficulty, (d) => createBattle(d))
  /** 第一關的開場訊息是否還開著 */
  const [introOpen, setIntroOpen] = useState(true)
  /** 倒數中顯示的字；null 表示沒有在倒數 */
  const [countdown, setCountdown] = useState<string | null>(null)
  /** 目前這個階段（過關、通關、被打倒）的訊息是否已經到了該顯示的時間 */
  const [revealedPhase, setRevealedPhase] = useState<BattlePhase | null>(null)
  const [focusLost, setFocusLost] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const countdownTimer = useRef(0)

  const focusInput = useCallback(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  const typeChar = useCallback((char: string) => {
    dispatch({ type: 'char', char, roll: Math.random() })
  }, [])

  /** 倒數 3、2、1、GO!，結束後開始（或繼續）戰鬥 */
  const startCountdown = useCallback(() => {
    const step = (i: number) => {
      if (i >= COUNTDOWN_STEPS.length) {
        setCountdown(null)
        dispatch({ type: 'start' })
        focusInput()
        return
      }
      setCountdown(COUNTDOWN_STEPS[i].text)
      countdownTimer.current = window.setTimeout(() => step(i + 1), COUNTDOWN_STEPS[i].ms)
    }
    window.clearTimeout(countdownTimer.current)
    step(0)
  }, [focusInput])

  useEffect(() => () => window.clearTimeout(countdownTimer.current), [])

  // 進入戰鬥畫面就先把焦點放到輸入框
  useEffect(() => focusInput(), [focusInput])

  // 遊戲迴圈：每個畫面更新把經過的時間送進 reducer（暫停、倒數、訊息中 reducer 會自己忽略）
  useEffect(() => {
    let last = 0
    let id = requestAnimationFrame(function frame(ts) {
      id = requestAnimationFrame(frame)
      const dt = last ? ts - last : 0
      last = ts
      if (dt > 0) dispatch({ type: 'tick', dtMs: dt })
    })
    return () => cancelAnimationFrame(id)
  }, [])

  // 打倒怪物或整場結束：等一下再跳出訊息
  const phase = battle.phase
  useEffect(() => {
    const delay = REVEAL_DELAY_MS[phase]
    if (delay === undefined) return
    const id = window.setTimeout(() => setRevealedPhase(phase), delay)
    return () => window.clearTimeout(id)
  }, [phase])

  // 實體鍵盤：聽整個頁面的 keydown，輸入框沒有焦點時也能打
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const intent = interpretKey({
        key: e.key,
        isComposing: e.isComposing,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        capsLock: e.getModifierState?.('CapsLock'),
      })
      if (intent.type !== 'char') return
      e.preventDefault() // 避免空白鍵捲動頁面，也避免輸入框的 input 事件重複觸發
      typeChar(intent.char)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [typeChar])

  /** 手機虛擬鍵盤常常只送出 input 事件（keydown 的 key 是 Unidentified） */
  const onInput = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      if ((e.nativeEvent as InputEvent).isComposing) return // 組字中先不處理
      const input = e.currentTarget
      const { chars } = interpretText(input.value)
      input.value = ''
      chars.forEach(typeChar)
    },
    [typeChar],
  )

  /** 開場訊息按「開打」 */
  const begin = useCallback(() => {
    setIntroOpen(false)
    startCountdown()
  }, [startCountdown])

  /** 過關訊息按「繼續戰鬥」：換下一隻怪物並倒數 */
  const continueToNextStage = useCallback(() => {
    setRevealedPhase(null) // 下一關過關時要重新等一下才跳訊息
    dispatch({ type: 'nextStage', roll: Math.random() })
    startCountdown()
  }, [startCountdown])

  const finished = phase === 'won' || phase === 'lost'

  /** 給隱藏輸入框用的屬性 */
  const inputProps = {
    ref: inputRef,
    onInput,
    onBlur: () => setFocusLost(!finished),
    onFocus: () => setFocusLost(false),
  }

  return {
    battle,
    /** 是否顯示第一關的開場訊息 */
    introOpen,
    countdown,
    /** 過關訊息該顯示了 */
    stageClearOpen: phase === 'stageClear' && revealedPhase === 'stageClear',
    /** 結束訊息該顯示了 */
    finishOpen: finished && revealedPhase === phase,
    focusLost,
    focusInput,
    inputProps,
    begin,
    continueToNextStage,
  }
}

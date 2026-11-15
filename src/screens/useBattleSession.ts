import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { battleReducer, createBattle, interpretKey, interpretText, type Difficulty } from '../game/index.ts'

/**
 * 一場戰鬥的流程控制：把鍵盤輸入送進 reducer，並管理打字輸入框的焦點。
 * 規則都在 src/game 的純函式裡，這裡只負責接瀏覽器事件。
 */
export function useBattleSession(difficulty: Difficulty) {
  const [battle, dispatch] = useReducer(battleReducer, difficulty, (d) => createBattle(d))
  const [focusLost, setFocusLost] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const focusInput = useCallback(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  const typeChar = useCallback((char: string) => {
    dispatch({ type: 'char', char, roll: Math.random() })
  }, [])

  // 暫時：一進來就開始，倒數與開場訊息在 ROADMAP 1.12 加上
  useEffect(() => {
    dispatch({ type: 'start' })
    focusInput()
  }, [focusInput])

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

  /** 給隱藏輸入框用的屬性 */
  const inputProps = {
    ref: inputRef,
    onInput,
    onBlur: () => setFocusLost(battle.phase !== 'won' && battle.phase !== 'lost'),
    onFocus: () => setFocusLost(false),
  }

  return { battle, focusLost, focusInput, inputProps }
}

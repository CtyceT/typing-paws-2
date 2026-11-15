import { normalizeChar } from './input.ts'

/** 判斷按鍵需要的資訊（KeyboardEvent 的一小部分，方便測試） */
export interface KeyInput {
  key: string
  /** 輸入法正在組字 */
  isComposing?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  /** Caps Lock 是否開著 */
  capsLock?: boolean
}

/**
 * 一次按鍵在戰鬥中代表什麼：
 * - char：打了一個遊戲字元；capsLockOn 表示打的是字母而且 Caps Lock 開著（要提醒玩家）
 * - ime：偵測到中文輸入法
 * - pause：按了 Esc
 * - ignore：其他按鍵（方向鍵、Enter、快捷鍵…）
 */
export type KeyIntent =
  | { type: 'char'; char: string; capsLockOn: boolean }
  | { type: 'ime' }
  | { type: 'pause' }
  | { type: 'ignore' }

export function interpretKey(input: KeyInput): KeyIntent {
  // 輸入法組字中，瀏覽器會把 key 回報成 "Process"
  if (input.isComposing || input.key === 'Process') return { type: 'ime' }
  if (input.key === 'Escape') return { type: 'pause' }
  if (input.ctrlKey || input.metaKey || input.altKey) return { type: 'ignore' }
  // 只處理單一字元的按鍵（用展開運算算長度，避免把一個 emoji 當成兩個字元）
  if ([...input.key].length !== 1) return { type: 'ignore' }
  const char = normalizeChar(input.key)
  if (char === null) return { type: 'ime' }
  return { type: 'char', char, capsLockOn: Boolean(input.capsLock) && /[a-z]/i.test(input.key) }
}

/**
 * 把輸入框收到的文字（手機虛擬鍵盤、貼上）拆成遊戲字元。
 * ime 為 true 代表裡面有不是英文的字元（多半是中文輸入法送出來的）。
 */
export function interpretText(text: string): { chars: string[]; ime: boolean } {
  const chars: string[] = []
  let ime = false
  for (const raw of text) {
    const char = normalizeChar(raw)
    if (char === null) ime = true
    else chars.push(char)
  }
  return { chars, ime }
}

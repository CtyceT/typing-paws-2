/**
 * 全形英數與標點（U+FF01–U+FF5E）轉成半形，全形空白（U+3000）轉成一般空白。
 * 其他字元原樣回傳。只處理字串的第一個字元。
 */
export function toHalfWidth(ch: string): string {
  const code = ch.charCodeAt(0)
  if (code >= 0xff01 && code <= 0xff5e) return String.fromCharCode(code - 0xfee0)
  if (code === 0x3000) return ' '
  return ch
}

/** 是否為遊戲可輸入的單一字元：可列印 ASCII（0x20–0x7E） */
export function isTypeable(ch: string): boolean {
  return /^[\x20-\x7E]$/.test(ch)
}

/**
 * 把鍵盤或輸入框送來的一個字元正規化成遊戲字元。
 * 回傳 null 代表這不是英文輸入（多半是切到了中文輸入法），呼叫端應該提醒玩家。
 */
export function normalizeChar(raw: string): string | null {
  const ch = toHalfWidth(raw)
  return isTypeable(ch) ? ch : null
}

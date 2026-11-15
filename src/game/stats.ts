/** WPM：每 5 個正確字元算一個字，除以實際打字的分鐘數（暫停不算），四捨五入 */
export function calcWpm(correctChars: number, activeMs: number): number {
  const minutes = activeMs / 60000
  return minutes > 0 ? Math.round(correctChars / 5 / minutes) : 0
}

/** 準確率（百分比，保留一位小數）；還沒按任何鍵時是 100 */
export function calcAccuracy(correctChars: number, typedChars: number): number {
  return typedChars > 0 ? Math.round((correctChars / typedChars) * 1000) / 10 : 100
}

/**
 * 星等：失敗 0 星；通關後準確率 ≥ 95% 且剩餘血量 ≥ 50 得 3 星，
 * 準確率 ≥ 85% 得 2 星，其餘 1 星。
 */
export function calcStars(win: boolean, accuracy: number, playerHp: number): 0 | 1 | 2 | 3 {
  if (!win) return 0
  if (accuracy >= 95 && playerHp >= 50) return 3
  if (accuracy >= 85) return 2
  return 1
}

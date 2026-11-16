import { parseLegacyStore, type LegacyImport } from '../game/index.ts'
import { LEGACY_STORAGE_KEY, STORAGE_KEYS } from './keys.ts'

/**
 * 找出可以匯入的 1.0 舊紀錄。已經問過（不論匯入或略過）、沒有舊紀錄、或 localStorage 不能用時回傳 null。
 * 這是整個 2.0 唯一讀取 `typingPaws.v1` 的地方，而且只讀取，不寫入也不刪除。
 */
export function findLegacyImport(): LegacyImport | null {
  try {
    if (localStorage.getItem(STORAGE_KEYS.legacyImport) !== null) return null
    return parseLegacyStore(localStorage.getItem(LEGACY_STORAGE_KEY))
  } catch {
    return null
  }
}

/** 記下已經問過要不要匯入，之後不再詢問 */
export function markLegacyAsked(answer: 'imported' | 'skipped'): void {
  try {
    localStorage.setItem(STORAGE_KEYS.legacyImport, answer)
  } catch {
    // 忽略：存不進去的話下次開啟會再問一次
  }
}

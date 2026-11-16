import { appendSessionStats, parseKeyStats, type KeyStatRow } from '../game/index.ts'
import { scopedKey, type StorageScope } from './keys.ts'

/**
 * 按鍵統計的儲存介面。畫面只透過這個介面讀寫，不直接碰 localStorage。
 *
 * 介面是同步的：本機這一份永遠是畫面讀取的來源（local-first），遊戲不會因為網路而卡住。
 * 日後接上 Supabase（ROADMAP 3.5）時，雲端是「同步的對象」而不是取代這個介面：
 * 登入後把本機的列上傳到 key_stats 資料表、把雲端的列下載回來合併進本機。
 * 每一列都有固定的 id（場次＋種類＋鍵），所以重複上傳可以用 upsert，不會重複。
 */
export interface KeyStatsStore {
  /** 讀出所有統計列；沒有資料或資料壞掉時回傳空陣列 */
  load(): KeyStatRow[]
  /** 存一場的統計，回傳存完之後的所有列（超過保留場數時最舊的場次會被丟掉） */
  saveSession(rows: readonly KeyStatRow[]): KeyStatRow[]
  /** 整份換掉（和雲端合併之後用），回傳實際存下來的列 */
  replaceAll(rows: readonly KeyStatRow[]): KeyStatRow[]
  /** 清除所有統計 */
  clear(): void
}

/** localStorage 實作：整份存成一個 JSON 陣列。讀寫失敗（無痕模式、空間滿了）都不會丟出例外。scope 是資料屬於誰（預設訪客） */
export function createLocalKeyStatsStore(scope: StorageScope = null): KeyStatsStore {
  const key = scopedKey('keyStats', scope)
  const write = (rows: KeyStatRow[]) => {
    try {
      localStorage.setItem(key, JSON.stringify(rows))
    } catch {
      // 忽略：這次的統計只在本次瀏覽有效
    }
    return rows
  }
  return {
    load() {
      try {
        const raw = localStorage.getItem(key)
        return raw === null ? [] : parseKeyStats(JSON.parse(raw))
      } catch {
        return []
      }
    },
    saveSession(rows) {
      return write(appendSessionStats(this.load(), rows))
    },
    replaceAll(rows) {
      return write(appendSessionStats([], rows))
    },
    clear() {
      try {
        localStorage.removeItem(key)
      } catch {
        // 忽略
      }
    },
  }
}

/** 訪客的按鍵統計 */
export const localKeyStatsStore: KeyStatsStore = createLocalKeyStatsStore()

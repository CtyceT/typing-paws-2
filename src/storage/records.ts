import { EMPTY_RECORDS, parseRecords, type Records } from '../game/index.ts'
import { scopedKey, type StorageScope } from './keys.ts'

function readJson(key: string): unknown {
  const raw = localStorage.getItem(key)
  return raw === null ? null : JSON.parse(raw)
}

/** 讀取某個身分（預設是訪客）的最佳紀錄與歷史戰績；沒有資料、資料壞掉或 localStorage 不能用時回傳空紀錄（壞掉的部分會被略過） */
export function loadRecords(scope: StorageScope = null): Records {
  let best: unknown = null
  let history: unknown = null
  try {
    best = readJson(scopedKey('best', scope))
  } catch {
    // 這一份壞了就當作沒有
  }
  try {
    history = readJson(scopedKey('history', scope))
  } catch {
    // 同上
  }
  return parseRecords(best, history)
}

/** 存紀錄；存不進去（例如無痕模式或空間滿了）就算了，不影響遊戲 */
export function saveRecords(records: Records, scope: StorageScope = null): void {
  try {
    localStorage.setItem(scopedKey('best', scope), JSON.stringify(records.best))
    localStorage.setItem(scopedKey('history', scope), JSON.stringify(records.history))
  } catch {
    // 忽略：這次的紀錄只在本次瀏覽有效
  }
}

/** 清除最佳紀錄與歷史戰績（不動勇者選擇，也不動 1.0 的資料） */
export function clearRecords(scope: StorageScope = null): Records {
  try {
    localStorage.removeItem(scopedKey('best', scope))
    localStorage.removeItem(scopedKey('history', scope))
  } catch {
    // 忽略
  }
  return EMPTY_RECORDS
}

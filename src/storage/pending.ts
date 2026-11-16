import { scopedKey } from './keys.ts'

/** 讀取某個帳號「還沒上傳到雲端」的場次 id；沒有或資料壞掉時是空的 */
export function loadPending(userId: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(scopedKey('pending', userId)) ?? '[]')
    return Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string' && v !== ''))] : []
  } catch {
    return []
  }
}

/** 記下還沒上傳的場次 id；清單空了就把鍵刪掉 */
export function savePending(ids: readonly string[], userId: string): void {
  try {
    if (ids.length === 0) localStorage.removeItem(scopedKey('pending', userId))
    else localStorage.setItem(scopedKey('pending', userId), JSON.stringify(ids))
  } catch {
    // 忽略：下次登入時的完整同步會把缺的補上
  }
}

/** 勇者的選擇是不是還沒上傳 */
export function loadHeroDirty(userId: string): boolean {
  try {
    return localStorage.getItem(scopedKey('heroDirty', userId)) !== null
  } catch {
    return false
  }
}

export function saveHeroDirty(dirty: boolean, userId: string): void {
  try {
    if (dirty) localStorage.setItem(scopedKey('heroDirty', userId), '1')
    else localStorage.removeItem(scopedKey('heroDirty', userId))
  } catch {
    // 忽略
  }
}

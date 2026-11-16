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

/** 「還有變動沒上傳」的記號：hero 是勇者的選擇，best 是最佳紀錄 */
export type DirtyFlag = 'hero' | 'best'

export function loadDirty(flag: DirtyFlag, userId: string): boolean {
  try {
    return localStorage.getItem(scopedKey(`${flag}Dirty`, userId)) !== null
  } catch {
    return false
  }
}

export function saveDirty(flag: DirtyFlag, dirty: boolean, userId: string): void {
  try {
    if (dirty) localStorage.setItem(scopedKey(`${flag}Dirty`, userId), '1')
    else localStorage.removeItem(scopedKey(`${flag}Dirty`, userId))
  } catch {
    // 忽略
  }
}

/** 這個帳號上次選「先不要併入」時，訪客資料的記號；沒有拒絕過是 null */
export function loadGuestSkip(userId: string): string | null {
  try {
    return localStorage.getItem(scopedKey('guestSkip', userId))
  } catch {
    return null
  }
}

export function saveGuestSkip(marker: string, userId: string): void {
  try {
    localStorage.setItem(scopedKey('guestSkip', userId), marker)
  } catch {
    // 忽略：存不進去的話下次登入會再問一次
  }
}

/**
 * 2.0 所有 localStorage 鍵的前綴。
 * 1.0 和 2.0 在同一個網域（ctycet.github.io），localStorage 是共用的，
 * 所以 2.0 的鍵一律用這個前綴，而且不能寫入或刪除 1.0 的 `typingPaws.v1`。
 */
export const STORAGE_PREFIX = 'typingPaws2.'

export const STORAGE_KEYS = {
  /** 選中的勇者代號（字串） */
  hero: `${STORAGE_PREFIX}hero`,
  /** 各難度的最佳紀錄（BestRecords 的 JSON） */
  best: `${STORAGE_PREFIX}best`,
  /** 最近 30 場戰績（GameRecord 陣列的 JSON） */
  history: `${STORAGE_PREFIX}history`,
  /** 最近 30 場的按鍵統計（KeyStatRow 陣列的 JSON） */
  keyStats: `${STORAGE_PREFIX}keyStats`,
  /** 是否已經問過要不要匯入 1.0 的舊紀錄：'imported' 或 'skipped' */
  legacyImport: `${STORAGE_PREFIX}legacyImport`,
} as const

/**
 * 資料屬於誰：null 是訪客，其他是登入帳號的 id。
 * 訪客和每個帳號在這個瀏覽器裡各有一份自己的紀錄，互不混用（登入不會把訪客的紀錄變成帳號的，要併入得玩家自己同意）。
 */
export type StorageScope = string | null

/** 各自一份的資料：勇者、最佳紀錄、歷史戰績、按鍵統計；pending 之後的只有登入帳號才有 */
export type ScopedName = 'hero' | 'best' | 'history' | 'keyStats' | 'pending' | 'heroDirty' | 'guestSkip'

/** 某個身分的 localStorage 鍵。訪客是 `typingPaws2.<名稱>`（和階段 2 以前相同），帳號是 `typingPaws2.u.<帳號 id>.<名稱>` */
export function scopedKey(name: ScopedName, scope: StorageScope = null): string {
  return scope === null ? `${STORAGE_PREFIX}${name}` : `${STORAGE_PREFIX}u.${scope.replace(/[^A-Za-z0-9-]/g, '_')}.${name}`
}

/** 1.0 版（作業五）的紀錄。只能在「匯入舊紀錄」時讀取，絕對不能寫入或刪除 */
export const LEGACY_STORAGE_KEY = 'typingPaws.v1'

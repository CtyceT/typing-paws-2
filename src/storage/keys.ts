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

/** 1.0 版（作業五）的紀錄。只能在「匯入舊紀錄」時讀取，絕對不能寫入或刪除 */
export const LEGACY_STORAGE_KEY = 'typingPaws.v1'

/**
 * 2.0 所有 localStorage 鍵的前綴。
 * 1.0 和 2.0 在同一個網域（ctycet.github.io），localStorage 是共用的，
 * 所以 2.0 的鍵一律用這個前綴，而且不能寫入或刪除 1.0 的 `typingPaws.v1`。
 */
export const STORAGE_PREFIX = 'typingPaws2.'

export const STORAGE_KEYS = {
  /** 選中的勇者代號（字串） */
  hero: `${STORAGE_PREFIX}hero`,
} as const

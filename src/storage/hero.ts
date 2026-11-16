import { DEFAULT_HERO, toHeroId, type HeroId } from '../game/index.ts'
import { scopedKey, type StorageScope } from './keys.ts'

/** 讀取上次選的勇者；沒有紀錄、資料壞掉或 localStorage 不能用時回傳預設勇者 */
export function loadHero(scope: StorageScope = null): HeroId {
  try {
    // 帳號在這個瀏覽器還沒選過勇者時，沿用訪客選的
    return toHeroId(localStorage.getItem(scopedKey('hero', scope)) ?? localStorage.getItem(scopedKey('hero')))
  } catch {
    return DEFAULT_HERO
  }
}

/** 記住選中的勇者；存不進去（例如無痕模式）就算了，不影響遊戲 */
export function saveHero(hero: HeroId, scope: StorageScope = null): void {
  try {
    localStorage.setItem(scopedKey('hero', scope), hero)
  } catch {
    // 忽略：這次選擇只在本次瀏覽有效
  }
}

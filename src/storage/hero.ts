import { DEFAULT_HERO, toHeroId, type HeroId } from '../game/index.ts'
import { STORAGE_KEYS } from './keys.ts'

/** 讀取上次選的勇者；沒有紀錄、資料壞掉或 localStorage 不能用時回傳預設勇者 */
export function loadHero(): HeroId {
  try {
    return toHeroId(localStorage.getItem(STORAGE_KEYS.hero))
  } catch {
    return DEFAULT_HERO
  }
}

/** 記住選中的勇者；存不進去（例如無痕模式）就算了，不影響遊戲 */
export function saveHero(hero: HeroId): void {
  try {
    localStorage.setItem(STORAGE_KEYS.hero, hero)
  } catch {
    // 忽略：這次選擇只在本次瀏覽有效
  }
}

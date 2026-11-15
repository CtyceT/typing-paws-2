/** 亂數來源：回傳 [0, 1) 的數字，介面與 Math.random 相同 */
export type Rng = () => number

/** 固定種子的亂數產生器（mulberry32），同一個種子永遠產生同一串數字。測試與每日挑戰用。 */
export function createSeededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

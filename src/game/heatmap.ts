import type { KeyAggregate } from './analysis.ts'

/** 熱力圖上的鍵盤配置（美式 QWERTY），每個字串是一排，一個字元一顆鍵；最後一排是空白鍵 */
export const KEYBOARD_ROWS: readonly string[] = ['`1234567890-=', 'qwertyuiop[]\\', "asdfghjkl;'", 'zxcvbnm,./', ' ']

/** 要按 Shift 才打得出來的符號 → 它所在的那顆鍵 */
const SHIFTED: Readonly<Record<string, string>> = {
  '~': '`', '!': '1', '@': '2', '#': '3', $: '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0', _: '-', '+': '=',
  '{': '[', '}': ']', '|': '\\', ':': ';', '"': "'", '<': ',', '>': '.', '?': '/',
}

/** 某個字元在鍵盤上是哪一顆鍵（字母已經是小寫；Shift 符號併到原本的鍵） */
export function physicalKey(char: string): string {
  return SHIFTED[char] ?? char
}

/** 次數不到這個數的鍵不上色（樣本太少，錯一次就會變成很高的錯誤率） */
export const HEAT_MIN_ATTEMPTS = 5

/** 顏色分級的錯誤率門檻：<2%、<5%、<10%、<20%、≥20% 對應等級 1～5 */
export const HEAT_THRESHOLDS: readonly number[] = [0.02, 0.05, 0.1, 0.2]

/** 圖例文字，索引 0 是「資料太少」，1～5 對應顏色等級 */
export const HEAT_LEGEND: readonly string[] = ['資料太少', '低於 2%', '2–5%', '5–10%', '10–20%', '20% 以上']

/** 0：資料太少不上色；1（幾乎不會錯）～5（很常錯） */
export type HeatLevel = 0 | 1 | 2 | 3 | 4 | 5

export interface HeatKey {
  /** 這顆鍵的代表字元（小寫字母、數字或符號；空白鍵是 ' '） */
  key: string
  /** 鍵帽上顯示的字 */
  label: string
  attempts: number
  errors: number
  /** 0～1 */
  errorRate: number
  /** 平均反應時間（毫秒）；沒有資料是 null */
  avgMs: number | null
  level: HeatLevel
}

export function heatLevel(attempts: number, errorRate: number): HeatLevel {
  if (attempts < HEAT_MIN_ATTEMPTS) return 0
  return (1 + HEAT_THRESHOLDS.filter((t) => errorRate >= t).length) as HeatLevel
}

/** 把加總後的統計排到鍵盤上：回傳每一排的每一顆鍵（沒打過的鍵也會在，次數是 0） */
export function heatmapRows(aggregates: readonly KeyAggregate[]): HeatKey[][] {
  const sums = new Map<string, { attempts: number; errors: number; timedCount: number; totalMs: number }>()
  for (const a of aggregates) {
    if (a.kind !== 'char') continue
    const id = physicalKey(a.key)
    const s = sums.get(id) ?? { attempts: 0, errors: 0, timedCount: 0, totalMs: 0 }
    s.attempts += a.attempts
    s.errors += a.errors
    if (a.avgMs !== null) {
      s.timedCount += a.timedCount
      s.totalMs += a.avgMs * a.timedCount
    }
    sums.set(id, s)
  }
  return KEYBOARD_ROWS.map((row) =>
    [...row].map((key) => {
      const s = sums.get(key) ?? { attempts: 0, errors: 0, timedCount: 0, totalMs: 0 }
      const errorRate = s.attempts > 0 ? s.errors / s.attempts : 0
      return {
        key,
        label: key === ' ' ? '空白' : key.toUpperCase(),
        attempts: s.attempts,
        errors: s.errors,
        errorRate,
        avgMs: s.timedCount > 0 ? Math.round(s.totalMs / s.timedCount) : null,
        level: heatLevel(s.attempts, errorRate),
      }
    }),
  )
}

/** 錯誤率顯示成百分比：一位小數，整數不帶小數點（0.115 → "11.5%"、0.1 → "10%"） */
export function formatRate(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`
}

/** 滑鼠移到某顆鍵上時顯示的說明 */
export function heatKeyInfo(k: HeatKey): string {
  if (k.attempts === 0) return `${k.label}：還沒有資料`
  const parts = [`打了 ${k.attempts} 次`, `錯 ${k.errors} 次（${formatRate(k.errorRate)}）`]
  if (k.avgMs !== null) parts.push(`平均 ${k.avgMs} ms`)
  if (k.level === 0) parts.push('次數太少，先不上色')
  return `${k.label}：${parts.join('・')}`
}

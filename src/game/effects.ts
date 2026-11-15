import type { BattleEvent } from './battle.ts'

/** 特效出現的位置：勇者、怪物、中間的 Combo 數字 */
export type EffectTarget = 'hero' | 'monster' | 'combo'

/** 角色動畫：attack 往前衝、hit 被打到、ko 倒地（倒地後不會自己恢復） */
export type SpriteAnim = 'attack' | 'hit' | 'ko'

/** 跳出來的文字顏色：normal 白色、crit 黃色放大、ouch 紅色 */
export type FloatTone = 'normal' | 'crit' | 'ouch'

/** 會晃動或彈一下的畫面區塊：arena 整個競技場震動、word 題目左右晃、combo 數字彈一下 */
export type ShakeTarget = 'arena' | 'word' | 'combo'

/** 一個特效指令。delayMs 是事件發生後隔多久才播 */
export type EffectCommand =
  | { type: 'sprite'; target: 'hero' | 'monster'; anim: SpriteAnim; delayMs: number; durationMs: number }
  | { type: 'float'; target: EffectTarget; text: string; tone: FloatTone; delayMs: number }
  | { type: 'burst'; target: 'hero' | 'monster'; emojis: readonly string[]; count: number; delayMs: number }
  | { type: 'shake'; target: ShakeTarget; delayMs: number }

/** Combo 至少累積到這個數字，被中斷時才跳提示 */
export const COMBO_BREAK_NOTICE = 10
/** 跳出來的文字停留多久 */
export const FLOAT_MS = 1000
/** 粒子停留多久 */
export const PARTICLE_MS = 800

const ATTACK_HERO_MS = 350
const ATTACK_MONSTER_MS = 400
const HIT_MS = 400
/** 勇者出手後多久怪物才被打到 */
const HERO_IMPACT_MS = 120
/** 怪物出手後多久勇者才被打到 */
const MONSTER_IMPACT_MS = 150
/** 勇者被打倒後多久才倒地（先播完被打到的動畫） */
const HERO_KO_MS = 450

/** 把 reducer 產生的事件換成要播的特效（時間與內容照 1.0 版） */
export function effectsForEvents(events: readonly BattleEvent[]): EffectCommand[] {
  const out: EffectCommand[] = []
  const monsterDefeated = events.some((e) => e.type === 'monsterDefeated')

  for (const e of events) {
    switch (e.type) {
      case 'miss':
        out.push({ type: 'shake', target: 'word', delayMs: 0 })
        if (e.comboLost >= COMBO_BREAK_NOTICE) {
          out.push({ type: 'float', target: 'combo', text: 'Combo 中斷…', tone: 'ouch', delayMs: 0 })
        }
        break
      case 'comboMilestone':
        out.push({ type: 'shake', target: 'combo', delayMs: 0 })
        out.push({ type: 'float', target: 'combo', text: `${e.combo} COMBO!`, tone: 'crit', delayMs: 0 })
        break
      case 'wordComplete':
        out.push({ type: 'sprite', target: 'hero', anim: 'attack', delayMs: 0, durationMs: ATTACK_HERO_MS })
        // 最後一擊直接播倒地，不播被打到的動畫
        if (!monsterDefeated) {
          out.push({ type: 'sprite', target: 'monster', anim: 'hit', delayMs: HERO_IMPACT_MS, durationMs: HIT_MS })
        }
        out.push({
          type: 'float',
          target: 'monster',
          text: e.crit ? `CRIT! ${e.damage}` : `-${e.damage}`,
          tone: e.crit ? 'crit' : 'normal',
          delayMs: HERO_IMPACT_MS,
        })
        out.push({
          type: 'burst',
          target: 'monster',
          emojis: e.crit ? ['⭐', '✨', '💥', '🌟'] : ['✨', '💖', '⭐'],
          count: e.crit ? 12 : 7,
          delayMs: HERO_IMPACT_MS,
        })
        break
      case 'monsterDefeated':
        out.push({ type: 'sprite', target: 'monster', anim: 'ko', delayMs: 0, durationMs: 0 })
        out.push({ type: 'burst', target: 'monster', emojis: ['🎉', '⭐', '✨', '🌸'], count: 16, delayMs: 0 })
        break
      case 'monsterAttack':
        out.push({ type: 'sprite', target: 'monster', anim: 'attack', delayMs: 0, durationMs: ATTACK_MONSTER_MS })
        out.push({ type: 'sprite', target: 'hero', anim: 'hit', delayMs: MONSTER_IMPACT_MS, durationMs: HIT_MS })
        out.push({ type: 'float', target: 'hero', text: `-${e.damage}`, tone: 'ouch', delayMs: MONSTER_IMPACT_MS })
        out.push({ type: 'burst', target: 'hero', emojis: ['💢', '💫'], count: 5, delayMs: MONSTER_IMPACT_MS })
        out.push({ type: 'shake', target: 'arena', delayMs: MONSTER_IMPACT_MS })
        if (e.comboLost >= COMBO_BREAK_NOTICE) {
          out.push({ type: 'float', target: 'combo', text: 'Combo 被打斷！', tone: 'ouch', delayMs: MONSTER_IMPACT_MS })
        }
        break
      case 'playerDefeated':
        out.push({ type: 'sprite', target: 'hero', anim: 'ko', delayMs: HERO_KO_MS, durationMs: 0 })
        break
      case 'victory':
        break
    }
  }
  return out
}

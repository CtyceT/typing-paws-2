import { stageBonus, stageHealAmount, type BattleState } from './battle.ts'
import type { Monster } from './monsters.ts'

/** 開打前的倒數：每一步顯示的文字與停留的毫秒數 */
export const COUNTDOWN_STEPS: readonly { text: string; ms: number }[] = [
  { text: '3', ms: 650 },
  { text: '2', ms: 650 },
  { text: '1', ms: 650 },
  { text: 'GO!', ms: 500 },
]

/** 打倒怪物後，隔多久才跳出過關訊息（讓玩家先看到最後一擊） */
export const STAGE_CLEAR_DELAY_MS = 900
/** 通關後，隔多久才顯示結果 */
export const VICTORY_DELAY_MS = 1100
/** 被打倒後，隔多久才顯示結果 */
export const DEFEAT_DELAY_MS = 1300

/** 訊息視窗的文字內容（text 用 \n 換行） */
export interface FlowMessage {
  emoji: string
  title: string
  text: string
}

/** 第一關的開場訊息 */
export function introMessage(monster: Monster): FlowMessage {
  return {
    emoji: monster.emoji,
    title: `${monster.name} 出現了！`,
    text: `「${monster.line}」\n把字打完就能攻擊，小心黃色蓄力條！\n⌨️ 記得先切換成「英文」輸入法喔`,
  }
}

/** 過關訊息：獎勵分數、回血量與下一個對手。state 是剛打倒怪物（phase 為 stageClear）時的狀態 */
export function stageClearMessage(state: BattleState, heroName: string): FlowMessage {
  const bonus = stageBonus(state.stage, state.playerHp)
  const healed = Math.round(stageHealAmount(state.playerHp))
  const next = state.monsters[state.stage + 1]
  const heal = healed > 0 ? `，${heroName}恢復 ${healed} HP` : ''
  return {
    emoji: '🎉',
    title: `第 ${state.stage + 1} 關 CLEAR！`,
    text: `過關獎勵 +${bonus} 分${heal}。\n下一個對手：${next.emoji} ${next.name}\n「${next.line}」`,
  }
}

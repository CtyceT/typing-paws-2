import type { BattleState } from './battle.ts'
import { DIFFICULTIES, type Difficulty } from './difficulty.ts'
import { calcAccuracy, calcStars, calcWpm } from './stats.ts'

/** 一場戰鬥結束後的成績 */
export interface BattleResult {
  difficulty: Difficulty
  win: boolean
  wpm: number
  /** 準確率（百分比，一位小數） */
  accuracy: number
  maxCombo: number
  score: number
  /** 累計造成的傷害 */
  damage: number
  /** 實際戰鬥的毫秒數 */
  durationMs: number
  /** 打到第幾關（從 1 開始；通關是最後一關） */
  stage: number
  /** 最後一關（打倒或被打倒時）的怪物名字，結算畫面的副標題用；不存進紀錄 */
  monsterName: string
  stars: 0 | 1 | 2 | 3
}

/** 從結束時的戰鬥狀態算出成績。只在 phase 是 won 或 lost 時有意義 */
export function battleResult(state: BattleState): BattleResult {
  const win = state.phase === 'won'
  const accuracy = calcAccuracy(state.correct, state.typed)
  return {
    difficulty: state.difficulty,
    win,
    wpm: calcWpm(state.correct, state.activeMs),
    accuracy,
    maxCombo: state.maxCombo,
    score: state.score,
    damage: state.damage,
    durationMs: state.activeMs,
    stage: state.stage + 1,
    monsterName: state.monsters[state.stage].name,
    stars: calcStars(win, accuracy, state.playerHp),
  }
}

export function resultTitle(result: BattleResult, heroName: string): string {
  return result.win ? '🏆 通關成功！' : `${heroName}被打倒了…`
}

export function resultSubtitle(result: BattleResult): string {
  const label = DIFFICULTIES[result.difficulty].label
  return result.win ? `${label}模式 ・ 打倒了 ${result.monsterName}！` : `${label}模式 ・ 止步於第 ${result.stage} 關（${result.monsterName}）`
}

/** 結算畫面的六項數據，依顯示順序 */
export function resultStats(result: BattleResult): { label: string; value: string }[] {
  return [
    { label: 'WPM', value: String(result.wpm) },
    { label: '準確率', value: `${result.accuracy}%` },
    { label: '最高 Combo', value: String(result.maxCombo) },
    { label: '分數', value: String(result.score) },
    { label: '總傷害', value: String(result.damage) },
    { label: '用時', value: `${(result.durationMs / 1000).toFixed(1)}s` },
  ]
}

/** 結算評語（規則照 1.0 版，由上往下第一個符合的） */
export function resultComment(result: Pick<BattleResult, 'win' | 'accuracy' | 'wpm' | 'maxCombo'>): string {
  if (!result.win && result.accuracy < 85) return '🐾 打錯字會讓怪物蓄力變快，先求穩再求快，準確率拉到 90% 以上會輕鬆很多喔！'
  if (!result.win) return '🐾 差一點點！記得打完一個字可以把怪物蓄力推回去，連續打字不要停下來。'
  if (result.wpm >= 70) return '🚀 手速驚人！你已經是鍵盤上的忍者喵了，試試更高難度吧！'
  if (result.maxCombo >= 40) return '🔥 Combo 大師！維持三倍傷害的感覺很爽對吧～'
  if (result.accuracy >= 97) return '🎯 幾乎零失誤！穩定度滿分，接下來可以試著再快一點。'
  return '🌟 順利通關！多玩幾次，看看你的 WPM 走勢會不會一路往上～'
}

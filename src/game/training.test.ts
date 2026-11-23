import { describe, expect, it } from 'vitest'
import type { KeyAggregate } from './analysis.ts'
import { builtinTrainingWords, planTraining, trainingFeedback, trainingFeedbackText } from './training.ts'
import { WORDS } from './words.ts'

const agg = (key: string, attempts: number, errors: number, avgMs: number | null = 200): KeyAggregate => ({
  kind: key.length === 2 ? 'bigram' : 'char',
  key,
  attempts,
  errors,
  errorRate: attempts > 0 ? errors / attempts : 0,
  timedCount: avgMs === null ? 0 : attempts,
  avgMs,
})

describe('planTraining', () => {
  it('資料不足時不出題', () => {
    expect(planTraining([agg('a', 30, 10)], 'normal')).toEqual({ status: 'insufficient', totalAttempts: 30, needed: 100 })
    expect(planTraining([], 'easy')).toMatchObject({ status: 'insufficient', totalAttempts: 0 })
  })

  it('有弱點：挑最弱的 3 個（字母與組合都可以）', () => {
    const data = [agg('e', 100, 2), agg('q', 20, 8), agg('z', 20, 6), agg('th', 20, 5), agg('x', 20, 3), agg('a', 100, 1)]
    const plan = planTraining(data, 'normal')
    expect(plan).toMatchObject({ status: 'ready', relative: false })
    if (plan.status !== 'ready') throw new Error()
    expect(plan.targets.map((t) => t.key)).toEqual(['q', 'z', 'th'])
    expect(plan.targets[0]).toEqual({ kind: 'char', key: 'q', errorRate: 0.4, attempts: 20 })
  })

  it('弱點少於 3 個時只練真的弱的，不硬湊', () => {
    const plan = planTraining([agg('e', 150, 2), agg('q', 20, 8), agg('a', 100, 1)], 'easy')
    expect(plan.status === 'ready' && plan.targets.map((t) => t.key)).toEqual(['q'])
  })

  it('數字與符號的弱點只有困難難度會練', () => {
    const data = [agg('e', 150, 2), agg(';', 20, 10), agg('4', 20, 9), agg('q', 20, 4)]
    const normal = planTraining(data, 'normal')
    const hard = planTraining(data, 'hard')
    expect(normal.status === 'ready' && normal.targets.map((t) => t.key)).toEqual(['q'])
    expect(hard.status === 'ready' && hard.targets.map((t) => t.key)).toEqual([';', '4', 'q'])
  })

  it('沒有明顯的弱點：改練相對最弱的 3 個', () => {
    const plan = planTraining([agg('e', 100, 1), agg('a', 100, 5), agg('s', 100, 3), agg('t', 100, 4), agg('o', 100, 0)], 'normal')
    expect(plan).toMatchObject({ status: 'ready', relative: true })
    expect(plan.status === 'ready' && plan.targets.map((t) => t.key)).toEqual(['a', 't', 's'])
  })

  it('空白鍵和樣本太少的鍵不會被選中', () => {
    const plan = planTraining([agg(' ', 100, 50), agg('q', 3, 3), agg('e', 150, 20)], 'hard')
    expect(plan.status === 'ready' && plan.targets.map((t) => t.key)).toEqual(['e'])
  })
})

describe('builtinTrainingWords', () => {
  it('含弱點鍵的字夠多時只用它們', () => {
    const words = builtinTrainingWords('normal', ['e', 'r'])
    expect(words.length).toBeGreaterThanOrEqual(10)
    expect(words.every((w) => /[er]/.test(w))).toBe(true)
    expect(words.length).toBeLessThan(WORDS.normal.length)
  })

  it('不夠多時用整個字庫', () => {
    expect(builtinTrainingWords('easy', ['q', 'z'])).toBe(WORDS.easy)
  })

  it('不分大小寫', () => {
    expect(builtinTrainingWords('hard', ['j', 'g', 'h'])).toContain('JavaScript')
  })
})

describe('trainingFeedback', () => {
  const targets = [
    { kind: 'char', key: 'q' },
    { kind: 'bigram', key: 'th' },
    { kind: 'char', key: 'z' },
    { kind: 'char', key: 'x' },
    { kind: 'char', key: 'e' },
  ] as const
  const session = [
    { kind: 'char', key: 'q', attempts: 25, errors: 3 },
    { kind: 'bigram', key: 'th', attempts: 10, errors: 4 },
    { kind: 'char', key: 'x', attempts: 5, errors: 1 },
    { kind: 'char', key: 'e', attempts: 200, errors: 21 },
  ] as const
  const before = [agg('q', 20, 8), agg('th', 20, 5), agg('z', 20, 6), agg('e', 100, 10)]
  const rows = trainingFeedback(targets, session, before)

  it('比較這一場和之前平均的錯誤率', () => {
    expect(rows[0]).toEqual({ kind: 'char', key: 'q', attempts: 25, errors: 3, rate: 0.12, beforeRate: 0.4, change: 'better' })
    expect(rows[1]).toMatchObject({ key: 'th', rate: 0.4, beforeRate: 0.25, change: 'worse' })
  })

  it('這場沒打到、之前沒有資料、差不多 各有標示', () => {
    expect(rows[2]).toMatchObject({ key: 'z', attempts: 0, rate: null, change: 'none' })
    expect(rows[3]).toMatchObject({ key: 'x', beforeRate: null, change: 'new' })
    expect(rows[4]).toMatchObject({ key: 'e', change: 'same' })
  })

  it('顯示文字', () => {
    expect(trainingFeedbackText(rows[0])).toEqual({ now: '這場錯誤率 12%（打 25 次、錯 3 次）', before: '之前平均 40%', change: '進步 28%', changeIcon: 'trendDown' })
    expect(trainingFeedbackText(rows[1]).change).toBe('多錯 15%')
    expect(trainingFeedbackText(rows[2])).toEqual({ now: '這場沒有打到', before: '之前平均 30%', change: '—', changeIcon: null })
    expect(trainingFeedbackText(rows[3])).toMatchObject({ before: '之前沒有資料', change: '第一次統計', changeIcon: 'sparkle' })
    expect(trainingFeedbackText(rows[4]).change).toBe('差不多')
  })
})

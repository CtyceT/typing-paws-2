import { afterEach, describe, expect, it, vi } from 'vitest'
import { TrainingApiError, type TrainingApi } from '../cloud/index.ts'
import { WORDS, type TrainingRequest } from '../game/index.ts'
import { fakeTraining } from '../test/fakeCloud.ts'
import { loadTrainingWords, TRAINING_TIMEOUT_MS } from './loadTrainingWords.ts'

const request: TrainingRequest = { difficulty: 'normal', theme: 'space', weaknesses: ['q', 'th', 'z'] }
const GOOD = ['quartz', 'zipper', 'thrust', 'liquid', 'zodiac', 'thermal', 'quiet', 'zebra', 'theory', 'quest', 'frozen', 'earth', 'equal', 'dozen', 'months']

afterEach(() => vi.useRealTimers())

describe('前端出題服務', () => {
  it('成功：回傳 AI 的題目與剩餘次數，沒有提示', async () => {
    const training = fakeTraining(GOOD)
    expect(await loadTrainingWords(training.api, request)).toEqual({ words: GOOD, source: 'ai', notice: null, remaining: 9 })
    expect(training.requests).toEqual([request])
  })

  it('題庫快取的題目標示為 cache', async () => {
    const training = fakeTraining(GOOD)
    training.source = 'cache'
    expect((await loadTrainingWords(training.api, request)).source).toBe('cache')
  })

  it('前端會再驗證一次：不合格的題目被丟掉，剩下太少就退回內建字庫', async () => {
    const some = fakeTraining([...GOOD, '中文', 'planet', '<script>'])
    expect((await loadTrainingWords(some.api, request)).words).toEqual(GOOD)
    const bad = fakeTraining(['中文', 'planet', 'quartz'])
    const result = await loadTrainingWords(bad.api, request)
    expect(result.source).toBe('builtin')
    expect(result.notice).toContain('沒有通過檢查')
  })

  it('回應的形狀不對也退回內建字庫', async () => {
    for (const body of [null, 'oops', { items: 'quartz' }, {}]) {
      const api: TrainingApi = { requestWords: async () => body }
      expect((await loadTrainingWords(api, request)).source).toBe('builtin')
    }
  })

  it.each([
    ['daily_limit', '次數用完了', 0],
    ['generation_failed', '沒有出題成功', null],
    ['unavailable', '暫時連不上', null],
    ['unauthorized', '重新登入', null],
    ['offline', '確認網路', null],
  ] as const)('Function 回錯（%s）：退回內建字庫並顯示提示', async (code, text, remaining) => {
    const training = fakeTraining(GOOD)
    training.fail = code
    const result = await loadTrainingWords(training.api, request)
    expect(result.source).toBe('builtin')
    expect(result.notice).toContain(text)
    expect(result.notice).toContain('內建字庫')
    expect(result.remaining).toBe(remaining)
    expect(result.words.length).toBeGreaterThan(0)
  })

  it('內建字庫會挑含弱點鍵的字；不夠多時用整個字庫', async () => {
    const training = fakeTraining()
    training.fail = 'offline'
    const er = await loadTrainingWords(training.api, { difficulty: 'normal', theme: 'daily', weaknesses: ['e', 'r'] })
    expect(er.words.every((w) => /[er]/.test(w))).toBe(true)
    expect((await loadTrainingWords(training.api, request)).words).toBe(WORDS.normal)
  })

  it('沒有雲端功能、或丟出看不懂的例外，都不會讓遊戲卡住', async () => {
    expect((await loadTrainingWords(null, request)).source).toBe('builtin')
    const broken: TrainingApi = { requestWords: () => Promise.reject(new Error('boom')) }
    expect((await loadTrainingWords(broken, request)).source).toBe('builtin')
    const thrower: TrainingApi = { requestWords: () => Promise.reject(new TrainingApiError('bad_request')) }
    expect((await loadTrainingWords(thrower, request)).notice).toContain('內建字庫')
  })

  it('逾時：等超過時限就退回內建字庫', async () => {
    vi.useFakeTimers()
    const training = fakeTraining(GOOD)
    training.hang = true
    const pending = loadTrainingWords(training.api, request)
    await vi.advanceTimersByTimeAsync(TRAINING_TIMEOUT_MS - 1)
    let done = false
    void pending.then(() => (done = true))
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    const result = await pending
    expect(result.source).toBe('builtin')
    expect(result.notice).toContain('等太久')
  })

  it('玩家取消時馬上結束', async () => {
    const training = fakeTraining(GOOD)
    training.hang = true
    const controller = new AbortController()
    const pending = loadTrainingWords(training.api, request, { signal: controller.signal })
    controller.abort()
    expect((await pending).source).toBe('builtin')
  })
})

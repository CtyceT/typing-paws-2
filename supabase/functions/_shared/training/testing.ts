// 測試用的假實作：假的 LLM 供應商和存在記憶體裡的假後端（行為照 migration 裡的函式）。
import type { Backend, CacheEntry, UsageResult } from './backend.ts'
import type { LlmProvider, ProviderName, ProviderResult } from './providers.ts'
import type { TrainingRequest } from './request.ts'

/** 15 個合格的普通難度單字（都含 q、z 或 th） */
export const GOOD_NORMAL = ['quartz', 'zipper', 'thrust', 'liquid', 'zodiac', 'thermal', 'quiet', 'zebra', 'theory', 'quest', 'frozen', 'earth', 'equal', 'dozen', 'months']
export const NORMAL_REQUEST: TrainingRequest = { difficulty: 'normal', theme: 'space', weaknesses: ['q', 'th', 'z'] }

/** 假的供應商：照順序回傳事先準備好的結果（用完之後重複最後一個），並記下被呼叫幾次 */
export function fakeProvider(name: ProviderName, ...results: (ProviderResult | string[])[]) {
  const provider: LlmProvider & { calls: number } = {
    name,
    model: `${name}-test`,
    calls: 0,
    async call() {
      const r = results[Math.min(provider.calls, results.length - 1)]
      provider.calls += 1
      return Array.isArray(r) ? { ok: true, text: JSON.stringify({ items: r }) } : r
    },
  }
  return provider
}

export interface FakeUsageRow {
  id: number
  userId: string
  feature: string
  day: string
  request: TrainingRequest
  source: string
  counted: boolean
  result: UsageResult | null
}

export function fakeBackend(users: Record<string, string> = { 'token-alice': 'alice', 'token-bob': 'bob' }) {
  const cache = new Map<string, CacheEntry & { expiresAt: number }>()
  const usage: FakeUsageRow[] = []
  const state = {
    now: Date.UTC(2026, 10, 16, 4, 0, 0),
    /** 設成 true 之後對應的請求會失敗 */
    failAuth: false,
    failCache: false,
    failUsage: false,
    cache,
    usage,
    /** 以台灣時間算的日期 */
    day: () => new Date(state.now + 8 * 3600_000).toISOString().slice(0, 10),
    used: (userId: string) => usage.filter((u) => u.userId === userId && u.day === state.day() && u.counted).length,
  }
  const backend: Backend = {
    async getUserId(token) {
      if (state.failAuth) throw new Error('auth down')
      return users[token] ?? null
    },
    async cacheGet(key) {
      if (state.failCache) throw new Error('db down')
      const e = cache.get(key)
      return e && e.expiresAt > state.now ? { items: e.items, model: e.model } : null
    },
    async cachePut(entry) {
      if (state.failCache) throw new Error('db down')
      cache.set(entry.key, { ...entry, expiresAt: state.now + entry.ttlHours * 3600_000 })
    },
    async usageBegin(userId, feature, limit, request) {
      if (state.failUsage) throw new Error('db down')
      const used = state.used(userId)
      if (used >= limit) return { allowed: false, id: null, used }
      const id = usage.length + 1
      usage.push({ id, userId, feature, day: state.day(), request, source: 'pending', counted: true, result: null })
      return { allowed: true, id, used: used + 1 }
    },
    async usageFinish(id, result) {
      if (state.failUsage) throw new Error('db down')
      const row = usage.find((u) => u.id === id)
      if (row) Object.assign(row, { source: result.source, counted: result.counted, result })
    },
    async usageCacheHit(userId, feature, request, result) {
      if (state.failUsage) throw new Error('db down')
      usage.push({ id: usage.length + 1, userId, feature, day: state.day(), request, source: 'cache', counted: false, result })
      return state.used(userId)
    },
  }
  return { backend, state }
}

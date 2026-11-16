// Edge Function 用到的 Supabase 功能（驗證登入身分、用量紀錄、題庫快取）。
// 用 fetch 直接打 Supabase 的 REST API，所以不需要在 Edge Function 裡安裝 supabase-js，也能在 Vitest 裡用假的 fetch 測試。
import type { TrainingRequest } from './request.ts'

/** 寫進 ai_usage 的結果欄位 */
export interface UsageResult {
  source: 'cache' | 'gemini' | 'groq' | 'failed'
  /** 是否計入每日上限：快取命中和生成失敗都不計 */
  counted: boolean
  prompt_version: string
  model: string | null
  latency_ms: number | null
  raw_count: number | null
  valid_count: number | null
  reject_reason: string | null
  attempts: unknown[]
}

export interface CacheEntry {
  key: string
  promptVersion: string
  request: TrainingRequest
  items: string[]
  provider: string
  model: string
  ttlHours: number
}

export interface Backend {
  /** 用登入後的 JWT 查出使用者 id；無效或過期回傳 null */
  getUserId(token: string): Promise<string | null>
  /** 24 小時內的快取；沒有回傳 null */
  cacheGet(key: string): Promise<{ items: unknown; model: string | null } | null>
  cachePut(entry: CacheEntry): Promise<void>
  /** 檢查今天的次數並先佔一次（同一位使用者同時送很多請求也不會超過上限） */
  usageBegin(userId: string, feature: string, limit: number, request: TrainingRequest): Promise<{ allowed: boolean; id: number | null; used: number }>
  usageFinish(id: number, result: UsageResult): Promise<void>
  /** 記一筆快取命中（不計入上限），回傳今天已經用掉的次數 */
  usageCacheHit(userId: string, feature: string, request: TrainingRequest, result: UsageResult): Promise<number>
}

/** 每個資料庫請求最多等這麼久 */
const DB_TIMEOUT_MS = 5000

/**
 * 用 Supabase 專案的網址與 service role key 實作。
 * service role key 由 Supabase 自動提供給 Edge Function（SUPABASE_SERVICE_ROLE_KEY），不會出現在前端或版控裡。
 */
export function supabaseBackend(url: string, serviceKey: string, fetchFn: typeof fetch = fetch): Backend {
  const base = url.replace(/\/+$/, '')
  const rpc = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
    const response = await fetchFn(`${base}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(DB_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`rpc ${name} failed: ${response.status}`)
    const text = await response.text()
    return (text === '' ? null : JSON.parse(text)) as T
  }
  return {
    async getUserId(token) {
      const response = await fetchFn(`${base}/auth/v1/user`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(DB_TIMEOUT_MS),
      })
      if (response.status === 401 || response.status === 403) return null
      if (!response.ok) throw new Error(`auth failed: ${response.status}`)
      const id = ((await response.json()) as { id?: unknown } | null)?.id
      return typeof id === 'string' && id !== '' ? id : null
    },
    async cacheGet(key) {
      const row = await rpc<{ items?: unknown; model?: unknown } | null>('training_cache_get', { p_key: key })
      return row && row.items !== undefined ? { items: row.items, model: typeof row.model === 'string' ? row.model : null } : null
    },
    async cachePut(e) {
      await rpc('training_cache_put', {
        p_key: e.key,
        p_prompt_version: e.promptVersion,
        p_difficulty: e.request.difficulty,
        p_theme: e.request.theme,
        p_weaknesses: e.request.weaknesses,
        p_items: e.items,
        p_provider: e.provider,
        p_model: e.model,
        p_ttl_hours: e.ttlHours,
      })
    },
    async usageBegin(userId, feature, limit, request) {
      const r = await rpc<{ allowed?: unknown; id?: unknown; used?: unknown }>('ai_usage_begin', { p_user: userId, p_feature: feature, p_limit: limit, p_request: request })
      return { allowed: r?.allowed === true, id: typeof r?.id === 'number' ? r.id : null, used: typeof r?.used === 'number' ? r.used : limit }
    },
    async usageFinish(id, result) {
      await rpc('ai_usage_finish', { p_id: id, p_result: result })
    },
    async usageCacheHit(userId, feature, request, result) {
      const used = await rpc<unknown>('ai_usage_cache_hit', { p_user: userId, p_feature: feature, p_request: request, p_result: result })
      return typeof used === 'number' ? used : 0
    },
  }
}

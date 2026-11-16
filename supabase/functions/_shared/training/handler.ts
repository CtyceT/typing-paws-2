// 弱點特訓 Edge Function 的處理流程（ROADMAP 4.2、4.3、4.6、4.7）。
// 這裡不碰 Deno 的 API：資料庫與 LLM 都從外面傳進來，所以整個流程可以在 Vitest 裡用假的實作測試。
import type { Backend, UsageResult } from './backend.ts'
import { generateTraining, type GenerateOptions } from './generate.ts'
import { CURRENT_PROMPT_VERSION } from './prompts/index.ts'
import type { LlmProvider } from './providers.ts'
import { MIN_ITEMS, parseTrainingRequest, trainingCacheKey } from './request.ts'
import { shuffled, validateItems } from './validate.ts'

/** 每位使用者每天可以請 AI 生成幾次（所有 AI 功能合計；快取命中與生成失敗不算） */
export const DAILY_LIMIT = 10
/** 題庫快取保留多久 */
export const CACHE_TTL_HOURS = 24
/** 用量紀錄裡的功能名稱 */
export const TRAINING_FEATURE = 'training'

/** 允許呼叫的網站：線上版與本機開發 */
export const DEFAULT_ALLOWED_ORIGINS: readonly string[] = [
  'https://ctycet.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]

export type TrainingErrorCode = 'bad_request' | 'unauthorized' | 'daily_limit' | 'generation_failed' | 'unavailable' | 'method_not_allowed'

const MESSAGES: Readonly<Record<TrainingErrorCode, string>> = {
  bad_request: '請求的內容不正確。',
  unauthorized: '登入後即可使用 AI 出題。',
  daily_limit: '今天的 AI 出題次數用完了，明天再來！',
  generation_failed: 'AI 這次沒有出題成功，先用內建字庫練習。',
  unavailable: 'AI 出題服務暫時連不上，先用內建字庫練習。',
  method_not_allowed: '只接受 POST。',
}

export interface HandlerDeps {
  backend: Backend
  /** 依嘗試的順序：Gemini、Groq */
  providers: readonly LlmProvider[]
  allowedOrigins?: readonly string[]
  dailyLimit?: number
  rng?: () => number
  generate?: GenerateOptions
}

export function createTrainingHandler(deps: HandlerDeps): (request: Request) => Promise<Response> {
  const { backend, providers } = deps
  const origins = deps.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS
  const limit = deps.dailyLimit ?? DAILY_LIMIT

  return async (request) => {
    const origin = request.headers.get('Origin')
    const cors: Record<string, string> = {
      Vary: 'Origin',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      ...(origin && origins.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    }
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } })
    const fail = (status: number, code: TrainingErrorCode, extra: Record<string, unknown> = {}) => json(status, { error: { code, message: MESSAGES[code] }, ...extra })

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (request.method !== 'POST') return fail(405, 'method_not_allowed')

    // 1. 身分：一定要是登入的使用者（訪客在這裡就被擋掉）
    const token = /^Bearer\s+(.+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1]?.trim()
    if (!token) return fail(401, 'unauthorized')
    let userId: string | null
    try {
      userId = await backend.getUserId(token)
    } catch {
      return fail(503, 'unavailable')
    }
    if (!userId) return fail(401, 'unauthorized')

    // 2. 參數：只接受固定的選項，沒有任何自由輸入的文字會進到 prompt
    const req = parseTrainingRequest(await request.json().catch(() => null))
    if (!req) return fail(400, 'bad_request')

    const promptVersion = deps.generate?.promptVersion ?? CURRENT_PROMPT_VERSION
    const cacheKey = trainingCacheKey(req, promptVersion)
    const base: UsageResult = { source: 'cache', counted: false, prompt_version: promptVersion, model: null, latency_ms: null, raw_count: null, valid_count: null, reject_reason: null, attempts: [] }

    // 3. 快取：24 小時內相同的弱點組合＋難度＋主題直接重複使用，不扣次數、不呼叫 LLM
    try {
      const cached = await backend.cacheGet(cacheKey)
      // 快取的內容也再驗一次，壞掉的當作沒有
      const valid = cached && Array.isArray(cached.items) ? validateItems(cached.items, req) : null
      if (valid?.ok) {
        const used = await backend
          .usageCacheHit(userId, TRAINING_FEATURE, req, { ...base, model: cached?.model ?? null, valid_count: valid.validCount })
          .catch(() => null)
        // 順序打亂再回傳，同一位玩家重複練才不會每次都一樣
        return json(200, { items: shuffled(valid.items, deps.rng), source: 'cache', limit, remaining: used === null ? null : Math.max(0, limit - used) })
      }
    } catch {
      // 快取讀不到：當作沒有快取，繼續生成
    }

    // 4. 每日上限：先佔一次，失敗再退還
    let usage: { allowed: boolean; id: number | null; used: number }
    try {
      usage = await backend.usageBegin(userId, TRAINING_FEATURE, limit, req)
    } catch {
      // 沒辦法確認用量時不呼叫 LLM（寧可退回內建字庫，也不要讓額度失去控制）
      return fail(503, 'unavailable')
    }
    if (!usage.allowed || usage.id === null) return fail(429, 'daily_limit', { limit, remaining: 0 })

    // 5. 生成：Gemini → Groq，各自驗證
    const result = providers.length > 0 ? await generateTraining(req, providers, deps.generate) : { ok: false, items: [], provider: null, model: null, promptVersion, latencyMs: 0, attempts: [] }
    const last = result.attempts.at(-1)
    const finish: UsageResult = {
      source: result.ok && result.provider ? result.provider : 'failed',
      counted: result.ok,
      prompt_version: promptVersion,
      model: result.model ?? last?.model ?? null,
      latency_ms: result.latencyMs,
      raw_count: last?.raw_count ?? null,
      valid_count: last?.valid_count ?? null,
      reject_reason: last?.reason ?? (providers.length === 0 ? 'no_provider' : null),
      // detail 是供應商的原始錯誤內容，不存進資料庫
      attempts: result.attempts.map((a) => ({ ...a, detail: undefined })),
    }
    if (result.ok && result.provider && result.model) {
      await backend
        .cachePut({ key: cacheKey, promptVersion, request: req, items: result.items, provider: result.provider, model: result.model, ttlHours: CACHE_TTL_HOURS })
        .catch(() => {})
    }
    // 紀錄寫不進去不影響玩家拿到題目；失敗時這一筆會維持「已佔用」，等於沒有退還（偏保守）
    await backend.usageFinish(usage.id, finish).catch(() => {})
    if (!result.ok) return fail(502, 'generation_failed', { limit, remaining: Math.max(0, limit - usage.used + 1) })
    return json(200, { items: result.items, source: result.provider, limit, remaining: Math.max(0, limit - usage.used) })
  }
}

/** 給前端驗證回應用：至少要有幾題 */
export { MIN_ITEMS }

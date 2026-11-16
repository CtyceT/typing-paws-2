import type { SupabaseClient } from '@supabase/supabase-js'
import type { TrainingRequest } from '../game/index.ts'

/** Edge Function 回報的錯誤代號；offline 是連不上、逾時或回應看不懂 */
export type TrainingApiErrorCode = 'bad_request' | 'unauthorized' | 'daily_limit' | 'generation_failed' | 'unavailable' | 'offline'

const KNOWN_CODES: readonly string[] = ['bad_request', 'unauthorized', 'daily_limit', 'generation_failed', 'unavailable']

export class TrainingApiError extends Error {
  code: TrainingApiErrorCode
  constructor(code: TrainingApiErrorCode) {
    super(code)
    this.name = 'TrainingApiError'
    this.code = code
  }
}

/**
 * AI 出題的入口：呼叫 Edge Function `training-words`（LLM 的金鑰只在那裡，前端永遠碰不到）。
 * 成功回傳 Edge Function 的 JSON（還沒驗證過，呼叫的人要自己驗）；失敗丟出 TrainingApiError。
 */
export interface TrainingApi {
  requestWords(request: TrainingRequest, signal?: AbortSignal): Promise<unknown>
}

/** 把 Edge Function 的錯誤回應整理成代號 */
export function toTrainingErrorCode(body: unknown): TrainingApiErrorCode {
  const code = (body as { error?: { code?: unknown } } | null)?.error?.code
  return typeof code === 'string' && KNOWN_CODES.includes(code) ? (code as TrainingApiErrorCode) : 'offline'
}

/** 用 Supabase 的 functions.invoke 實作：會自動帶上登入者的 JWT */
export function createSupabaseTraining(client: SupabaseClient): TrainingApi {
  return {
    async requestWords(request, signal) {
      const { data, error } = await client.functions.invoke('training-words', { body: request, signal })
      if (!error) return data
      // HTTP 錯誤時，回應本體放在 error.context（一個 Response）
      const context = (error as { context?: unknown }).context
      if (context instanceof Response) {
        throw new TrainingApiError(toTrainingErrorCode(await context.json().catch(() => null)))
      }
      throw new TrainingApiError('offline')
    },
  }
}

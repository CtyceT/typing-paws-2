import { TrainingApiError, type TrainingApi, type TrainingApiErrorCode } from '../cloud/training.ts'
import { builtinTrainingWords, TRAINING_DAILY_LIMIT, validateItems, type TrainingRequest } from '../game/index.ts'

/** 等 Edge Function 最多這麼久（它自己最多花 8 秒 × 兩家 LLM） */
export const TRAINING_TIMEOUT_MS = 20000

/** 這場特訓要用的題目 */
export interface TrainingWords {
  words: readonly string[]
  /** ai：剛生成的；cache：題庫快取；builtin：AI 沒有成功，改用內建字庫 */
  source: 'ai' | 'cache' | 'builtin'
  /** 退回內建字庫時要給玩家看的說明；AI 成功時是 null */
  notice: string | null
  /** 今天還可以生成幾次；不知道是 null */
  remaining: number | null
}

const FALLBACK = '這場先用內建字庫，已經挑出含弱點鍵的字。'

const NOTICES: Readonly<Record<TrainingApiErrorCode | 'invalid' | 'timeout', string>> = {
  daily_limit: `今天的 AI 出題次數用完了（每天 ${TRAINING_DAILY_LIMIT} 次），明天會恢復。\n${FALLBACK}`,
  unauthorized: `登入狀態過期了，重新登入後就能使用 AI 出題。\n${FALLBACK}`,
  generation_failed: `AI 這次沒有出題成功。\n${FALLBACK}`,
  unavailable: `AI 出題服務暫時連不上。\n${FALLBACK}`,
  bad_request: `AI 出題沒有成功。\n${FALLBACK}`,
  offline: `連不上 AI 出題服務，請確認網路。\n${FALLBACK}`,
  invalid: `AI 出的題目沒有通過檢查。\n${FALLBACK}`,
  timeout: `AI 出題等太久了。\n${FALLBACK}`,
}

export interface LoadTrainingOptions {
  timeoutMs?: number
  /** 玩家按了取消 */
  signal?: AbortSignal
}

/**
 * 前端出題服務（ROADMAP 4.8）：向 Edge Function 要題目並再驗證一次。
 * 任何失敗（沒有雲端功能、斷網、逾時、次數用完、題目不合格）都退回內建字庫並附上說明，永遠不會丟出例外，
 * 所以遊戲不會因為 AI 失敗而卡住。
 */
export async function loadTrainingWords(api: TrainingApi | null, request: TrainingRequest, options: LoadTrainingOptions = {}): Promise<TrainingWords> {
  const builtin = (reason: keyof typeof NOTICES, remaining: number | null = null): TrainingWords => ({
    words: builtinTrainingWords(request.difficulty, request.weaknesses),
    source: 'builtin',
    notice: NOTICES[reason],
    remaining,
  })
  if (!api) return builtin('offline')

  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal?.addEventListener('abort', abort)
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, options.timeoutMs ?? TRAINING_TIMEOUT_MS)
  try {
    // 有些實作不理會 signal，所以另外用 Promise.race 保證一定會在時限內結束
    const aborted = new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new TrainingApiError('offline'))))
    const body = (await Promise.race([api.requestWords(request, controller.signal), aborted])) as { items?: unknown; source?: unknown; remaining?: unknown } | null
    const checked = Array.isArray(body?.items) ? validateItems(body.items, request) : null
    if (!checked?.ok) return builtin('invalid')
    const remaining = typeof body?.remaining === 'number' && body.remaining >= 0 ? body.remaining : null
    return { words: checked.items, source: body?.source === 'cache' ? 'cache' : 'ai', notice: null, remaining }
  } catch (error) {
    if (timedOut) return builtin('timeout')
    return builtin(error instanceof TrainingApiError ? error.code : 'offline', error instanceof TrainingApiError && error.code === 'daily_limit' ? 0 : null)
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', abort)
  }
}

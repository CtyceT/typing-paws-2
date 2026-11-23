// 生成題目（ROADMAP 4.6）：依序試每個供應商（Groq → Gemini），第一個通過驗證的就用；每一次嘗試都留下紀錄。
import { buildTrainingPrompt, CURRENT_PROMPT_VERSION } from './prompts/index.ts'
import type { LlmProvider, ProviderName } from './providers.ts'
import type { TrainingRequest } from './request.ts'
import { isCommonWord } from './common.ts'
import { validateTrainingOutput, type RejectReason, type ValidateOptions } from './validate.ts'

/** 線上的驗證規則：基本檢查加上常用字檢查 */
export const SERVER_VALIDATION: ValidateOptions = { isCommonWord }

/** 每個供應商最多等這麼久 */
export const PROVIDER_TIMEOUT_MS = 8000

/** 對一個供應商的一次嘗試（存進 ai_usage.attempts，期末報告用來算合格率與延遲） */
export interface Attempt {
  provider: ProviderName
  model: string
  ok: boolean
  latency_ms: number
  /** LLM 給了幾題；呼叫失敗時是 0 */
  raw_count: number
  valid_count: number
  /** 主要的不合格原因：呼叫失敗的代號（http_429、timeout…）或題目被丟掉最多的原因（length、missing_target…） */
  reason: string | null
  rejects: Partial<Record<RejectReason, number>>
  /** 供應商回傳的錯誤內容（只在本機腳本顯示，寫進資料庫前會拿掉） */
  detail?: string
  /** 被判為冷僻字的字（評估腳本用來檢查誤殺，寫進資料庫前會拿掉） */
  rare_words?: string[]
}

export interface GenerateResult {
  ok: boolean
  items: string[]
  /** 成功的那一家；都失敗是 null */
  provider: ProviderName | null
  model: string | null
  promptVersion: string
  /** 全部嘗試加起來的時間 */
  latencyMs: number
  attempts: Attempt[]
}

export interface GenerateOptions {
  promptVersion?: string
  timeoutMs?: number
  now?: () => number
  /** 驗證規則；沒給就用線上的規則（含常用字檢查）。評估腳本用它重現「沒有常用字檢查」的舊規則 */
  validation?: ValidateOptions
}

/** 對單一供應商生成一次並驗證 */
export async function attemptGeneration(req: TrainingRequest, provider: LlmProvider, options: GenerateOptions = {}): Promise<Attempt & { items: string[] }> {
  const now = options.now ?? Date.now
  const prompt = buildTrainingPrompt(req, options.promptVersion ?? CURRENT_PROMPT_VERSION)
  const started = now()
  const base = { provider: provider.name, model: provider.model }
  let result
  try {
    result = await provider.call(prompt, AbortSignal.timeout(options.timeoutMs ?? PROVIDER_TIMEOUT_MS))
  } catch {
    result = { ok: false as const, error: 'network' }
  }
  const latency_ms = Math.max(0, Math.round(now() - started))
  if (!result.ok) return { ...base, ok: false, latency_ms, raw_count: 0, valid_count: 0, reason: result.error, rejects: {}, detail: result.detail, items: [] }
  const v = validateTrainingOutput(result.text, req, options.validation ?? SERVER_VALIDATION)
  return { ...base, ok: v.ok, latency_ms, raw_count: v.rawCount, valid_count: v.validCount, reason: v.topReason, rejects: v.rejects, rare_words: v.rareWords, items: v.ok ? v.items : [] }
}

/** 依序試每個供應商，第一個合格的就回傳。全部失敗時 ok 是 false（由呼叫的人退回內建字庫） */
export async function generateTraining(req: TrainingRequest, providers: readonly LlmProvider[], options: GenerateOptions = {}): Promise<GenerateResult> {
  const promptVersion = options.promptVersion ?? CURRENT_PROMPT_VERSION
  const attempts: Attempt[] = []
  for (const provider of providers) {
    const { items, ...attempt } = await attemptGeneration(req, provider, options)
    attempts.push(attempt)
    if (attempt.ok) {
      return { ok: true, items, provider: provider.name, model: provider.model, promptVersion, latencyMs: attempts.reduce((n, a) => n + a.latency_ms, 0), attempts }
    }
  }
  return { ok: false, items: [], provider: null, model: null, promptVersion, latencyMs: attempts.reduce((n, a) => n + a.latency_ms, 0), attempts }
}

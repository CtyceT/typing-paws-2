// 呼叫 LLM 供應商。只用標準的 fetch，所以 Edge Function（Deno）和 Node 腳本都能用；金鑰由呼叫的人傳進來，這裡不讀環境變數。
import type { BuiltPrompt } from './prompts/index.ts'

export type ProviderName = 'gemini' | 'groq'

/**
 * 呼叫結果：成功是模型輸出的文字；失敗是原因代號（http_429、http_500、timeout、network、empty…）。
 * code 是供應商錯誤內容裡的錯誤代號（例如 Groq 的 json_validate_failed、Gemini 的 UNAVAILABLE），會存進 ai_usage（D82）。
 */
export type ProviderResult = { ok: true; text: string } | { ok: false; error: string; detail?: string; code?: string }

/**
 * 從錯誤回應取出供應商的錯誤代號：OpenAI 相容格式（Groq）是 error.code 或 error.type，Gemini 是 error.status。
 * 只接受 1～64 個英數、底線、點、連字號，其他一律不收，避免把任意文字存進資料庫。
 */
export function providerErrorCode(body: string): string | undefined {
  let error: unknown
  try {
    error = (JSON.parse(body) as { error?: unknown } | null)?.error
  } catch {
    return undefined
  }
  if (!error || typeof error !== 'object') return undefined
  const { code, type, status } = error as Record<string, unknown>
  const pick = [code, type, status].find((v) => typeof v === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(v))
  return pick as string | undefined
}

export interface LlmProvider {
  name: ProviderName
  model: string
  call(prompt: BuiltPrompt, signal: AbortSignal): Promise<ProviderResult>
}

type Fetch = typeof fetch

export const GEMINI_MODEL = 'gemini-3.5-flash-lite'
/** Groq 上 gpt-oss-120b 的完整代號 */
export const GROQ_MODEL = 'openai/gpt-oss-120b'

/** 送出請求並把各種失敗整理成原因代號；回應內容交給 pick 取出文字 */
async function post(fetchFn: Fetch, url: string, headers: Record<string, string>, body: unknown, signal: AbortSignal, pick: (json: unknown) => unknown): Promise<ProviderResult> {
  let response: Response
  try {
    response = await fetchFn(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal })
  } catch (error) {
    const name = (error as { name?: string } | null)?.name
    return { ok: false, error: name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network' }
  }
  if (!response.ok) {
    // detail 只給本機的測試腳本看，不會存進資料庫或回給前端
    const body = await response.text().catch(() => '')
    const code = providerErrorCode(body)
    return { ok: false, error: `http_${response.status}`, detail: body.slice(0, 300), ...(code && { code }) }
  }
  try {
    const text = pick(await response.json())
    return typeof text === 'string' && text.trim() !== '' ? { ok: true, text } : { ok: false, error: 'empty' }
  } catch (error) {
    const name = (error as { name?: string } | null)?.name
    return { ok: false, error: name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'bad_response' }
  }
}

/** Google Gemini（備援）。用 responseSchema 要求輸出 {"items": string[]} */
export function geminiProvider(apiKey: string, fetchFn: Fetch = fetch, model: string = GEMINI_MODEL): LlmProvider {
  return {
    name: 'gemini',
    model,
    call(prompt, signal) {
      return post(
        fetchFn,
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        { 'x-goog-api-key': apiKey },
        {
          systemInstruction: { parts: [{ text: prompt.system }] },
          contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
          generationConfig: {
            temperature: prompt.temperature,
            responseMimeType: 'application/json',
            responseSchema: { type: 'OBJECT', properties: { items: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['items'] },
          },
        },
        signal,
        (json) => {
          const parts = (json as { candidates?: { content?: { parts?: { text?: unknown; thought?: unknown }[] } }[] }).candidates?.[0]?.content?.parts ?? []
          return parts
            .filter((p) => !p.thought && typeof p.text === 'string')
            .map((p) => p.text)
            .join('')
        },
      )
    },
  }
}

/** Groq（主力，OpenAI 相容 API）。用 json_schema 的 strict 模式要求輸出 {"items": string[]} */
export function groqProvider(apiKey: string, fetchFn: Fetch = fetch, model: string = GROQ_MODEL): LlmProvider {
  return {
    name: 'groq',
    model,
    call(prompt, signal) {
      return post(
        fetchFn,
        'https://api.groq.com/openai/v1/chat/completions',
        { Authorization: `Bearer ${apiKey}` },
        {
          model,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          temperature: prompt.temperature,
          reasoning_effort: 'low',
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'training_items',
              strict: true,
              schema: { type: 'object', properties: { items: { type: 'array', items: { type: 'string' } } }, required: ['items'], additionalProperties: false },
            },
          },
        },
        signal,
        (json) => (json as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message?.content,
      )
    },
  }
}

/** 嘗試的順序（D72）：Groq 主力、Gemini 備援。沒有設定金鑰的那一家略過 */
export const PROVIDER_ORDER: readonly ProviderName[] = ['groq', 'gemini']

/** 依 PROVIDER_ORDER 建立供應商；金鑰是空字串的略過 */
export function buildProviders(keys: { GROQ_API_KEY?: string; GEMINI_API_KEY?: string }, fetchFn: Fetch = fetch): LlmProvider[] {
  const make: Record<ProviderName, () => LlmProvider | null> = {
    groq: () => (keys.GROQ_API_KEY ? groqProvider(keys.GROQ_API_KEY, fetchFn) : null),
    gemini: () => (keys.GEMINI_API_KEY ? geminiProvider(keys.GEMINI_API_KEY, fetchFn) : null),
  }
  return PROVIDER_ORDER.map((name) => make[name]()).filter((p): p is LlmProvider => p !== null)
}

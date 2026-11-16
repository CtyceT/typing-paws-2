// 呼叫 LLM 供應商。只用標準的 fetch，所以 Edge Function（Deno）和 Node 腳本都能用；金鑰由呼叫的人傳進來，這裡不讀環境變數。
import type { BuiltPrompt } from './prompts/index.ts'

export type ProviderName = 'gemini' | 'groq'

/** 呼叫結果：成功是模型輸出的文字；失敗是原因代號（http_429、http_500、timeout、network、empty…） */
export type ProviderResult = { ok: true; text: string } | { ok: false; error: string; detail?: string }

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
    const detail = await response.text().then((t) => t.slice(0, 300), () => '')
    return { ok: false, error: `http_${response.status}`, detail }
  }
  try {
    const text = pick(await response.json())
    return typeof text === 'string' && text.trim() !== '' ? { ok: true, text } : { ok: false, error: 'empty' }
  } catch (error) {
    const name = (error as { name?: string } | null)?.name
    return { ok: false, error: name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'bad_response' }
  }
}

/** Google Gemini（主力）。用 responseSchema 要求輸出 {"items": string[]} */
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

/** Groq（備援，OpenAI 相容 API）。用 json_schema 的 strict 模式要求輸出 {"items": string[]} */
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

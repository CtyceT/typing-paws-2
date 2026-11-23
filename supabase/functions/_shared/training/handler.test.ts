import { describe, expect, it } from 'vitest'
import { supabaseBackend } from './backend.ts'
import { createTrainingHandler, DAILY_LIMIT } from './handler.ts'
import { CURRENT_PROMPT_VERSION as V } from './prompts/index.ts'
import { fakeBackend, fakeProvider, GOOD_NORMAL, NORMAL_REQUEST } from './testing.ts'

const URL_ = 'https://project.supabase.co/functions/v1/training-words'
const post = (body: unknown, token: string | null = 'token-alice', origin = 'https://ctycet.github.io') =>
  new Request(URL_, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

function setup(options: { groq?: Parameters<typeof fakeProvider>[1][]; gemini?: Parameters<typeof fakeProvider>[1][]; dailyLimit?: number } = {}) {
  const { backend, state } = fakeBackend()
  const groq = fakeProvider('groq', ...(options.groq ?? [GOOD_NORMAL]))
  const gemini = fakeProvider('gemini', ...(options.gemini ?? [GOOD_NORMAL]))
  // 固定的亂數：打亂的結果可以重現
  let seed = 3
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const handler = createTrainingHandler({ backend, providers: [groq, gemini], rng, dailyLimit: options.dailyLimit })
  return { handler, state, groq, gemini }
}

describe('身分與 CORS（4.2）', () => {
  it('沒帶 JWT、JWT 無效都是 401，訊息是繁中', async () => {
    const { handler, groq } = setup()
    for (const token of [null, 'token-nobody']) {
      const res = await handler(post(NORMAL_REQUEST, token))
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: { code: 'unauthorized', message: '登入後即可使用 AI 出題。' } })
    }
    expect(groq.calls).toBe(0)
  })

  it('預檢請求回 204；只有允許的網站拿得到 Access-Control-Allow-Origin', async () => {
    const { handler } = setup()
    const preflight = await handler(new Request(URL_, { method: 'OPTIONS', headers: { Origin: 'https://ctycet.github.io' } }))
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('https://ctycet.github.io')
    expect(preflight.headers.get('Access-Control-Allow-Headers')).toContain('authorization')
    expect((await handler(post(NORMAL_REQUEST, 'token-alice', 'http://localhost:5173'))).headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173')
    expect((await handler(post(NORMAL_REQUEST, 'token-alice', 'https://evil.example'))).headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('GET 是 405；參數不對是 400，而且不會呼叫 LLM 或扣次數', async () => {
    const { handler, state, groq } = setup()
    expect((await handler(new Request(URL_, { headers: { Authorization: 'Bearer token-alice' } }))).status).toBe(405)
    for (const body of ['not json', { difficulty: 'normal', theme: 'space', weaknesses: [] }, { ...NORMAL_REQUEST, theme: 'pirates' }]) {
      const res = await handler(post(body))
      expect(res.status).toBe(400)
      expect((await res.json()).error.code).toBe('bad_request')
    }
    expect(groq.calls).toBe(0)
    expect(state.usage).toHaveLength(0)
  })

  it('驗證登入的服務連不上時回 503，不呼叫 LLM', async () => {
    const { handler, state, groq } = setup()
    state.failAuth = true
    expect((await handler(post(NORMAL_REQUEST))).status).toBe(503)
    expect(groq.calls).toBe(0)
  })
})

describe('生成與備援（4.6）', () => {
  it('成功：回傳題目、來源、剩餘次數，並記下用量與品質', async () => {
    const { handler, state } = setup()
    const res = await handler(post(NORMAL_REQUEST))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ items: GOOD_NORMAL, source: 'groq', limit: 10, remaining: 9 })
    expect(state.usage).toHaveLength(1)
    expect(state.usage[0]).toMatchObject({ userId: 'alice', feature: 'training', source: 'groq', counted: true, request: NORMAL_REQUEST })
    expect(state.usage[0].result).toMatchObject({ prompt_version: V, model: 'groq-test', raw_count: 15, valid_count: 15, reject_reason: null })
    expect(state.usage[0].result?.latency_ms).toBeGreaterThanOrEqual(0)
    expect(state.usage[0].result?.attempts).toHaveLength(1)
  })

  it('Groq 失敗 → 用 Gemini 的結果，紀錄裡兩次嘗試都在', async () => {
    const { handler, state, groq, gemini } = setup({ groq: [{ ok: false, error: 'http_429' }] })
    const body = await (await handler(post(NORMAL_REQUEST))).json()
    expect(body.source).toBe('gemini')
    expect([groq.calls, gemini.calls]).toEqual([1, 1])
    expect(state.usage[0].result).toMatchObject({ source: 'gemini', model: 'gemini-test', counted: true })
    expect(state.usage[0].result?.attempts).toMatchObject([{ provider: 'groq', ok: false, reason: 'http_429' }, { provider: 'gemini', ok: true }])
  })

  it('兩家都失敗：502、明確的錯誤、次數退還、不寫快取', async () => {
    const { handler, state } = setup({ groq: [{ ok: true, text: '壞掉的輸出' }], gemini: [['planet', 'rocket']] })
    const res = await handler(post(NORMAL_REQUEST))
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: { code: 'generation_failed', message: 'AI 這次沒有出題成功，先用內建字庫練習。' }, limit: 10, remaining: 10 })
    expect(state.usage[0]).toMatchObject({ source: 'failed', counted: false })
    expect(state.usage[0].result).toMatchObject({ reject_reason: 'missing_target', raw_count: 2, valid_count: 0 })
    expect(state.used('alice')).toBe(0)
    expect(state.cache.size).toBe(0)
  })

  it('供應商的原始錯誤內容不會存進用量紀錄', async () => {
    const { handler, state } = setup({ groq: [{ ok: false, error: 'http_400', detail: 'raw provider error body' }] })
    await handler(post(NORMAL_REQUEST))
    expect(JSON.stringify(state.usage[0].result)).not.toContain('raw provider error body')
  })

  it('供應商的錯誤代號會存進用量紀錄（D82），被判冷僻字的字不會', async () => {
    const { handler, state } = setup({ groq: [{ ok: false, error: 'http_400', detail: '{"error":{"code":"json_validate_failed"}}', code: 'json_validate_failed' }] })
    await handler(post(NORMAL_REQUEST))
    expect(state.usage[0].result?.attempts).toMatchObject([{ provider: 'groq', reason: 'http_400', error_code: 'json_validate_failed' }, { provider: 'gemini', ok: true }])
    expect(JSON.stringify(state.usage[0].result)).not.toContain('rare_words')
  })
})

describe('每日上限（4.3）', () => {
  it('預設每人每天 10 次', () => expect(DAILY_LIMIT).toBe(10))

  it('超過上限回 429 與繁中提示，而且不呼叫 LLM；別人不受影響', async () => {
    const { handler, state, groq } = setup({ dailyLimit: 2 })
    // 每次用不同的主題，才不會命中快取
    for (const theme of ['daily', 'fantasy']) expect((await handler(post({ ...NORMAL_REQUEST, theme }))).status).toBe(200)
    const res = await handler(post({ ...NORMAL_REQUEST, theme: 'school' }))
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: { code: 'daily_limit', message: '今天的 AI 出題次數用完了，明天再來！' }, limit: 2, remaining: 0 })
    expect(groq.calls).toBe(2)
    expect(state.usage).toHaveLength(2)
    expect((await handler(post({ ...NORMAL_REQUEST, theme: 'school' }, 'token-bob'))).status).toBe(200)
  })

  it('隔天（台灣時間午夜之後）自動恢復', async () => {
    const { handler, state } = setup({ dailyLimit: 1 })
    state.now = Date.UTC(2026, 10, 16, 15, 30) // 台灣時間 23:30
    expect((await handler(post({ ...NORMAL_REQUEST, theme: 'daily' }))).status).toBe(200)
    expect((await handler(post({ ...NORMAL_REQUEST, theme: 'school' }))).status).toBe(429)
    state.now = Date.UTC(2026, 10, 16, 16, 5) // 台灣時間隔天 00:05
    expect((await handler(post({ ...NORMAL_REQUEST, theme: 'school' }))).status).toBe(200)
  })

  it('用量紀錄寫不進去時不呼叫 LLM（503）', async () => {
    const { handler, state, groq } = setup()
    state.failUsage = true
    const res = await handler(post(NORMAL_REQUEST))
    expect(res.status).toBe(503)
    expect((await res.json()).error.code).toBe('unavailable')
    expect(groq.calls).toBe(0)
  })
})

describe('題庫快取（4.7）', () => {
  it('相同的弱點組合＋難度＋主題第二次請求不再呼叫 LLM，也不扣次數；順序會打亂', async () => {
    const { handler, state, groq } = setup()
    const first = await (await handler(post(NORMAL_REQUEST))).json()
    // 弱點的順序不同、換一個人，仍然是同一份快取
    const second = await (await handler(post({ ...NORMAL_REQUEST, weaknesses: ['z', 'th', 'q'] }, 'token-bob'))).json()
    expect(groq.calls).toBe(1)
    expect(second.source).toBe('cache')
    expect(second.remaining).toBe(10)
    expect([...second.items].sort()).toEqual([...first.items].sort())
    expect(second.items).not.toEqual(first.items)
    expect(state.usage.map((u) => [u.userId, u.source, u.counted])).toEqual([
      ['alice', 'groq', true],
      ['bob', 'cache', false],
    ])
    expect(state.usage[1].result).toMatchObject({ prompt_version: V, model: 'groq-test', valid_count: 15 })
  })

  it('快取裡有冷僻字的舊題目不會被拿來用', async () => {
    const { handler, state, groq } = setup()
    const rare = ['quoth', 'thymus', 'zenith', 'quasar', 'azimuth', 'thrum', 'thatch', 'quokka', 'zephyr', 'thane', 'quaff', 'zloty', 'thews', 'quire', 'zooid']
    state.cache.set(`${V}|normal|space|q+th+z`, { key: 'k', promptVersion: V, request: NORMAL_REQUEST, items: rare, provider: 'groq', model: 'm', ttlHours: 24, expiresAt: state.now + 1000 })
    expect((await (await handler(post(NORMAL_REQUEST))).json()).source).toBe('groq')
    expect(groq.calls).toBe(1)
  })

  it('難度或主題不同就不是同一份快取', async () => {
    const { handler, groq } = setup()
    await handler(post(NORMAL_REQUEST))
    await handler(post({ ...NORMAL_REQUEST, theme: 'school' }))
    expect(groq.calls).toBe(2)
  })

  it('超過 24 小時的快取不再使用', async () => {
    const { handler, state, groq } = setup()
    await handler(post(NORMAL_REQUEST))
    state.now += 23 * 3600_000
    expect((await (await handler(post(NORMAL_REQUEST))).json()).source).toBe('cache')
    state.now += 2 * 3600_000
    expect((await (await handler(post(NORMAL_REQUEST))).json()).source).toBe('groq')
    expect(groq.calls).toBe(2)
  })

  it('次數用完之後，已經有快取的組合還是可以練', async () => {
    const { handler } = setup({ dailyLimit: 1 })
    await handler(post(NORMAL_REQUEST))
    expect((await handler(post({ ...NORMAL_REQUEST, theme: 'school' }))).status).toBe(429)
    const res = await handler(post(NORMAL_REQUEST))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ source: 'cache', remaining: 0 })
  })

  it('快取讀不到或內容壞掉時當作沒有快取，照常生成', async () => {
    const { handler, state, groq } = setup()
    state.failCache = true
    expect((await (await handler(post(NORMAL_REQUEST))).json()).source).toBe('groq')
    state.failCache = false
    state.cache.set(`${V}|normal|space|q+th+z`, { key: 'k', promptVersion: V, request: NORMAL_REQUEST, items: ['<script>'], provider: 'groq', model: 'm', ttlHours: 24, expiresAt: state.now + 1000 })
    expect((await (await handler(post(NORMAL_REQUEST))).json()).source).toBe('groq')
    expect(groq.calls).toBe(2)
  })
})

describe('supabaseBackend', () => {
  it('用 service role key 呼叫資料庫函式；驗證身分時帶的是使用者的 JWT', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const fetchFn = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      if (url.endsWith('/auth/v1/user')) return (init.headers as Record<string, string>).Authorization === 'Bearer good' ? Response.json({ id: 'u1' }) : new Response('{}', { status: 401 })
      if (url.endsWith('/ai_usage_begin')) return Response.json({ allowed: true, id: 7, used: 3 })
      if (url.endsWith('/training_cache_get')) return new Response('null')
      return new Response(null, { status: 204 })
    }) as unknown as typeof fetch
    const backend = supabaseBackend('https://p.supabase.co/', 'SERVICE', fetchFn)
    expect(await backend.getUserId('good')).toBe('u1')
    expect(await backend.getUserId('bad')).toBeNull()
    expect(await backend.usageBegin('u1', 'training', 10, NORMAL_REQUEST)).toEqual({ allowed: true, id: 7, used: 3 })
    expect(await backend.cacheGet('k')).toBeNull()
    await backend.usageFinish(7, { source: 'groq', counted: true, prompt_version: 'v1', model: 'm', latency_ms: 1, raw_count: 1, valid_count: 1, reject_reason: null, attempts: [] })
    const begin = calls.find((c) => c.url.endsWith('/ai_usage_begin'))!
    expect(begin.url).toBe('https://p.supabase.co/rest/v1/rpc/ai_usage_begin')
    expect(begin.init.headers).toMatchObject({ apikey: 'SERVICE', Authorization: 'Bearer SERVICE' })
    expect(JSON.parse(begin.init.body as string)).toEqual({ p_user: 'u1', p_feature: 'training', p_limit: 10, p_request: NORMAL_REQUEST })
  })

  it('資料庫回錯時丟出例外', async () => {
    const backend = supabaseBackend('https://p.supabase.co', 'S', (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch)
    await expect(backend.cacheGet('k')).rejects.toThrow()
    await expect(backend.getUserId('t')).rejects.toThrow()
  })
})

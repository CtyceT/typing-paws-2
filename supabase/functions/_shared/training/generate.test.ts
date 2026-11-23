import { describe, expect, it } from 'vitest'
import { generateTraining } from './generate.ts'
import { geminiProvider, groqProvider } from './providers.ts'
import { buildTrainingPrompt, CURRENT_PROMPT_VERSION } from './prompts/index.ts'
import { fakeProvider, GOOD_NORMAL, NORMAL_REQUEST } from './testing.ts'

describe('generateTraining', () => {
  it('Gemini 成功就不會呼叫 Groq', async () => {
    const gemini = fakeProvider('gemini', GOOD_NORMAL)
    const groq = fakeProvider('groq', GOOD_NORMAL)
    const r = await generateTraining(NORMAL_REQUEST, [gemini, groq])
    expect(r).toMatchObject({ ok: true, provider: 'gemini', model: 'gemini-test', promptVersion: CURRENT_PROMPT_VERSION, items: GOOD_NORMAL })
    expect(r.attempts).toHaveLength(1)
    expect(r.attempts[0]).toMatchObject({ provider: 'gemini', ok: true, raw_count: 15, valid_count: 15, reason: null })
    expect(groq.calls).toBe(0)
  })

  it.each([
    ['429', { ok: false, error: 'http_429' } as const, 'http_429'],
    ['逾時', { ok: false, error: 'timeout' } as const, 'timeout'],
  ])('Gemini %s → 改用 Groq', async (_name, failure, reason) => {
    const gemini = fakeProvider('gemini', failure)
    const groq = fakeProvider('groq', GOOD_NORMAL)
    const r = await generateTraining(NORMAL_REQUEST, [gemini, groq])
    expect(r).toMatchObject({ ok: true, provider: 'groq', model: 'groq-test' })
    expect(r.attempts.map((a) => [a.provider, a.ok, a.reason])).toEqual([
      ['gemini', false, reason],
      ['groq', true, null],
    ])
    expect(gemini.calls).toBe(1)
  })

  it('Gemini 的輸出不合格（題目太長、沒有弱點鍵）→ 改用 Groq，並記下不合格原因', async () => {
    const bad = ['planet', 'rocket', 'galaxy', 'comet', 'orbit', 'quartz']
    const r = await generateTraining(NORMAL_REQUEST, [fakeProvider('gemini', bad), fakeProvider('groq', GOOD_NORMAL)])
    expect(r.ok).toBe(true)
    expect(r.provider).toBe('groq')
    expect(r.attempts[0]).toMatchObject({ ok: false, raw_count: 6, valid_count: 1, reason: 'missing_target', rejects: { missing_target: 5 } })
  })

  it('Gemini 的題目多半是冷僻字 → 改用 Groq，原因記為 rare_word；關掉常用字檢查時同一份輸出會通過', async () => {
    const rare = ['quoth', 'thymus', 'zenith', 'quasar', 'azimuth', 'thrum', 'thatch', 'zephyr', 'quaff', 'zloty', 'quartz', 'zebra', 'theory', 'quest', 'earth']
    const r = await generateTraining(NORMAL_REQUEST, [fakeProvider('gemini', rare), fakeProvider('groq', GOOD_NORMAL)])
    expect(r.provider).toBe('groq')
    expect(r.attempts[0]).toMatchObject({ ok: false, raw_count: 15, valid_count: 5, reason: 'rare_word', rejects: { rare_word: 10 } })
    const basic = await generateTraining(NORMAL_REQUEST, [fakeProvider('gemini', rare)], { validation: {} })
    expect(basic).toMatchObject({ ok: true, provider: 'gemini' })
  })

  it('兩家都失敗：ok 是 false、沒有題目，兩次嘗試都有紀錄', async () => {
    const r = await generateTraining(NORMAL_REQUEST, [fakeProvider('gemini', { ok: true, text: 'not json' }), fakeProvider('groq', { ok: false, error: 'http_500' })])
    expect(r).toMatchObject({ ok: false, items: [], provider: null, model: null })
    expect(r.attempts.map((a) => a.reason)).toEqual(['invalid_json', 'http_500'])
  })

  it('供應商丟出例外也不會讓流程壞掉', async () => {
    const broken = { name: 'gemini' as const, model: 'x', call: () => Promise.reject(new Error('boom')) }
    const r = await generateTraining(NORMAL_REQUEST, [broken, fakeProvider('groq', GOOD_NORMAL)])
    expect(r.provider).toBe('groq')
    expect(r.attempts[0].reason).toBe('network')
  })

  it('延遲時間用注入的時鐘計算', async () => {
    let t = 1000
    const now = () => (t += 250)
    const r = await generateTraining(NORMAL_REQUEST, [fakeProvider('gemini', { ok: false, error: 'http_429' }), fakeProvider('groq', GOOD_NORMAL)], { now })
    expect(r.attempts.map((a) => a.latency_ms)).toEqual([250, 250])
    expect(r.latencyMs).toBe(500)
  })
})

describe('供應商的請求格式', () => {
  const prompt = buildTrainingPrompt(NORMAL_REQUEST)
  const signal = AbortSignal.timeout(1000)
  const capture = (response: Response | Error) => {
    const calls: { url: string; init: RequestInit }[] = []
    const fetchFn = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      if (response instanceof Error) throw response
      return response
    }) as unknown as typeof fetch
    return { calls, fetchFn }
  }
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

  it('Gemini：金鑰放在標頭、要求 JSON 輸出，取出回應裡的文字（略過思考的部分）', async () => {
    const { calls, fetchFn } = capture(json({ candidates: [{ content: { parts: [{ text: 'thinking', thought: true }, { text: '{"items":' }, { text: '["quartz"]}' }] } }] }))
    const r = await geminiProvider('KEY-G', fetchFn).call(prompt, signal)
    expect(r).toEqual({ ok: true, text: '{"items":["quartz"]}' })
    expect(calls[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent')
    expect(calls[0].url).not.toContain('KEY-G')
    expect((calls[0].init.headers as Record<string, string>)['x-goog-api-key']).toBe('KEY-G')
    const body = JSON.parse(calls[0].init.body as string)
    expect(body.systemInstruction.parts[0].text).toBe(prompt.system)
    expect(body.contents[0].parts[0].text).toBe(prompt.user)
    expect(body.generationConfig).toMatchObject({ temperature: 0.9, responseMimeType: 'application/json' })
  })

  it('Groq：OpenAI 相容格式、模型是 openai/gpt-oss-120b、strict 的 JSON schema', async () => {
    const { calls, fetchFn } = capture(json({ choices: [{ message: { content: '{"items":["zenith"]}' } }] }))
    const r = await groqProvider('KEY-Q', fetchFn).call(prompt, signal)
    expect(r).toEqual({ ok: true, text: '{"items":["zenith"]}' })
    expect(calls[0].url).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer KEY-Q')
    const body = JSON.parse(calls[0].init.body as string)
    expect(body.model).toBe('openai/gpt-oss-120b')
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(['system', 'user'])
    expect(body.response_format.json_schema.strict).toBe(true)
  })

  it('HTTP 錯誤、斷線、逾時、空回應各有代號', async () => {
    expect(await geminiProvider('k', capture(json({ error: 'quota' }, 429)).fetchFn).call(prompt, signal)).toMatchObject({ ok: false, error: 'http_429' })
    expect(await groqProvider('k', capture(json({}, 503)).fetchFn).call(prompt, signal)).toMatchObject({ ok: false, error: 'http_503' })
    expect(await groqProvider('k', capture(new TypeError('fetch failed')).fetchFn).call(prompt, signal)).toEqual({ ok: false, error: 'network' })
    expect(await groqProvider('k', capture(Object.assign(new Error('t'), { name: 'TimeoutError' })).fetchFn).call(prompt, signal)).toEqual({ ok: false, error: 'timeout' })
    expect(await geminiProvider('k', capture(json({ candidates: [] })).fetchFn).call(prompt, signal)).toEqual({ ok: false, error: 'empty' })
    expect(await groqProvider('k', capture(new Response('<html>', { status: 200 })).fetchFn).call(prompt, signal)).toEqual({ ok: false, error: 'bad_response' })
  })
})

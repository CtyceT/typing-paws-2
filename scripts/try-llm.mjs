// 在本機直接呼叫 Gemini 與 Groq，用的是和 Edge Function 同一份 prompt 與驗證（supabase/functions/_shared/training）。
// 這台機器沒有 Docker／Deno，跑不了 `supabase functions serve`，所以用這支腳本確認 prompt 和兩家 API 真的能用。
//
// 金鑰：自己建立 supabase/functions/.env（已被 .gitignore 的 .env* 擋掉，不會進版控），內容兩行：
//   GEMINI_API_KEY=...
//   GROQ_API_KEY=...
// 這支腳本只把金鑰放進請求的標頭，不會印出來，也不會寫進任何檔案。
//
// 用法
//   node scripts/try-llm.mjs                                    試一次（普通、太空、q z th），兩家都跑
//   node scripts/try-llm.mjs --difficulty easy --theme daily --targets q,z --provider groq
//   node scripts/try-llm.mjs --show-prompt                      只印出 prompt，不呼叫 API（不需要金鑰）
//   node scripts/try-llm.mjs --eval                             評估模式：固定的測試案例，兩家各跑一次，結果寫到 docs/llm-eval.md
//   node scripts/try-llm.mjs --eval --prompt v1                 評估另一個 prompt 版本（各版本的結果會並列比較）
//   node scripts/try-llm.mjs --eval --no-common                 不做常用字檢查（重現 v2 之前的驗證規則）
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { attemptGeneration, PROVIDER_TIMEOUT_MS } from '../supabase/functions/_shared/training/generate.ts'
import { buildTrainingPrompt, CURRENT_PROMPT_VERSION, PROMPTS } from '../supabase/functions/_shared/training/prompts/index.ts'
import { geminiProvider, groqProvider } from '../supabase/functions/_shared/training/providers.ts'
import { MIN_ITEMS, parseTrainingRequest } from '../supabase/functions/_shared/training/request.ts'

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url))
const ENV_FILE = root('supabase/functions/.env')
const EVAL_JSON = root('docs/llm-eval.json')
const EVAL_MD = root('docs/llm-eval.md')

const { values: args } = parseArgs({
  options: {
    eval: { type: 'boolean', default: false },
    'show-prompt': { type: 'boolean', default: false },
    difficulty: { type: 'string', default: 'normal' },
    theme: { type: 'string', default: 'space' },
    targets: { type: 'string', default: 'q,z,th' },
    provider: { type: 'string', default: 'both' },
    prompt: { type: 'string', default: CURRENT_PROMPT_VERSION },
    // 評估模式每個案例之間等幾毫秒：Gemini 免費額度大約每分鐘 15 次
    delay: { type: 'string', default: '4500' },
    // 不做常用字檢查（rare_word）：v2 之前的驗證規則
    'no-common': { type: 'boolean', default: false },
  },
})

if (!PROMPTS[args.prompt]) {
  console.error(`沒有這個 prompt 版本：${args.prompt}（有的版本：${Object.keys(PROMPTS).join('、')}）`)
  process.exit(1)
}

/** 讀金鑰檔（KEY=VALUE，一行一個）。只取需要的兩個值，去掉引號和 Windows 的換行符號 */
function loadKeys() {
  const keys = { GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? '', GROQ_API_KEY: process.env.GROQ_API_KEY ?? '' }
  if (existsSync(ENV_FILE)) {
    for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
      const m = /^\s*(GEMINI_API_KEY|GROQ_API_KEY)\s*=\s*(.*?)\s*$/.exec(line)
      if (m) keys[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return keys
}

function loadProviders() {
  const keys = loadKeys()
  const all = { gemini: keys.GEMINI_API_KEY && geminiProvider(keys.GEMINI_API_KEY), groq: keys.GROQ_API_KEY && groqProvider(keys.GROQ_API_KEY) }
  const wanted = args.provider === 'both' ? ['gemini', 'groq'] : [args.provider]
  const missing = wanted.filter((name) => !all[name])
  if (missing.length > 0) {
    console.error(`找不到 ${missing.map((n) => `${n.toUpperCase()}_API_KEY`).join('、')}。`)
    console.error(`請建立 supabase/functions/.env（不會進版控），內容：\n  GEMINI_API_KEY=你的金鑰\n  GROQ_API_KEY=你的金鑰`)
    process.exit(1)
  }
  return wanted.map((name) => all[name])
}

/** 驗證規則：common 是線上的規則（含常用字檢查），basic 是沒有常用字檢查的舊規則 */
const VALIDATION = args['no-common'] ? 'basic' : 'common'
const VALIDATION_LABEL = { basic: '基本', common: '基本＋常用字' }
const generateOptions = { promptVersion: args.prompt, ...(args['no-common'] && { validation: {} }) }

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const pct = (n, d) => (d > 0 ? `${Math.round((n / d) * 1000) / 10}%` : '—')

// ───────────────────────── 試一次 ─────────────────────────

async function tryOnce() {
  const req = parseTrainingRequest({ difficulty: args.difficulty, theme: args.theme, weaknesses: args.targets.split(',').map((s) => s.trim()).filter(Boolean) })
  if (!req) {
    console.error('參數不合法：difficulty 是 easy／normal／hard，theme 是 daily／fantasy／space／school，targets 是 1～3 個鍵（逗號分隔）')
    process.exit(1)
  }
  const prompt = buildTrainingPrompt(req, args.prompt)
  console.log(`── prompt ${prompt.version}（temperature ${prompt.temperature}）──\n[system]\n${prompt.system}\n\n[user]\n${prompt.user}\n`)
  if (args['show-prompt']) return
  for (const provider of loadProviders()) {
    const a = await attemptGeneration(req, provider, generateOptions)
    console.log(`── ${provider.name}（${provider.model}）──`)
    console.log(`${a.ok ? '✓ 合格' : '✗ 不合格'}　延遲 ${a.latency_ms} ms　原始 ${a.raw_count} 題 → 合格 ${a.valid_count} 題（門檻 ${MIN_ITEMS[req.difficulty]}）${a.reason ? `　主要原因：${a.reason}` : ''}`)
    if (Object.keys(a.rejects).length > 0) console.log(`被丟掉的題目：${JSON.stringify(a.rejects)}`)
    if (a.detail) console.log(`供應商回應：${a.detail}`)
    if (a.items.length > 0) console.log(a.items.join(' | '))
    console.log()
  }
}

// ───────────────────────── 評估模式 ─────────────────────────

/** 固定的測試案例：3 個難度 × 常見與罕見的弱點組合。改了這份清單，新舊版本的結果就不能直接比較 */
const EVAL_CASES = [
  ['easy', 'daily', ['e', 'r', 't'], '常見'],
  ['easy', 'school', ['in', 'th'], '常見'],
  ['easy', 'fantasy', ['q', 'x', 'z'], '罕見'],
  ['easy', 'space', ['j', 'k', 'v'], '罕見'],
  ['normal', 'space', ['e', 'r', 't'], '常見'],
  ['normal', 'daily', ['in', 'th'], '常見'],
  ['normal', 'school', ['q', 'x', 'z'], '罕見'],
  ['normal', 'fantasy', ['j', 'k', 'v'], '罕見'],
  ['hard', 'fantasy', ['e', 'r', 't'], '常見'],
  ['hard', 'space', ['ou', 'th'], '常見'],
  ['hard', 'daily', ['q', 'x', 'z'], '罕見'],
  ['hard', 'school', ['4', ';', 'th'], '罕見'],
].map(([difficulty, theme, weaknesses, kind]) => ({ difficulty, theme, weaknesses, kind }))

async function runEval() {
  const providers = loadProviders()
  const delay = Number(args.delay) || 0
  const cases = []
  for (const [i, c] of EVAL_CASES.entries()) {
    const req = parseTrainingRequest(c)
    const results = {}
    for (const provider of providers) {
      const a = await attemptGeneration(req, provider, generateOptions)
      results[provider.name] = { model: a.model, ok: a.ok, latency_ms: a.latency_ms, raw_count: a.raw_count, valid_count: a.valid_count, reason: a.reason, rejects: a.rejects, sample: a.items.slice(0, 6) }
      console.log(`[${i + 1}/${EVAL_CASES.length}] ${c.difficulty} ${c.weaknesses.join(' ')}　${provider.name}：${a.ok ? '✓' : '✗'} ${a.valid_count}/${a.raw_count} 題　${a.latency_ms} ms${a.reason ? `　${a.reason}` : ''}`)
    }
    cases.push({ ...c, weaknesses: req.weaknesses, results })
    if (i < EVAL_CASES.length - 1) await sleep(delay)
  }
  const store = existsSync(EVAL_JSON) ? JSON.parse(readFileSync(EVAL_JSON, 'utf8')) : { runs: {} }
  store.runs[`${args.prompt}|${VALIDATION}`] = { prompt: args.prompt, validation: VALIDATION, ranAt: new Date().toISOString(), timeoutMs: PROVIDER_TIMEOUT_MS, cases }
  writeFileSync(EVAL_JSON, JSON.stringify(store, null, 2) + '\n')
  writeFileSync(EVAL_MD, renderReport(store))
  console.log(`\n已寫入 docs/llm-eval.md（原始數字在 docs/llm-eval.json）`)
}

/** 把某個版本、某一家、某一組案例的結果加總 */
function summarize(cases, provider) {
  const rows = cases.map((c) => c.results[provider]).filter(Boolean)
  const reasons = {}
  const add = (key, n) => (reasons[key] = (reasons[key] ?? 0) + n)
  for (const r of rows) {
    for (const [reason, n] of Object.entries(r.rejects)) add(reason, n)
    // 沒有題目可以數的失敗（HTTP 錯誤、逾時、JSON 壞掉）算一次
    if (!r.ok && r.raw_count === 0 && r.reason) add(r.reason, 1)
  }
  const raw = rows.reduce((n, r) => n + r.raw_count, 0)
  const valid = rows.reduce((n, r) => n + r.valid_count, 0)
  return {
    total: rows.length,
    passed: rows.filter((r) => r.ok).length,
    raw,
    valid,
    avgLatency: rows.length > 0 ? Math.round(rows.reduce((n, r) => n + r.latency_ms, 0) / rows.length) : null,
    model: rows[0]?.model ?? '',
    reasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]),
  }
}

const reasonText = (reasons) => (reasons.length > 0 ? reasons.map(([k, n]) => `${k} ×${n}`).join('、') : '—')
const DIFFICULTY_LABEL = { easy: '簡單', normal: '普通', hard: '困難' }

function renderReport(store) {
  const versions = Object.keys(store.runs).sort()
  const providersOf = (run) => [...new Set(run.cases.flatMap((c) => Object.keys(c.results)))]
  const out = [
    '# LLM 出題品質評估',
    '',
    '由 `node scripts/try-llm.mjs --eval` 產生，請不要手動修改（原始數字在 `docs/llm-eval.json`）。',
    '',
    '- 做法：固定的 12 個測試案例（3 個難度 × 常見與罕見的弱點組合），每一家各生成一次，用和線上相同的 prompt、驗證規則與逾時設定。',
    '- **案例合格率**：合格題數達到門檻（簡單 10 題、普通與困難 15 題）的案例比例，也就是線上「這一家能不能用」的機率。',
    '- **題目合格率**：LLM 給的題目裡通過驗證的比例。',
    '- **驗證規則**：「基本」是格式、長度、禁用字、要含弱點鍵；「基本＋常用字」另外要求每個字都在 2 萬字的常用字表上（不在表上記為 rare_word），這是 prompt v2 一起加的、線上使用的規則。',
    '- 每個案例只跑一次，而且 temperature 是 0.9，所以數字會有起伏；差距不大時不代表真的有差別。',
    '',
    '## 各版本比較',
    '',
    '| prompt | 驗證規則 | 模型 | 案例合格率 | 題目合格率 | 平均延遲 | 呼叫失敗 | 不合格原因分布 |',
    '|---|---|---|---|---|---|---|---|',
  ]
  for (const v of versions) {
    const run = store.runs[v]
    for (const p of providersOf(run)) {
      const s = summarize(run.cases, p)
      // 呼叫失敗：沒有拿到任何題目的次數（HTTP 503、429、逾時…），和題目品質無關
      const callErrors = s.reasons.filter(([k]) => /^(http_|timeout|network|empty|bad_response)/.test(k))
      out.push(`| ${run.prompt} | ${VALIDATION_LABEL[run.validation]} | ${s.model} | ${s.passed}/${s.total}（${pct(s.passed, s.total)}） | ${s.valid}/${s.raw}（${pct(s.valid, s.raw)}） | ${s.avgLatency} ms | ${reasonText(callErrors)} | ${reasonText(s.reasons.filter((r) => !callErrors.includes(r)))} |`)
    }
  }
  for (const v of [...versions].reverse()) {
    const run = store.runs[v]
    out.push('', `## prompt ${run.prompt}（驗證規則：${VALIDATION_LABEL[run.validation]}）`, '', `執行時間：${run.ranAt}　每次呼叫的逾時：${run.timeoutMs} ms`, '', '### 依難度與弱點類型', '', '| 模型 | 分組 | 案例合格率 | 題目合格率 | 平均延遲 | 不合格原因分布 |', '|---|---|---|---|---|---|')
    const groups = [
      ...['easy', 'normal', 'hard'].map((d) => [DIFFICULTY_LABEL[d], (c) => c.difficulty === d]),
      ...['常見', '罕見'].map((k) => [`${k}弱點`, (c) => c.kind === k]),
    ]
    for (const p of providersOf(run)) {
      for (const [label, match] of groups) {
        const s = summarize(run.cases.filter(match), p)
        out.push(`| ${s.model} | ${label} | ${s.passed}/${s.total} | ${pct(s.valid, s.raw)} | ${s.avgLatency} ms | ${reasonText(s.reasons)} |`)
      }
    }
    out.push('', '### 每個案例', '', '| 難度 | 主題 | 弱點 | 類型 | 模型 | 結果 | 合格／原始 | 延遲 | 主要原因 | 題目範例 |', '|---|---|---|---|---|---|---|---|---|---|')
    for (const c of run.cases) {
      for (const [p, r] of Object.entries(c.results)) {
        const sample = r.sample.length > 0 ? r.sample.map((s) => `\`${s}\``).join(' ') : '—'
        out.push(`| ${DIFFICULTY_LABEL[c.difficulty]} | ${c.theme} | ${c.weaknesses.map((w) => `\`${w}\``).join(' ')} | ${c.kind} | ${p} | ${r.ok ? '✓' : '✗'} | ${r.valid_count}／${r.raw_count} | ${r.latency_ms} ms | ${r.reason ?? '—'} | ${sample} |`)
      }
    }
  }
  return out.join('\n') + '\n'
}

await (args.eval ? runEval() : tryOnce())

// 用 LLM 產生 12 隻 AI 怪物的名字、台詞、弱點屬性（ROADMAP 6.2），驗證後寫進 src/game/monster-profiles.json。
// 只在開發時跑一次，結果進版控，專案負責人可以直接看、直接改。遊戲執行時不會呼叫 LLM。
//
// 金鑰：和 try-llm.mjs 一樣讀 supabase/functions/.env 的 GROQ_API_KEY（不會進版控，也不會印出來）。
//
// 用法
//   node scripts/gen-monsters.mjs                    四個主題都產生（覆蓋整個檔案）
//   node scripts/gen-monsters.mjs --theme space      只重新產生一個主題，其他主題保留原本的內容
//   node scripts/gen-monsters.mjs --show-prompt      只印出 prompt，不呼叫 API
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { MONSTER_THEMES, PROFILE_LIMITS as L, validateThemeProfiles } from '../src/game/monsterProfile.ts'
import { GROQ_MODEL } from '../supabase/functions/_shared/training/providers.ts'

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url))
const ENV_FILE = root('supabase/functions/.env')
const OUT_FILE = root('src/game/monster-profiles.json')
const PROMPT_VERSION = 'monster-v1'
const TIMEOUT_MS = 30000
/** 每個主題最多試幾次 */
const MAX_TRIES = 3

const { values: args } = parseArgs({
  options: {
    theme: { type: 'string' },
    'show-prompt': { type: 'boolean', default: false },
  },
})

const THEME_HINT = {
  daily: '日常生活（家裡、廚房、通勤、早餐、洗衣服、鬧鐘之類的小麻煩）',
  fantasy: '奇幻冒險（魔法、城堡、地下城、藥水、龍）',
  space: '太空（星球、隕石、外星生物、火箭、黑洞）',
  school: '校園（考試、作業、教室、粉筆、鐘聲）',
}

if (args.theme && !MONSTER_THEMES.includes(args.theme)) {
  console.error(`沒有這個主題：${args.theme}（有：${MONSTER_THEMES.join('、')}）`)
  process.exit(1)
}

function buildPrompt(theme) {
  const system = [
    '你是一款給國高中生玩的英文打字冒險遊戲的角色設計師。遊戲畫風是可愛的手繪貼紙風（粗深紫外框、奶油色背景），玩家是貓、狗等小動物勇者，打英文單字攻擊怪物。',
    '你要設計怪物的名字、出場台詞、弱點屬性和外觀描述。怪物要可愛、有點調皮，不可怕、不血腥、不涉及真實人物或品牌。',
    '只輸出 JSON，不要其他文字。',
  ].join('\n')
  const user = [
    `主題：${THEME_HINT[theme]}`,
    '請設計這個主題的 3 隻怪物，依序是：第 1 隻小怪（最弱）、第 2 隻小怪、第 3 隻魔王（最強，名字可以帶「王」「大魔王」之類的字）。',
    '每隻怪物的欄位：',
    `- name：繁體中文名字，${L.nameMin}～${L.nameMax} 個字，只用中文字，不要英文、標點符號、emoji。`,
    `- line：繁體中文出場台詞，${L.lineMin}～${L.lineMax} 個字，挑釁玩家或和打字有關，語氣可愛。可以用全形標點（！？，～…），不要 emoji。`,
    `- weak_keys：這隻怪物的弱點，${L.weakKeysMin}～${L.weakKeysMax} 個小寫英文字母（a～z），最好和怪物的英文概念有關（例如怕水的怪物是 w）。3 隻的弱點不要完全一樣。`,
    `- look：英文外觀描述，${L.lookMax} 個字元以內，描述牠長什麼樣子（形狀、顏色、特徵），給畫師畫圖用。不要寫背景和畫風。`,
    '輸出格式：{"monsters":[{"name":"...","line":"...","weak_keys":["x"],"look":"..."}, ...]}，monsters 剛好 3 個。',
  ].join('\n')
  return { system, user, temperature: 0.9 }
}

function loadGroqKey() {
  let key = process.env.GROQ_API_KEY ?? ''
  if (existsSync(ENV_FILE)) {
    for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
      const m = /^\s*GROQ_API_KEY\s*=\s*(.*?)\s*$/.exec(line)
      if (m) key = m[1].replace(/^["']|["']$/g, '')
    }
  }
  if (!key) {
    console.error('找不到 GROQ_API_KEY。請在 supabase/functions/.env（不會進版控）寫一行 GROQ_API_KEY=你的金鑰')
    process.exit(1)
  }
  return key
}

const SCHEMA = {
  type: 'object',
  properties: {
    monsters: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, line: { type: 'string' }, weak_keys: { type: 'array', items: { type: 'string' } }, look: { type: 'string' } },
        required: ['name', 'line', 'weak_keys', 'look'],
        additionalProperties: false,
      },
    },
  },
  required: ['monsters'],
  additionalProperties: false,
}

async function callGroq(key, prompt) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: prompt.temperature,
      reasoning_effort: 'low',
      response_format: { type: 'json_schema', json_schema: { name: 'monsters', strict: true, schema: SCHEMA } },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}：${(await response.text()).slice(0, 300)}`)
  const json = await response.json()
  return JSON.parse(json.choices?.[0]?.message?.content ?? '')
}

const themes = args.theme ? [args.theme] : [...MONSTER_THEMES]

if (args['show-prompt']) {
  for (const theme of themes) {
    const p = buildPrompt(theme)
    console.log(`── ${theme} ──\n[system]\n${p.system}\n\n[user]\n${p.user}\n`)
  }
  process.exit(0)
}

const key = loadGroqKey()
const previous = existsSync(OUT_FILE) ? JSON.parse(readFileSync(OUT_FILE, 'utf8')) : null
const generated = {}
for (const theme of themes) {
  const prompt = buildPrompt(theme)
  let done = false
  for (let attempt = 1; attempt <= MAX_TRIES && !done; attempt++) {
    try {
      const raw = await callGroq(key, prompt)
      const v = validateThemeProfiles(raw, theme)
      if (v.ok) {
        generated[theme] = v.profiles
        done = true
        console.log(`✓ ${theme}（第 ${attempt} 次）`)
        for (const p of v.profiles) console.log(`  ${p.id} ${p.boss ? '[魔王] ' : ''}${p.name}｜${p.line}｜弱點 ${p.weakKeys.join(' ')}\n    ${p.look}`)
      } else {
        console.log(`✗ ${theme}（第 ${attempt} 次）驗證失敗：${v.issue}${v.index !== undefined ? `（第 ${v.index + 1} 隻）` : ''}`)
        if (v.index !== undefined) console.log(`  ${JSON.stringify(raw.monsters[v.index])}`)
      }
    } catch (error) {
      console.log(`✗ ${theme}（第 ${attempt} 次）呼叫失敗：${error.message}`)
    }
  }
  if (!done) {
    console.error(`${theme} 試了 ${MAX_TRIES} 次都沒有合格，檔案沒有更動。`)
    process.exit(1)
  }
}

const monsters = MONSTER_THEMES.flatMap((theme) => generated[theme] ?? previous?.monsters.filter((m) => m.theme === theme) ?? [])
if (monsters.length !== 12) {
  console.error(`只有 ${monsters.length} 隻（應該是 12 隻）：第一次產生請不要加 --theme。檔案沒有更動。`)
  process.exit(1)
}
const out = { generated_at: new Date().toISOString(), model: `groq/${GROQ_MODEL}`, prompt_version: PROMPT_VERSION, monsters }
writeFileSync(OUT_FILE, `${JSON.stringify(out, null, 2)}\n`)
console.log(`\n已寫入 ${OUT_FILE}`)

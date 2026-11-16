// 檢查打包結果（dist/）裡沒有不該出現在前端的金鑰。build 之後跑：npm run check:bundle
// 允許的只有 Supabase 的 publishable key（sb_publishable_ 開頭）；其他長得像秘密金鑰的字串都算失敗。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const PATTERNS = [
  ['Supabase secret key', /sb_secret_[A-Za-z0-9_-]{8,}/],
  // 舊格式的 JWT 金鑰：解開 payload 看 role 是不是 service_role
  ['Supabase service_role JWT', /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g],
  ['Anthropic API key', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI API key', /sk-(proj-)?[A-Za-z0-9]{32,}/],
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
  ['Groq API key', /gsk_[A-Za-z0-9]{20,}/],
  ['GitHub token', /gh[pousr]_[A-Za-z0-9]{36,}/],
]

const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path)
    else if (/\.(js|css|html|json|map|txt)$/.test(name)) files.push(path)
  }
}
walk('dist')

const isServiceRole = (jwt) => {
  try {
    return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).role === 'service_role'
  } catch {
    return false
  }
}

let found = 0
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  for (const [label, pattern] of PATTERNS) {
    const matches = text.match(pattern) ?? []
    const bad = label.includes('JWT') ? matches.filter(isServiceRole) : matches
    if (bad.length > 0) {
      found += bad.length
      console.error(`✗ ${file}：發現 ${label}`)
    }
  }
}
const hasCloud = files.some((f) => readFileSync(f, 'utf8').includes('sb_publishable_'))
console.log(`檢查了 ${files.length} 個檔案；${hasCloud ? '有帶入 Supabase 的 publishable key（公開設定）' : '沒有帶入 Supabase 設定（線上版會只有訪客模式）'}`)
if (found > 0) {
  console.error(`打包結果裡有 ${found} 個不該出現的金鑰，停止部署`)
  process.exit(1)
}
console.log('✓ 打包結果裡沒有秘密金鑰')

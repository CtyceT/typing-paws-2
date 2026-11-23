// 產生常用字表 supabase/functions/_shared/training/common-words.ts（LLM 輸出驗證的 rare_word 檢查用）。
// 字表已經進版控，平常不需要重跑；要換大小或來源時才用。
//
// 來源（兩個都要先自己下載，原始檔不進版控）：
//   1. 詞頻：hermitdave/FrequencyWords 的 content/2018/en/en_50k.txt（由 OpenSubtitles 2018 統計；內容授權 CC BY-SA 4.0）
//      https://github.com/hermitdave/FrequencyWords
//   2. 拼字正確的字：SCOWL（Spell Checker Oriented Word Lists）大小 10～50 的 english／american／british 字表，
//      這裡用 npm 套件 wordlist-english@1.2.1 轉好的 JSON（`npm pack wordlist-english@1.2.1` 後解開）
//      http://wordlist.aspell.net/
// 做法：照詞頻由高到低，只留「全小寫英文字母、而且 SCOWL 裡有」的字，取前 20000 個。
//   詞頻表決定「常不常用」，SCOWL 負責濾掉字幕裡的人名、錯字和口語拼法。
//
// 用法：node scripts/build-common-words.mjs <en_50k.txt> <wordlist-english 的 package 資料夾>
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 20000
const SCOWL_SIZES = [10, 20, 35, 40, 50]
const [, , freqFile, scowlDir] = process.argv
if (!freqFile || !scowlDir) {
  console.error('用法：node scripts/build-common-words.mjs <en_50k.txt> <wordlist-english 的 package 資料夾>')
  process.exit(1)
}

const scowl = new Set()
for (const dialect of ['english', 'american', 'british']) {
  for (const size of SCOWL_SIZES) {
    for (const word of JSON.parse(readFileSync(join(scowlDir, `${dialect}-words-${size}.json`), 'utf8'))) scowl.add(word)
  }
}

const words = []
for (const line of readFileSync(freqFile, 'utf8').split('\n')) {
  const word = line.split(' ')[0]
  if (/^[a-z]+$/.test(word) && scowl.has(word)) words.push(word)
  if (words.length === SIZE) break
}
words.sort()

const out = `// 英文常用字表（${words.length} 個字，全小寫，依字母排序）。由 scripts/build-common-words.mjs 產生，請不要手動修改。
//
// 來源與授權
// - 詞頻排序：hermitdave/FrequencyWords（OpenSubtitles 2018 的 en_50k），內容授權 CC BY-SA 4.0。
//   https://github.com/hermitdave/FrequencyWords
// - 字的範圍：SCOWL（Spell Checker Oriented Word Lists）大小 10～50，Copyright 2000-2016 Kevin Atkinson，
//   可自由使用、複製、修改與散布，需保留著作權聲明。http://wordlist.aspell.net/
// 這份字表是由上面兩者衍生的，依 CC BY-SA 4.0 授權（姓名標示－相同方式分享）。
// https://creativecommons.org/licenses/by-sa/4.0/
//
// 只有 Edge Function 和本機腳本會載入這個檔案；前端不載入（約 ${Math.round(words.join(' ').length / 1024)} kB，會讓首頁變大）。
export const COMMON_WORDS: ReadonlySet<string> = new Set(
  '${words.join(' ')}'.split(' '),
)
`
writeFileSync(fileURLToPath(new URL('../supabase/functions/_shared/training/common-words.ts', import.meta.url)), out)
console.log(`寫入 ${words.length} 個字`)

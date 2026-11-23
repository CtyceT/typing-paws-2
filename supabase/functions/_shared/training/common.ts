// 常用字檢查（prompt v2 一起加的驗證）：題目裡的每個字都要在常用字表上，否則不合格原因是 rare_word。
// 這個檔案會載入約 160 kB 的字表，只給 Edge Function 和本機腳本用；前端的驗證不做這一項（題目已經在 Edge Function 檢查過）。
import { COMMON_WORDS } from './common-words.ts'
import type { TrainingTheme } from './request.ts'
import { THEME_WORDS } from './theme-words.ts'

/** 常見的縮寫（字表裡只有純字母的字，所以另外列） */
const CONTRACTIONS: ReadonlySet<string> = new Set(
  (
    "i'm i'll i've i'd you're you'll you've you'd he's he'll he'd she's she'll she'd it's it'll we're we'll we've we'd they're they'll they've they'd " +
    "that's there's here's what's who's where's when's how's let's isn't aren't wasn't weren't don't doesn't didn't can't couldn't won't wouldn't " +
    "shouldn't haven't hasn't hadn't mustn't o'clock"
  ).split(' '),
)

/** 去掉重複的字尾子音：stopp → stop */
const undouble = (stem: string) => (stem.length >= 3 && stem.at(-1) === stem.at(-2) ? stem.slice(0, -1) : stem)

/**
 * 是不是常用字。字表上有就算；另外接受常用字的規則變化（複數、過去式、進行式、比較級、-ly）和常見的縮寫、所有格，
 * 這樣 "castles"、"jumped"、"Beth's" 不會因為字表剛好沒收而被當成冷僻字。
 * 有給 theme 的話，該主題的白名單（theme-words.ts）也算，同樣接受規則變化。
 * word 要先轉成小寫，只含字母與撇號。
 */
export function isCommonWord(word: string, theme?: TrainingTheme): boolean {
  if (word === 'a' || word === 'i') return true
  if (word.includes("'")) {
    if (CONTRACTIONS.has(word)) return true
    return word.endsWith("'s") ? isCommonWord(word.slice(0, -2), theme) : false
  }
  const themeWords = theme ? THEME_WORDS[theme] : undefined
  const has = (w: string) => w.length >= 2 && (COMMON_WORDS.has(w) || themeWords?.has(w) === true)
  if (has(word)) return true
  const tries: string[] = []
  const strip = (suffix: string, ...endings: string[]) => {
    if (!word.endsWith(suffix) || word.length - suffix.length < 3) return
    const stem = word.slice(0, -suffix.length)
    for (const ending of endings) tries.push(stem + ending)
    tries.push(undouble(stem))
  }
  strip('ies', 'y')
  strip('es', '')
  strip('s', '')
  strip('ied', 'y')
  strip('ed', '', 'e')
  strip('ing', '', 'e')
  strip('er', '', 'e')
  strip('est', '', 'e')
  strip('ly', '')
  return tries.some(has)
}

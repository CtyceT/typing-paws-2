// LLM 輸出驗證（ROADMAP 4.5）：JSON 格式、只允許可列印 ASCII、長度限制、不當用字過濾、每題都要含弱點鍵。
import { HARD_MAX_WORDS, ITEM_LENGTH, MIN_ITEMS, TARGET_ITEM_COUNT, type TrainingRequest } from './request.ts'

/** 單一題目不合格的原因 */
export type RejectReason = 'not_string' | 'not_ascii' | 'bad_chars' | 'length' | 'banned_word' | 'missing_target' | 'duplicate'
/** 整份輸出不合格的原因 */
export type OutputError = 'invalid_json' | 'bad_shape' | 'too_few'

export interface ValidationResult {
  /** 合格題數有沒有達到這個難度的門檻 */
  ok: boolean
  /** 合格的題目（最多 TARGET_ITEM_COUNT 題） */
  items: string[]
  /** LLM 原本給了幾題 */
  rawCount: number
  validCount: number
  /** 每一種不合格原因各有幾題 */
  rejects: Partial<Record<RejectReason, number>>
  error: OutputError | null
  /** 主要的不合格原因：整份壞掉時是 error，否則是最多題的那一種原因；都沒有是 null */
  topReason: string | null
}

/**
 * 不能出現在題目裡的字（整個字比對，不比對片段，所以 class、assess 這類字不會被誤判）。
 * 遊戲的對象包含學生，這裡擋的是粗話、性、仇恨、毒品與明顯暴力的字。
 */
export const BANNED_WORDS: ReadonlySet<string> = new Set(
  (
    'ass asses asshole bastard bitch bitches bloody boob boobs bollocks cock cocks crap cum cunt damn dick dicks dildo fag faggot fuck fucked fucker fucking ' +
    'hell horny jerk nazi nigga nigger nude nudes penis piss pissed porn porno prick pussy rape raped rapist retard sex sexy shit shitty slut sluts tit tits ' +
    'twat vagina wank whore kill killed killer killing murder suicide heroin cocaine meth weed drug drugs drunk gun guns bomb terror terrorist stab hate hated'
  ).split(' '),
)

/** 困難難度除了英數與空白之外允許的標點（弱點本身是符號時，該符號也允許） */
const HARD_PUNCTUATION = ",.!?'-"

const countLetters = (s: string) => s.replace(/[^A-Za-z]/g, '').length

/** 檢查一題。合格回傳整理過的題目（去頭尾空白；簡單、普通轉小寫；彎引號換成直的），不合格回傳原因（不含 duplicate） */
export function checkItem(raw: unknown, req: TrainingRequest): { item: string } | { reason: Exclude<RejectReason, 'duplicate'> } {
  if (typeof raw !== 'string') return { reason: 'not_string' }
  let item = raw.trim().replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  if (item === '') return { reason: 'length' }
  if (!/^[\x20-\x7E]+$/.test(item)) return { reason: 'not_ascii' }
  const { min, max } = ITEM_LENGTH[req.difficulty]
  if (req.difficulty === 'hard') {
    const allowed = new Set(HARD_PUNCTUATION + req.weaknesses.join(''))
    for (const ch of item) if (!/[A-Za-z0-9 ]/.test(ch) && !allowed.has(ch)) return { reason: 'bad_chars' }
    if (/ {2}/.test(item) || countLetters(item) < 2) return { reason: 'bad_chars' }
    if (item.length < min || item.length > max || item.split(' ').length > HARD_MAX_WORDS) return { reason: 'length' }
  } else {
    item = item.toLowerCase()
    if (!/^[a-z]+$/.test(item)) return { reason: 'bad_chars' }
    if (item.length < min || item.length > max) return { reason: 'length' }
  }
  const lower = item.toLowerCase()
  if (lower.split(/[^a-z]+/).some((word) => BANNED_WORDS.has(word))) return { reason: 'banned_word' }
  if (!req.weaknesses.some((w) => lower.includes(w))) return { reason: 'missing_target' }
  return { item }
}

/** 檢查一串題目：不合格與重複的丟掉，合格的最多留 TARGET_ITEM_COUNT 題 */
export function validateItems(values: readonly unknown[], req: TrainingRequest): ValidationResult {
  const items: string[] = []
  const seen = new Set<string>()
  const rejects: Partial<Record<RejectReason, number>> = {}
  const reject = (reason: RejectReason) => (rejects[reason] = (rejects[reason] ?? 0) + 1)
  for (const value of values) {
    const checked = checkItem(value, req)
    if ('reason' in checked) reject(checked.reason)
    else if (seen.has(checked.item.toLowerCase())) reject('duplicate')
    else {
      seen.add(checked.item.toLowerCase())
      if (items.length < TARGET_ITEM_COUNT) items.push(checked.item)
    }
  }
  const ok = items.length >= MIN_ITEMS[req.difficulty]
  const top = (Object.entries(rejects) as [RejectReason, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  return { ok, items, rawCount: values.length, validCount: items.length, rejects, error: ok ? null : 'too_few', topReason: top ?? (ok ? null : 'too_few') }
}

const failed = (error: OutputError): ValidationResult => ({ ok: false, items: [], rawCount: 0, validCount: 0, rejects: {}, error, topReason: error })

/** 從 LLM 的文字輸出取出 JSON：容許前後有 ```json 圍欄或多餘的文字 */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('no json')
  return JSON.parse(text.slice(start, end + 1))
}

/** 驗證 LLM 的原始輸出（應該是 {"items": [...]}） */
export function validateTrainingOutput(text: string, req: TrainingRequest): ValidationResult {
  let parsed: unknown
  try {
    parsed = extractJson(text)
  } catch {
    return failed('invalid_json')
  }
  const items = (parsed as { items?: unknown } | null)?.items
  if (!Array.isArray(items)) return failed('bad_shape')
  return validateItems(items, req)
}

/** 打亂順序（不改動原本的陣列）。快取命中時用，同一位玩家重複練才不會每次都是同樣的順序 */
export function shuffled<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// 弱點特訓出題 prompt，版本 v2（2026-11-16）。和 v1 的差別：
// 1. 要求用國中生認得的常用字（v1 偶爾出現 quoth、thymus 這類冷僻字；驗證也同時加了常用字檢查）。
// 2. 困難難度再強調長度限制，並給範例（v1 配數字、符號的弱點時，Gemini 的題目常常超過 24 個字元）。
// 3. 簡單難度只要 20 題（2026-11-23 加，D80）：短單字選擇少，30 題時容易重複。
// v2 是最後一版 prompt（D81），之後不再迭代。
// v1 留在 v1.ts 不要改，`node scripts/try-llm.mjs --eval --prompt v1` 可以重跑來比較。
import { ITEM_COUNT, ITEM_LENGTH, HARD_MAX_WORDS, type TrainingDifficulty, type TrainingRequest, type TrainingTheme } from '../request.ts'
import type { PromptTemplate } from './index.ts'

const SYSTEM = [
  'You are an English typing coach who writes practice material for a typing game played by students.',
  'Follow every rule exactly. Output only JSON, with no markdown and no explanation.',
].join('\n')

const THEME: Readonly<Record<TrainingTheme, string>> = {
  daily: 'everyday life',
  fantasy: 'fantasy adventure',
  space: 'space adventure',
  school: 'school life',
}

const len = ITEM_LENGTH
const DIFFICULTY: Readonly<Record<TrainingDifficulty, string[]>> = {
  easy: [`- Each item is ONE common English word, ${len.easy.min} to ${len.easy.max} letters, lowercase a-z only.`],
  normal: [`- Each item is ONE common English word, ${len.normal.min} to ${len.normal.max} letters, lowercase a-z only.`],
  hard: [
    `- Each item is a short phrase of 2 to ${HARD_MAX_WORDS} words.`,
    `- LENGTH LIMIT: every item must be ${len.hard.max} characters or fewer, counting spaces and punctuation, and never more than ${HARD_MAX_WORDS} words. Aim for 10 to 20 characters. Count each item before you answer and shorten any item that is too long.`,
    "- Capital letters, digits and the punctuation , . ! ? ' - are allowed.",
    '- A target key that is a digit or a symbol must appear literally in the item, inside an otherwise normal short phrase.',
    '- Examples of the right length: "Thank you, team!" (16), "the fourth path" (15), "Is that quiz easy?" (18).',
  ],
}

function user(req: TrainingRequest): string {
  const targets = req.weaknesses.map((w) => JSON.stringify(w)).join(', ')
  return [
    `Write ${ITEM_COUNT[req.difficulty]} practice items for a typing drill.`,
    '',
    `Target keys: ${targets}`,
    '- EVERY item must contain at least one target key.',
    '- Spread the target keys as evenly as you can. A rare letter (such as q, x, z or j) may appear in fewer items.',
    '- Prefer items that contain two or more target keys.',
    '',
    `Difficulty: ${req.difficulty}`,
    ...DIFFICULTY[req.difficulty],
    '',
    `Theme: ${THEME[req.theme]}. Prefer items that fit the theme, but a common word that contains a target key matters more than fitting the theme.`,
    '',
    'Rules:',
    '- Use common words that a middle school student would know. No rare, technical, archaic or literary words.',
    '- Real, correctly spelled English only. No invented words, names of people or places, brand names or abbreviations.',
    '- Family friendly: nothing violent, sexual, hateful or rude.',
    '- No duplicates.',
    '- Plain ASCII only. No accents, emoji or curly quotes.',
    '- If you cannot find enough common words, return fewer items instead of breaking a rule.',
    '',
    'Return exactly this JSON shape: {"items": ["...", "..."]}',
  ].join('\n')
}

export const PROMPT_V2: PromptTemplate = { version: 'v2', temperature: 0.9, system: SYSTEM, user }

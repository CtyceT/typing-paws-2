// 弱點特訓出題 prompt，版本 v1。
// 要調整 prompt 時：複製成 v2.ts、改內容與 version，再到 prompts/index.ts 登記並把 CURRENT_PROMPT_VERSION 換掉。
// 舊版留著不要改，`node scripts/try-llm.mjs --eval --prompt v1` 才能和新版比較合格率（結果在 docs/llm-eval.md）。
import { ITEM_LENGTH, HARD_MAX_WORDS, TARGET_ITEM_COUNT, type TrainingDifficulty, type TrainingRequest, type TrainingTheme } from '../request.ts'
import type { PromptTemplate } from './index.ts'

const SYSTEM = [
  'You are an English typing coach who writes practice material for a typing game.',
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
    `- Each item is a short phrase or sentence of 2 to ${HARD_MAX_WORDS} words, 8 to ${len.hard.max} characters in total (spaces count).`,
    "- Capital letters, digits and the punctuation , . ! ? ' - are allowed.",
    '- A target key that is a digit or a symbol must appear literally in the item.',
  ],
}

function user(req: TrainingRequest): string {
  const targets = req.weaknesses.map((w) => JSON.stringify(w)).join(', ')
  return [
    `Write ${TARGET_ITEM_COUNT} practice items for a typing drill.`,
    '',
    `Target keys: ${targets}`,
    '- EVERY item must contain at least one target key.',
    '- Spread the target keys as evenly as you can. A rare letter (such as q, x, z or j) may appear in fewer items.',
    '- Prefer items that contain two or more target keys.',
    '',
    `Difficulty: ${req.difficulty}`,
    ...DIFFICULTY[req.difficulty],
    '',
    `Theme: ${THEME[req.theme]}. Prefer items that fit the theme, but a real, common word that contains a target key matters more than fitting the theme.`,
    '',
    'Rules:',
    '- Real, correctly spelled English only. No invented words, names or abbreviations.',
    '- Family friendly: nothing violent, sexual, hateful or rude.',
    '- No duplicates.',
    '- Plain ASCII only. No accents, emoji or curly quotes.',
    '- If you cannot find enough real words, return fewer items instead of breaking a rule.',
    '',
    'Return exactly this JSON shape: {"items": ["...", "..."]}',
  ].join('\n')
}

export const PROMPT_V1: PromptTemplate = { version: 'v1', temperature: 0.9, system: SYSTEM, user }

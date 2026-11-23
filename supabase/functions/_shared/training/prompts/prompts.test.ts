import { describe, expect, it } from 'vitest'
import type { TrainingRequest } from '../request.ts'
import { buildTrainingPrompt, CURRENT_PROMPT_VERSION, PROMPTS } from './index.ts'

describe('buildTrainingPrompt', () => {
  const prompt = buildTrainingPrompt({ difficulty: 'normal', theme: 'space', weaknesses: ['q', 'th', 'z'] })
  const v1 = buildTrainingPrompt({ difficulty: 'normal', theme: 'space', weaknesses: ['q', 'th', 'z'] }, 'v1')

  it('包含角色設定、限制條件與 JSON 格式要求', () => {
    expect(prompt.system).toContain('typing coach')
    expect(prompt.system).toContain('Output only JSON')
    expect(prompt.user).toContain('Rules:')
    expect(prompt.user).toContain('Family friendly')
    expect(prompt.user).toContain('Plain ASCII only')
    expect(prompt.user).toContain('{"items": ["...", "..."]}')
  })

  it('帶入弱點、難度與主題', () => {
    expect(prompt.user).toContain('Target keys: "q", "th", "z"')
    expect(prompt.user).toContain('Difficulty: normal')
    expect(prompt.user).toContain('5 to 8 letters')
    expect(prompt.user).toContain('space adventure')
    expect(prompt.user).toContain('Write 30 practice items')
  })

  it('簡單難度只要 20 題（v2 起，D80）；v1 維持 30 題', () => {
    const req: TrainingRequest = { difficulty: 'easy', theme: 'daily', weaknesses: ['q'] }
    expect(buildTrainingPrompt(req, 'v2').user).toContain('Write 20 practice items')
    expect(buildTrainingPrompt(req, 'v1').user).toContain('Write 30 practice items')
    expect(buildTrainingPrompt({ ...req, difficulty: 'hard' }, 'v2').user).toContain('Write 30 practice items')
  })

  it('每題都要含目標，罕見字母可以少一點（不再要求每個目標至少 8 題）', () => {
    expect(prompt.user).toContain('EVERY item must contain at least one target key')
    expect(prompt.user).toContain('may appear in fewer items')
    expect(prompt.user).not.toContain('at least 8')
  })

  it('三種難度的規則不同：簡單 3～6 個字母，困難是片語', () => {
    const easy = buildTrainingPrompt({ difficulty: 'easy', theme: 'daily', weaknesses: ['q'] }).user
    const hard = buildTrainingPrompt({ difficulty: 'hard', theme: 'school', weaknesses: [';'] }).user
    expect(easy).toContain('3 to 6 letters')
    expect(easy).toContain('everyday life')
    expect(hard).toContain('2 to 4 words')
    expect(hard).toContain('Target keys: ";"')
    expect(buildTrainingPrompt({ difficulty: 'hard', theme: 'school', weaknesses: [';'] }, 'v1').user).toContain('8 to 24 characters')
    expect(hard).toContain('school life')
  })

  it('符號目標用 JSON 字串的寫法帶入，不會破壞 prompt 的結構', () => {
    expect(buildTrainingPrompt({ difficulty: 'hard', theme: 'daily', weaknesses: ['"', '\\'] }).user).toContain('Target keys: "\\"", "\\\\"')
  })

  it('v2 是線上的版本；v1 保留著可以比較', () => {
    expect(CURRENT_PROMPT_VERSION).toBe('v2')
    expect(Object.keys(PROMPTS)).toEqual(['v1', 'v2'])
    expect(v1.version).toBe('v1')
    expect(v1.user).not.toContain('middle school')
  })

  it('v2：要求國中生認得的常用字，困難難度強調長度限制', () => {
    expect(prompt.user).toContain('Use common words that a middle school student would know')
    expect(prompt.user).not.toContain('LENGTH LIMIT')
    const hard = buildTrainingPrompt({ difficulty: 'hard', theme: 'school', weaknesses: ['4', ';', 'th'] }).user
    expect(hard).toContain('LENGTH LIMIT: every item must be 24 characters or fewer')
    expect(hard).toContain('never more than 4 words')
    expect(hard).toContain('Count each item before you answer')
  })

  it('有版本號，線上用的版本有登記；不存在的版本會丟出例外', () => {
    expect(prompt.version).toBe(CURRENT_PROMPT_VERSION)
    expect(PROMPTS[CURRENT_PROMPT_VERSION].version).toBe(CURRENT_PROMPT_VERSION)
    expect(prompt.temperature).toBeGreaterThan(0)
    expect(() => buildTrainingPrompt({ difficulty: 'easy', theme: 'daily', weaknesses: ['q'] }, 'v999')).toThrow()
  })
})

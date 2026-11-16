import { describe, expect, it } from 'vitest'
import { buildTrainingPrompt, CURRENT_PROMPT_VERSION, PROMPTS } from './index.ts'

describe('buildTrainingPrompt', () => {
  const prompt = buildTrainingPrompt({ difficulty: 'normal', theme: 'space', weaknesses: ['q', 'th', 'z'] })

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
    expect(hard).toContain('school life')
  })

  it('符號目標用 JSON 字串的寫法帶入，不會破壞 prompt 的結構', () => {
    expect(buildTrainingPrompt({ difficulty: 'hard', theme: 'daily', weaknesses: ['"', '\\'] }).user).toContain('Target keys: "\\"", "\\\\"')
  })

  it('有版本號，線上用的版本有登記；不存在的版本會丟出例外', () => {
    expect(prompt.version).toBe(CURRENT_PROMPT_VERSION)
    expect(PROMPTS[CURRENT_PROMPT_VERSION].version).toBe(CURRENT_PROMPT_VERSION)
    expect(prompt.temperature).toBeGreaterThan(0)
    expect(() => buildTrainingPrompt({ difficulty: 'easy', theme: 'daily', weaknesses: ['q'] }, 'v999')).toThrow()
  })
})

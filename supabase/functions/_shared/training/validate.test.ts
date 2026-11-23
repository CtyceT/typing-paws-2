import { describe, expect, it } from 'vitest'
import type { TrainingRequest } from './request.ts'
import { isCommonWord } from './common.ts'
import { checkItem, extractJson, shuffled, validateItems, validateTrainingOutput } from './validate.ts'

const normal: TrainingRequest = { difficulty: 'normal', theme: 'space', weaknesses: ['q', 'th', 'z'] }
const easy: TrainingRequest = { difficulty: 'easy', theme: 'daily', weaknesses: ['q', 'z'] }
const hard: TrainingRequest = { difficulty: 'hard', theme: 'school', weaknesses: ['th', ';'] }

/** 15 個合格的普通難度單字（5～8 個字母，都含 q、z 或 th） */
const GOOD = ['quartz', 'zipper', 'thrust', 'liquid', 'zodiac', 'thermal', 'quiet', 'zebra', 'theory', 'quest', 'frozen', 'earth', 'equal', 'dozen', 'months']
const out = (items: unknown) => JSON.stringify({ items })

describe('checkItem', () => {
  it('普通難度：一個 5～8 個字母的小寫單字，而且要含弱點鍵', () => {
    expect(checkItem('quartz', normal)).toEqual({ item: 'quartz' })
    expect(checkItem('  Quartz ', normal)).toEqual({ item: 'quartz' })
    expect(checkItem('quiz', normal)).toEqual({ reason: 'length' })
    expect(checkItem('earthquake', normal)).toEqual({ reason: 'length' })
    expect(checkItem('planet', normal)).toEqual({ reason: 'missing_target' })
    expect(checkItem('the moon', normal)).toEqual({ reason: 'bad_chars' })
    expect(checkItem('zero-g', normal)).toEqual({ reason: 'bad_chars' })
    expect(checkItem(42, normal)).toEqual({ reason: 'not_string' })
    expect(checkItem('', normal)).toEqual({ reason: 'length' })
  })

  it('含中文、重音符號、emoji 的題目不合格', () => {
    expect(checkItem('量子quark', normal)).toEqual({ reason: 'not_ascii' })
    expect(checkItem('quétzal', normal)).toEqual({ reason: 'not_ascii' })
    expect(checkItem('zebra🦓', normal)).toEqual({ reason: 'not_ascii' })
  })

  it('簡單難度：3～6 個字母', () => {
    expect(checkItem('zoo', easy)).toEqual({ item: 'zoo' })
    expect(checkItem('quartz', easy)).toEqual({ item: 'quartz' })
    expect(checkItem('qi', easy)).toEqual({ reason: 'length' })
    expect(checkItem('quizzes', easy)).toEqual({ reason: 'length' })
  })

  it('困難難度：片語，可以有大寫與基本標點，最多 4 個字、24 個字元', () => {
    expect(checkItem('Thank you; bye!', hard)).toEqual({ item: 'Thank you; bye!' })
    expect(checkItem('The math test', hard)).toEqual({ item: 'The math test' })
    expect(checkItem('Don’t bother them', hard)).toEqual({ item: "Don't bother them" })
    expect(checkItem('the', hard)).toEqual({ reason: 'length' })
    expect(checkItem('this is the thing that never ends', hard)).toEqual({ reason: 'length' })
    expect(checkItem('one two the four five', hard)).toEqual({ reason: 'length' })
    expect(checkItem('the  path', hard)).toEqual({ reason: 'bad_chars' })
    expect(checkItem('math <b>the</b>', hard)).toEqual({ reason: 'bad_chars' })
    expect(checkItem('lunch break', hard)).toEqual({ reason: 'missing_target' })
    expect(checkItem(';;;;;;;;', hard)).toEqual({ reason: 'bad_chars' })
  })

  it('困難難度：弱點是符號時，該符號可以出現；其他符號不行', () => {
    expect(checkItem('semicolon; done', hard)).toEqual({ item: 'semicolon; done' })
    expect(checkItem('a + b = the sum', hard)).toEqual({ reason: 'bad_chars' })
  })

  it('含禁用字的題目不合格（整個字比對，不會誤判 class 這類字）', () => {
    expect(checkItem('the damn thing', hard)).toEqual({ reason: 'banned_word' })
    expect(checkItem('Shit; the bus', hard)).toEqual({ reason: 'banned_word' })
    expect(checkItem('math class', hard)).toEqual({ item: 'math class' })
    expect(checkItem('assess the path', hard)).toEqual({ item: 'assess the path' })
  })
})

describe('常用字檢查（rare_word）', () => {
  const common = { isCommonWord }

  const school = { ...normal, theme: 'school' as const }

  it('單字題：不在常用字表上的字不合格，並記下是哪個字', () => {
    expect(checkItem('quartz', normal, common)).toEqual({ item: 'quartz' })
    expect(checkItem('zenith', school, common)).toEqual({ reason: 'rare_word', rareWords: ['zenith'] })
    expect(checkItem('quoth', normal, common)).toEqual({ reason: 'rare_word', rareWords: ['quoth'] })
    expect(checkItem('zzzqq', normal, common)).toEqual({ reason: 'rare_word', rareWords: ['zzzqq'] })
  })

  it('全主題通用的放行清單：星期、月份和評估中被誤殺的字，每個主題都算', () => {
    for (const word of ['monday', 'thursday', 'january', 'december', 'mondays', 'pixel', 'pixels', 'kayak', 'theorems', 'xylophone', 'zany', 'max', 'inlet']) {
      expect(isCommonWord(word), word).toBe(true)
    }
    expect(checkItem('Quiz on Thursday', { ...hard, weaknesses: ['th'] }, common)).toEqual({ item: 'Quiz on Thursday' })
  })

  it('主題字白名單：只在該主題不受常用字限制，複數等變化也算', () => {
    expect(checkItem('zenith', normal, common)).toEqual({ item: 'zenith' })
    expect(checkItem('quasars', normal, common)).toEqual({ item: 'quasars' })
    expect(checkItem('quasar', school, common)).toEqual({ reason: 'rare_word', rareWords: ['quasar'] })
    expect(isCommonWord('pulsars', 'space')).toBe(true)
    expect(isCommonWord('enchanted', 'fantasy')).toBe(true)
    expect(isCommonWord('whiteboards', 'school')).toBe(true)
    expect(isCommonWord('whiteboard', 'space')).toBe(false)
    expect(isCommonWord('pulsar')).toBe(false)
  })

  it('沒有給字表時不做這項檢查（前端）', () => {
    expect(checkItem('zenith', normal)).toEqual({ item: 'zenith' })
  })

  it('片語：每個字都要在表上；大小寫、標點、數字不影響', () => {
    expect(checkItem('Thank you; bye!', hard, common)).toEqual({ item: 'Thank you; bye!' })
    expect(checkItem('Room 4; then go', hard, common)).toEqual({ item: 'Room 4; then go' })
    expect(checkItem('the thymus gland', hard, common)).toEqual({ reason: 'rare_word', rareWords: ['thymus'] })
    expect(checkItem('Quoth the raven', hard, common)).toEqual({ reason: 'rare_word', rareWords: ['quoth'] })
  })

  it('常用字的規則變化、縮寫和所有格算常用字', () => {
    for (const word of ['castles', 'jumped', 'running', 'stopped', 'quizzes', 'babies', 'happier', 'quickly', "don't", "it's", "teacher's", 'a', 'i']) {
      expect(isCommonWord(word), word).toBe(true)
    }
    for (const word of ['thymus', 'xyzzy', "xyzzy's", "q'x", 'z', 'th']) expect(isCommonWord(word), word).toBe(false)
  })

  it('其他原因優先：沒有弱點鍵的冷僻字記為 missing_target', () => {
    expect(checkItem('azimuth', { ...normal, weaknesses: ['q'] }, common)).toEqual({ reason: 'missing_target' })
  })

  it('統計不合格原因', () => {
    const r = validateTrainingOutput(JSON.stringify({ items: [...GOOD, 'quoth', 'azimuth', 'quoth', 'zloty'] }), normal, common)
    expect(r).toMatchObject({ ok: true, validCount: 15, rejects: { rare_word: 4 }, topReason: 'rare_word', rareWords: ['quoth', 'azimuth', 'zloty'] })
  })
})

describe('validateTrainingOutput', () => {
  it('正常輸出：全部合格', () => {
    const r = validateTrainingOutput(out(GOOD), normal)
    expect(r).toMatchObject({ ok: true, rawCount: 15, validCount: 15, error: null, topReason: null, rejects: {} })
    expect(r.items).toEqual(GOOD)
  })

  it('格式錯誤：不是 JSON、形狀不對', () => {
    expect(validateTrainingOutput('Sure! Here are your words: quartz, zenith', normal)).toMatchObject({ ok: false, error: 'invalid_json', topReason: 'invalid_json', items: [] })
    expect(validateTrainingOutput('{"items": ["quartz",', normal)).toMatchObject({ ok: false, error: 'invalid_json' })
    expect(validateTrainingOutput('{"words": ["quartz"]}', normal)).toMatchObject({ ok: false, error: 'bad_shape', topReason: 'bad_shape' })
    expect(validateTrainingOutput('{"items": "quartz"}', normal)).toMatchObject({ ok: false, error: 'bad_shape' })
    expect(validateTrainingOutput('', normal)).toMatchObject({ ok: false, error: 'invalid_json' })
  })

  it('容許 JSON 外面包著 markdown 圍欄', () => {
    expect(validateTrainingOutput('```json\n' + out(GOOD) + '\n```', normal).ok).toBe(true)
  })

  it('不合格的題目被丟掉並統計原因；剩下的夠多就算通過', () => {
    const r = validateTrainingOutput(out([...GOOD, '量子', 'planet', 'rocket', 'supercalifragilistic', 'quartz', 'QUARTZ']), normal)
    expect(r.ok).toBe(true)
    expect(r.rawCount).toBe(21)
    expect(r.validCount).toBe(15)
    expect(r.rejects).toEqual({ not_ascii: 1, missing_target: 2, length: 1, duplicate: 2 })
    expect(['missing_target', 'duplicate']).toContain(r.topReason)
  })

  it('合格的不到門檻（普通 15 題）就是 too_few，並回報主要原因', () => {
    const r = validateTrainingOutput(out([...GOOD.slice(0, 14), 'toolongword', 'anotherlongword']), normal)
    expect(r).toMatchObject({ ok: false, error: 'too_few', validCount: 14, topReason: 'length' })
    expect(validateTrainingOutput(out([]), normal)).toMatchObject({ ok: false, error: 'too_few', topReason: 'too_few', rawCount: 0 })
  })

  it('簡單難度的門檻是 10 題', () => {
    const words = ['zoo', 'quiz', 'zip', 'zero', 'zone', 'quit', 'zap', 'zest', 'quad', 'maze']
    expect(validateTrainingOutput(out(words), easy).ok).toBe(true)
    expect(validateTrainingOutput(out(words.slice(0, 9)), easy)).toMatchObject({ ok: false, error: 'too_few' })
  })

  it('簡單難度最多留 20 題（D80）', () => {
    const many = ['zoo', 'quiz', 'zip', 'zero', 'zone', 'quit', 'zap', 'zest', 'quad', 'maze', 'size', 'lazy', 'haze', 'doze', 'quiet', 'quite', 'quote', 'queen', 'zebra', 'prize', 'froze', 'squid', 'aqua', 'fuzz', 'jazz']
    const r = validateItems(many, easy)
    expect(r.rawCount).toBe(25)
    expect(r.items).toHaveLength(20)
  })

  it('最多留 30 題', () => {
    const many = Array.from({ length: 40 }, (_, i) => `quest${String.fromCharCode(97 + (i % 26))}${i >= 26 ? 'a' : ''}`)
    const r = validateItems(many, normal)
    expect(r.rawCount).toBe(40)
    expect(r.items).toHaveLength(30)
  })
})

describe('extractJson / shuffled', () => {
  it('取出文字裡的 JSON 物件', () => {
    expect(extractJson('here: {"items": ["a"]} done')).toEqual({ items: ['a'] })
    expect(() => extractJson('nothing')).toThrow()
  })

  it('打亂順序但內容相同，而且不改動原本的陣列', () => {
    const original = ['a', 'b', 'c', 'd', 'e']
    let seed = 7
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const mixed = shuffled(original, rng)
    expect(original).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect([...mixed].sort()).toEqual(original)
    expect(mixed).not.toEqual(original)
  })
})

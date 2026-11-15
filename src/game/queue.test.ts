import { describe, expect, it } from 'vitest'
import { DIFFICULTY_ORDER } from './difficulty.ts'
import { advanceQueue, createQueue, pickWord, previewWords, RECENT_LIMIT, type WordQueue } from './queue.ts'
import { createSeededRng } from './rng.ts'
import { WORDS } from './words.ts'

/** 用固定種子連續出 n 題 */
function deal(words: readonly string[], seed: number, n: number): string[] {
  const rng = createSeededRng(seed)
  let q = createQueue(words, rng)
  const out = [q.current]
  while (out.length < n) {
    q = advanceQueue(q, words, rng)
    out.push(q.current)
  }
  return out
}

describe('pickWord', () => {
  const words = ['a', 'b', 'c', 'd']

  it('依亂數選字', () => {
    expect(pickWord(words, [], () => 0)).toBe('a')
    expect(pickWord(words, [], () => 0.5)).toBe('c')
    expect(pickWord(words, [], () => 0.999)).toBe('d')
  })

  it('避開 recent 裡的字', () => {
    expect(pickWord(words, ['a', 'b'], () => 0)).toBe('c')
    expect(pickWord(words, ['a', 'b', 'c'], () => 0.999)).toBe('d')
  })

  it('字庫比 recent 小時只避開最近的幾個，仍然選得出來', () => {
    // 4 個字全在 recent 裡：避開最近 3 個，剩下最舊的 'a'
    expect(pickWord(words, ['a', 'b', 'c', 'd'], () => 0.7)).toBe('a')
  })

  it('字庫只有一個字時回傳那個字', () => {
    expect(pickWord(['solo'], ['solo'], () => 0.3)).toBe('solo')
  })

  it('亂數回傳 1 也不會超出範圍', () => {
    expect(pickWord(words, [], () => 1)).toBe('d')
  })

  it('空字庫丟出錯誤', () => {
    expect(() => pickWord([], [], () => 0)).toThrow()
  })
})

describe('createQueue / advanceQueue', () => {
  it('建立時有目前的字、3 個後續字，預覽其中 2 個', () => {
    const q = createQueue(WORDS.easy, createSeededRng(1))
    expect(q.current).not.toBe('')
    expect(q.upcoming).toHaveLength(3)
    expect(previewWords(q)).toEqual(q.upcoming.slice(0, 2))
    expect(q.recent).toEqual([q.current, ...q.upcoming])
  })

  it('換下一個字時，預覽的第一個字變成目前的字', () => {
    const rng = createSeededRng(2)
    const q1 = createQueue(WORDS.normal, rng)
    const q2 = advanceQueue(q1, WORDS.normal, rng)
    expect(q2.current).toBe(q1.upcoming[0])
    expect(q2.upcoming.slice(0, 2)).toEqual(q1.upcoming.slice(1))
    expect(q2.upcoming).toHaveLength(3)
  })

  it('不會修改傳入的佇列', () => {
    const rng = createSeededRng(3)
    const q1 = createQueue(WORDS.easy, rng)
    const snapshot: WordQueue = structuredClone(q1)
    advanceQueue(q1, WORDS.easy, rng)
    expect(q1).toEqual(snapshot)
  })

  it(`recent 最多保留 ${RECENT_LIMIT} 個`, () => {
    const rng = createSeededRng(4)
    let q = createQueue(WORDS.easy, rng)
    for (let i = 0; i < 30; i++) q = advanceQueue(q, WORDS.easy, rng)
    expect(q.recent).toHaveLength(RECENT_LIMIT)
  })

  it('同一個種子可以重現出題順序', () => {
    expect(deal(WORDS.hard, 123, 40)).toEqual(deal(WORDS.hard, 123, 40))
    expect(deal(WORDS.hard, 123, 40)).not.toEqual(deal(WORDS.hard, 124, 40))
  })

  it.each(DIFFICULTY_ORDER)('%s：任何連續 8 題內都不重複', (difficulty) => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const dealt = deal(WORDS[difficulty], seed, 300)
      for (let i = 0; i < dealt.length; i++) {
        const window = dealt.slice(Math.max(0, i - (RECENT_LIMIT - 1)), i)
        expect(window, `seed ${seed} 第 ${i} 題 ${dealt[i]}`).not.toContain(dealt[i])
      }
    }
  })

  it('很小的字庫也不會連續出同一個字', () => {
    const dealt = deal(['x', 'y', 'z'], 9, 100)
    for (let i = 1; i < dealt.length; i++) expect(dealt[i]).not.toBe(dealt[i - 1])
  })
})

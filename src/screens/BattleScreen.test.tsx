import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BattleScreen } from './BattleScreen.tsx'

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'],
  })
})
afterEach(() => vi.useRealTimers())

const COUNTDOWN_MS = 2450
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
const currentWord = () => document.querySelector('[data-word]')!.getAttribute('data-word')!
const typeKey = (key: string) => fireEvent.keyDown(document, { key })
const typeWord = (word: string) => [...word].forEach(typeKey)
const pressEnter = () => fireEvent.keyDown(document, { key: 'Enter' })
const statValue = (label: string) => screen.getByText(label).nextElementSibling!.textContent
const dialog = () => screen.queryByRole('dialog')

const setup = (difficulty: 'easy' | 'normal' | 'hard' = 'easy') => {
  const onExit = vi.fn()
  const onRetry = vi.fn()
  render(<BattleScreen hero="cat" difficulty={difficulty} onExit={onExit} onRetry={onRetry} />)
  return { onExit, onRetry }
}

/** 關掉開場訊息並等倒數結束 */
const startBattle = () => {
  pressEnter()
  advance(COUNTDOWN_MS)
}

describe('開場與倒數', () => {
  it('先顯示開場訊息，這時打字不算', () => {
    setup()
    expect(dialog()).toHaveAccessibleName('小 Bug 蟲 出現了！')
    typeKey(currentWord()[0])
    expect(statValue('準確率')).toBe('100%')
    expect(screen.getByText('60/60')).toBeInTheDocument()
  })

  it('按 Enter 後倒數 3、2、1、GO!，倒數中不計時也不能打字', () => {
    setup()
    pressEnter()
    expect(dialog()).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('3')
    advance(650)
    expect(screen.getByRole('status')).toHaveTextContent('2')
    advance(650)
    expect(screen.getByRole('status')).toHaveTextContent('1')
    typeKey('#')
    advance(650)
    expect(screen.getByRole('status')).toHaveTextContent('GO!')
    advance(500)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(statValue('時間')).toBe('0.0s')
    expect(statValue('準確率')).toBe('100%')
    expect(screen.getByLabelText('打字輸入')).toHaveFocus()
  })
})

describe('鍵盤輸入', () => {
  it('打完一個字會扣怪物血並換下一個字', () => {
    setup()
    startBattle()
    const word = currentWord()
    const next = screen.getByText('下一個 →').nextElementSibling!.textContent
    typeWord(word)
    expect(screen.getByText(`${60 - word.length * 3}/60`)).toBeInTheDocument()
    expect(currentWord()).toBe(next)
    expect(screen.getByText('COMBO').previousElementSibling).toHaveTextContent(String(word.length))
  })

  it('打錯會標紅、Combo 歸零、準確率下降', () => {
    setup()
    startBattle()
    const word = currentWord()
    typeKey(word[0])
    typeKey('#')
    expect(statValue('準確率')).toBe('50%')
    expect(document.querySelectorAll('[data-word] span')[1].className).toMatch(/err/)
    typeKey(word[1])
    expect(document.querySelectorAll('[data-word] span')[1].className).not.toMatch(/err/)
  })

  it('功能鍵與快捷鍵不算打字', () => {
    setup()
    startBattle()
    typeKey('Shift')
    fireEvent.keyDown(document, { key: 'r', ctrlKey: true })
    expect(statValue('準確率')).toBe('100%')
  })

  it('手機鍵盤送來的 input 事件也能打字，全形會轉半形', () => {
    setup()
    startBattle()
    const word = currentWord()
    const input = screen.getByLabelText('打字輸入') as HTMLInputElement
    const fullWidth = String.fromCharCode(word.charCodeAt(0) + 0xfee0)
    fireEvent.input(input, { target: { value: fullWidth + word.slice(1) } })
    expect(input.value).toBe('')
    expect(screen.getByText(`${60 - word.length * 3}/60`)).toBeInTheDocument()
  })

  it('輸入框失去焦點時提示點一下，取回焦點後消失', () => {
    setup()
    startBattle()
    const input = screen.getByLabelText('打字輸入')
    expect(input).toHaveFocus()
    act(() => input.blur())
    expect(screen.getByText(/點一下這裡繼續打字/)).toBeInTheDocument()
    fireEvent.click(document.querySelector('[data-battle=arena]')!)
    expect(input).toHaveFocus()
    expect(screen.queryByText(/點一下這裡繼續打字/)).not.toBeInTheDocument()
  })
})

describe('遊戲迴圈', () => {
  it('時間會前進，怪物蓄力滿了會攻擊', () => {
    setup()
    startBattle()
    advance(3500)
    expect(Number.parseFloat(statValue('時間')!)).toBeGreaterThan(3)
    expect(screen.getByText('⚡ 攻擊蓄力').nextElementSibling!.textContent).toMatch(/^(4\d|50)%$/)
    expect(screen.getByText('100/100')).toBeInTheDocument()
    advance(4000) // 簡單難度 7 秒蓄滿
    expect(screen.getByText('92/100')).toBeInTheDocument()
  })

  it('打倒怪物後跳出過關訊息，繼續後倒數再進下一關，並且補血', () => {
    setup()
    startBattle()
    advance(7500) // 先挨一下，才看得到補血
    expect(screen.getByText('92/100')).toBeInTheDocument()
    while (!screen.queryByText('0/60')) typeWord(currentWord())
    expect(dialog()).not.toBeInTheDocument()
    advance(900)
    expect(dialog()).toHaveAccessibleName('第 1 關 CLEAR！')
    expect(dialog()).toHaveTextContent('喵喵恢復 8 HP')
    expect(dialog()).toHaveTextContent('Typo 幽靈')
    pressEnter()
    expect(dialog()).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('3')
    expect(screen.getByText('第 2 / 3 關 ・ 簡單')).toBeInTheDocument()
    expect(screen.getByText('100/100')).toBeInTheDocument()
    expect(screen.getByText('90/90')).toBeInTheDocument()
    advance(COUNTDOWN_MS)
    typeKey(currentWord()[0])
    expect(screen.getByText('COMBO').previousElementSibling).not.toHaveTextContent(/^0$/)
  })

  it('可以從第一關一路打到通關', () => {
    const { onRetry, onExit } = setup()
    startBattle()
    for (let stage = 1; stage <= 3; stage++) {
      expect(screen.getByText(`第 ${stage} / 3 關 ・ 簡單`)).toBeInTheDocument()
      const maxHp = [60, 90, 140][stage - 1]
      while (!screen.queryByText(`0/${maxHp}`)) typeWord(currentWord())
      if (stage < 3) {
        expect(dialog()).not.toBeInTheDocument() // 每一關都要等一下才跳過關訊息
        advance(900)
        expect(dialog()).toHaveAccessibleName(`第 ${stage} 關 CLEAR！`)
        pressEnter()
        advance(COUNTDOWN_MS)
      }
    }
    expect(dialog()).not.toBeInTheDocument()
    advance(1100)
    expect(dialog()).toHaveAccessibleName('🏆 通關成功！')
    expect(dialog()).toHaveTextContent('簡單模式 ・ 打倒了 Deadline 龍王！')
    expect(dialog()).toHaveTextContent('準確率 100%')
    fireEvent.click(screen.getByRole('button', { name: /回到選單/ }))
    expect(onExit).toHaveBeenCalledTimes(1)
    pressEnter()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('一直不打字會被打倒', () => {
    setup()
    startBattle()
    for (let i = 0; i < 95; i++) advance(1000) // 每 7 秒被打 8 滴血，13 下倒地
    expect(screen.getByText('0/100')).toBeInTheDocument()
    advance(1300)
    expect(dialog()).toHaveAccessibleName('喵喵被打倒了…')
    expect(dialog()).toHaveTextContent('止步於第 1 關（小 Bug 蟲）')
    const time = statValue('時間')
    advance(3000)
    expect(statValue('時間')).toBe(time) // 結束後不再計時
  })
})

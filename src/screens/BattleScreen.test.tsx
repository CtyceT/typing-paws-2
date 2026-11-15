import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BattleScreen } from './BattleScreen.tsx'

const currentWord = () => document.querySelector('[data-word]')!.getAttribute('data-word')!
const typeKey = (key: string) => fireEvent.keyDown(document, { key })
const typeWord = (word: string) => [...word].forEach(typeKey)

describe('戰鬥畫面的鍵盤輸入', () => {
  it('打完一個字會扣怪物血並換下一個字', () => {
    render(<BattleScreen hero="cat" difficulty="easy" onExit={() => {}} />)
    const word = currentWord()
    const next = screen.getByText('下一個 →').nextElementSibling!.textContent
    typeWord(word)
    expect(screen.getByText(`${60 - word.length * 3}/60`)).toBeInTheDocument()
    expect(currentWord()).toBe(next)
    expect(screen.getByText(String(word.length))).toBeInTheDocument() // Combo
  })

  it('打錯會標紅、Combo 歸零、準確率下降', () => {
    render(<BattleScreen hero="cat" difficulty="easy" onExit={() => {}} />)
    const word = currentWord()
    typeKey(word[0])
    typeKey('#')
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-word] span')[1].className).toMatch(/err/)
    typeKey(word[1])
    expect(document.querySelectorAll('[data-word] span')[1].className).not.toMatch(/err/)
  })

  it('功能鍵與快捷鍵不算打字', () => {
    render(<BattleScreen hero="cat" difficulty="easy" onExit={() => {}} />)
    typeKey('Shift')
    fireEvent.keyDown(document, { key: 'r', ctrlKey: true })
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('手機鍵盤送來的 input 事件也能打字，全形會轉半形', () => {
    render(<BattleScreen hero="cat" difficulty="easy" onExit={() => {}} />)
    const word = currentWord()
    const input = screen.getByLabelText('打字輸入') as HTMLInputElement
    const fullWidth = String.fromCharCode(word.charCodeAt(0) + 0xfee0)
    fireEvent.input(input, { target: { value: fullWidth + word.slice(1) } })
    expect(input.value).toBe('')
    expect(screen.getByText(`${60 - word.length * 3}/60`)).toBeInTheDocument()
  })

  it('輸入框失去焦點時提示點一下，取回焦點後消失', () => {
    render(<BattleScreen hero="cat" difficulty="easy" onExit={() => {}} />)
    const input = screen.getByLabelText('打字輸入')
    expect(input).toHaveFocus()
    act(() => input.blur())
    expect(screen.getByText(/點一下這裡繼續打字/)).toBeInTheDocument()
    fireEvent.click(document.querySelector('[data-battle=arena]')!)
    expect(input).toHaveFocus()
    expect(screen.queryByText(/點一下這裡繼續打字/)).not.toBeInTheDocument()
  })
})

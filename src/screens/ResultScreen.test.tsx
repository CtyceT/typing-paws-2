import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BattleResult } from '../game/index.ts'
import { ResultScreen } from './ResultScreen.tsx'

const result = (over: Partial<BattleResult> = {}): BattleResult => ({
  difficulty: 'normal',
  win: true,
  wpm: 52,
  accuracy: 97.3,
  maxCombo: 41,
  score: 5120,
  damage: 464,
  durationMs: 83400,
  stage: 3,
  stars: 3,
  ...over,
})

describe('結算畫面', () => {
  it('通關：標題、副標、開心的勇者、三顆星、六項數據與評語', () => {
    render(<ResultScreen hero="shiba" result={result()} onRetry={() => {}} onMenu={() => {}} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('🏆 通關成功！')
    expect(screen.getByText('普通模式 ・ 打倒了 Deadline 龍王！')).toBeInTheDocument()
    expect(document.querySelector('svg')).toHaveAttribute('data-expression', 'happy')
    expect(screen.getByRole('img', { name: '3 顆星（滿分 3 顆）' })).toBeInTheDocument()
    for (const [label, value] of [['WPM', '52'], ['準確率', '97.3%'], ['最高 Combo', '41'], ['分數', '5120'], ['總傷害', '464'], ['用時', '83.4s']]) {
      expect(screen.getByText(label).previousElementSibling).toHaveTextContent(value)
    }
    expect(screen.getByText(/Combo 大師/)).toBeInTheDocument()
    expect(screen.queryByText(/新紀錄/)).not.toBeInTheDocument()
  })

  it('失敗：顯示被打倒的標題、止步的關卡、受傷的勇者、零顆星', () => {
    render(<ResultScreen hero="panda" result={result({ win: false, stars: 0, stage: 2, accuracy: 80 })} onRetry={() => {}} onMenu={() => {}} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('熊熊被打倒了…')
    expect(screen.getByText('普通模式 ・ 止步於第 2 關（Typo 幽靈）')).toBeInTheDocument()
    expect(document.querySelector('svg')).toHaveAttribute('data-expression', 'hurt')
    expect(screen.getByRole('img', { name: '0 顆星（滿分 3 顆）' })).toBeInTheDocument()
    expect(screen.getByText(/先求穩再求快/)).toBeInTheDocument()
  })

  it('星等不滿時，沒拿到的星星變灰', () => {
    render(<ResultScreen hero="cat" result={result({ stars: 2 })} onRetry={() => {}} onMenu={() => {}} />)
    const stars = [...screen.getByRole('img', { name: /2 顆星/ }).children]
    expect(stars.map((s) => /off/.test(s.className))).toEqual([false, false, true])
  })

  it('新紀錄標示', () => {
    const { rerender } = render(<ResultScreen hero="cat" result={result()} newRecord="wpm" onRetry={() => {}} onMenu={() => {}} />)
    expect(screen.getByText('✨ 新紀錄！最快 WPM ✨')).toBeInTheDocument()
    rerender(<ResultScreen hero="cat" result={result()} newRecord="score" onRetry={() => {}} onMenu={() => {}} />)
    expect(screen.getByText('✨ 新紀錄！最高分 ✨')).toBeInTheDocument()
  })

  it('再挑戰與回選單', () => {
    const [onRetry, onMenu] = [vi.fn(), vi.fn()]
    render(<ResultScreen hero="cat" result={result()} onRetry={onRetry} onMenu={onMenu} />)
    fireEvent.click(screen.getByRole('button', { name: /再挑戰一次/ }))
    fireEvent.click(screen.getByRole('button', { name: /回到選單/ }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onMenu).toHaveBeenCalledTimes(1)
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App.tsx'

beforeEach(() => localStorage.clear())

const heroCard = (name: string) => screen.getByRole('button', { name: new RegExp(`${name}勇者`) })

describe('主選單', () => {
  it('顯示遊戲標題與訪客標示', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('喵喵打字大冒險 2.0')
    expect(screen.getByText('👤 訪客')).toBeInTheDocument()
  })

  it('預設選中喵喵，點別的勇者會換過去', () => {
    render(<App />)
    expect(heroCard('喵喵')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(heroCard('兔兔'))
    expect(heroCard('兔兔')).toHaveAttribute('aria-pressed', 'true')
    expect(heroCard('喵喵')).toHaveAttribute('aria-pressed', 'false')
    expect(document.querySelector('header svg')).toHaveAttribute('data-hero', 'bunny')
  })

  it('重新整理後還記得選的勇者', () => {
    const first = render(<App />)
    fireEvent.click(heroCard('熊熊'))
    first.unmount()
    render(<App />)
    expect(heroCard('熊熊')).toHaveAttribute('aria-pressed', 'true')
  })

  it('經典闖關是選中的模式，其他三個模式標示即將推出', () => {
    render(<App />)
    expect(screen.getByText('經典闖關').parentElement).toHaveAttribute('aria-current', 'true')
    expect(screen.getAllByText('即將推出')).toHaveLength(3)
    for (const name of ['故事模式', '弱點特訓', '每日挑戰']) {
      expect(screen.getByText(name).parentElement).toHaveAttribute('aria-disabled', 'true')
    }
  })

  it('戰績區在沒有紀錄時顯示空狀態', () => {
    render(<App />)
    expect(screen.getByText(/還沒有戰績/)).toBeInTheDocument()
    expect(screen.getAllByText('還沒有紀錄，來當第一次挑戰吧！')).toHaveLength(3)
  })

  it('點難度進入戰鬥畫面，並可以回到選單', () => {
    render(<App />)
    fireEvent.click(heroCard('柴柴'))
    fireEvent.click(screen.getByRole('button', { name: /困難/ }))
    expect(screen.getByText(/柴柴勇者準備挑戰/)).toHaveTextContent('困難')
    expect(screen.queryByText('🐾 選擇你的勇者')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /回選單/ }))
    expect(heroCard('柴柴')).toHaveAttribute('aria-pressed', 'true')
  })
})

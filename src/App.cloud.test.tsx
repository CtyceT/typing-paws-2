import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { AUTH_WAIT_MS, type AuthService } from './cloud/index.ts'
import { ALICE, BOB, fakeCloud } from './test/fakeCloud.ts'

vi.mock('react-chartjs-2', () => ({ Line: () => <div data-testid="chart" /> }))

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/typing-paws-2/')
})
afterEach(() => vi.useRealTimers())

describe('登入與登出', () => {
  it('沒有設定雲端功能時只有訪客標示，沒有登入按鈕', () => {
    render(<App cloud={null} />)
    expect(screen.getByText('👤 訪客')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /登入/ })).not.toBeInTheDocument()
  })

  it('訪客看得到登入按鈕，點了會跳出登入視窗，可以選擇先當訪客', () => {
    const { cloud } = fakeCloud()
    render(<App cloud={cloud} />)
    expect(screen.getByText('👤 訪客')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '🔑 登入' }))
    expect(screen.getByRole('dialog', { name: '登入喵喵打字' })).toHaveTextContent('不登入也可以完整遊玩')
    fireEvent.click(screen.getByRole('button', { name: '先當訪客' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('按 GitHub 登入會跳轉到供應商，導回的網址是網站首頁', () => {
    const { cloud, auth } = fakeCloud()
    render(<App cloud={cloud} />)
    fireEvent.click(screen.getByRole('button', { name: '🔑 登入' }))
    fireEvent.click(screen.getByRole('button', { name: /用 GitHub 登入/ }))
    expect(auth.signIns).toEqual([{ provider: 'github', redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` }])
  })

  it('連不上登入服務時顯示說明，遊戲不受影響', async () => {
    const { cloud, auth } = fakeCloud()
    auth.failSignIn = true
    render(<App cloud={cloud} />)
    fireEvent.click(screen.getByRole('button', { name: '🔑 登入' }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /用 GitHub 登入/ })))
    expect(screen.getByRole('dialog', { name: '登入沒有成功' })).toHaveTextContent('連不上登入服務')
    fireEvent.click(screen.getByRole('button', { name: '先當訪客' }))
    expect(screen.getByText('🐾 選擇你的勇者')).toBeInTheDocument()
  })

  it('已登入時顯示名稱與登出按鈕；登出後回到訪客', () => {
    const { cloud } = fakeCloud(BOB)
    render(<App cloud={cloud} />)
    expect(screen.getByText('bob')).toBeInTheDocument()
    expect(document.querySelector('img[src="https://avatars.example/bob.png"]')).not.toBeNull()
    expect(screen.queryByText('👤 訪客')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '登出' }))
    expect(screen.getByText('👤 訪客')).toBeInTheDocument()
    expect(screen.queryByText('bob')).not.toBeInTheDocument()
  })

  it('登入完成（從供應商導回來）後畫面換成登入者', () => {
    const { cloud, auth } = fakeCloud()
    render(<App cloud={cloud} />)
    act(() => auth.setUser(ALICE))
    expect(screen.getByText('alice')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '登出' })).toBeInTheDocument()
  })

  it('供應商導回來時帶著錯誤：顯示一次說明，並把網址清乾淨', () => {
    window.history.replaceState(null, '', '/typing-paws-2/?error=access_denied&error_description=denied')
    const { cloud } = fakeCloud()
    render(<App cloud={cloud} />)
    expect(screen.getByRole('dialog', { name: '登入沒有成功' })).toHaveTextContent('你取消了登入')
    expect(window.location.search).toBe('')
  })

  it('登入狀態還沒回來時顯示載入中；等太久就先當訪客，之後回來了再切換', () => {
    vi.useFakeTimers()
    let emit: (user: typeof ALICE | null) => void = () => {}
    const slow: AuthService = {
      subscribe(listener) {
        emit = listener
        return () => {}
      },
      signIn: async () => {},
      signOut: async () => {},
    }
    render(<App cloud={{ auth: slow }} />)
    expect(screen.getByRole('status')).toHaveTextContent('載入中')
    act(() => void vi.advanceTimersByTime(AUTH_WAIT_MS))
    expect(screen.getByText('👤 訪客')).toBeInTheDocument()
    act(() => emit(ALICE))
    expect(screen.getByText('alice')).toBeInTheDocument()
  })
})

describe('訪客模式與帳號各自的紀錄', () => {
  const guestHistory = [{ id: 'g1', playedAt: 1790000000000, mode: 'classic', difficulty: 'easy', win: true, wpm: 31, accuracy: 95, maxCombo: 12, score: 1500, damage: 290, durationMs: 60000, stage: 3 }]

  it('訪客的畫面清楚標示是訪客模式、紀錄只存在這個瀏覽器', () => {
    const { cloud } = fakeCloud()
    render(<App cloud={cloud} />)
    expect(screen.getByText('👤 訪客')).toBeInTheDocument()
    expect(screen.getByText(/目前是訪客模式，紀錄只存在這個瀏覽器/)).toBeInTheDocument()
  })

  it('訪客的紀錄不會因為登入就變成帳號的；登出後訪客的紀錄還在', () => {
    localStorage.setItem('typingPaws2.history', JSON.stringify(guestHistory))
    const { cloud, auth } = fakeCloud()
    render(<App cloud={cloud} />)
    expect(screen.getByRole('table')).toHaveTextContent('31')
    act(() => auth.setUser(ALICE))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText(/紀錄會同步到你的帳號/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '登出' }))
    expect(screen.getByRole('table')).toHaveTextContent('31')
  })

  it('登入後選的勇者記在帳號底下，不會改到訪客的選擇', () => {
    const { cloud } = fakeCloud(ALICE)
    render(<App cloud={cloud} />)
    fireEvent.click(screen.getByRole('button', { name: /熊熊勇者/ }))
    expect(localStorage.getItem('typingPaws2.u.user-alice.hero')).toBe('panda')
    expect(localStorage.getItem('typingPaws2.hero')).toBeNull()
  })
})

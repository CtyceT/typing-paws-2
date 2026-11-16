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
    render(<App cloud={{ auth: slow, data: () => fakeCloud().db.data('x') }} />)
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

describe('登入後的雲端同步', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'],
    })
    vi.setSystemTime(new Date(2026, 10, 16, 14, 5))
  })

  const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
  /** 讓背景的同步（Promise）跑完 */
  const settle = () => act(async () => void (await vi.advanceTimersByTimeAsync(0)))
  const pressEnter = () => fireEvent.keyDown(document, { key: 'Enter' })
  const typeWord = () => [...document.querySelector('[data-word]')!.getAttribute('data-word')!].forEach((key) => fireEvent.keyDown(document, { key }))
  const diffCard = (name: string) => screen.getByRole('button', { name: new RegExp(`^.*${name}`) })
  /** 從主選單開始，用簡單難度一路打到通關，停在結算畫面 */
  const winEasy = () => {
    fireEvent.click(diffCard('簡單'))
    pressEnter()
    advance(2450)
    advance(3000)
    for (const hp of [60, 90, 140]) {
      while (!screen.queryByText(`0/${hp}`)) typeWord()
      advance(900)
      if (hp !== 140) {
        pressEnter()
        advance(2450)
      }
    }
    advance(300)
  }
  const backToMenu = () => fireEvent.click(screen.getByRole('button', { name: /回到選單/ }))
  const localHistory = (userId: string) => JSON.parse(localStorage.getItem(`typingPaws2.u.${userId}.history`) ?? '[]') as { id: string }[]

  it('打完一場，雲端出現對應的場次、按鍵統計與最佳紀錄', async () => {
    const { cloud, db } = fakeCloud(ALICE)
    render(<App cloud={cloud} />)
    await settle()
    winEasy()
    await settle()
    const account = db.account(ALICE.id)
    const [local] = localHistory(ALICE.id)
    expect([...account.records.keys()]).toEqual([local.id])
    expect(account.records.get(local.id)).toMatchObject({ difficulty: 'easy', win: true, stage: 3 })
    expect(account.keyStats.size).toBeGreaterThan(10)
    expect([...account.keyStats.values()].every((k) => k.sessionId === local.id)).toBe(true)
    expect(account.best.easy).toMatchObject({ clears: 1 })
    expect(screen.getByRole('status')).toHaveTextContent('☁️ 這場已存到雲端')
    expect(localStorage.getItem(`typingPaws2.u.${ALICE.id}.pending`)).toBeNull()
    backToMenu()
    expect(screen.getByRole('status')).toHaveTextContent('☁️ 已同步')
    // 沒有寫到訪客那一份
    expect(localStorage.getItem('typingPaws2.history')).toBeNull()
  })

  it('訪客打完一場不會連雲端，結算畫面也沒有同步狀態', async () => {
    const { cloud, db } = fakeCloud()
    render(<App cloud={cloud} />)
    winEasy()
    await settle()
    expect(db.calls).toEqual([])
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('typingPaws2.history')!)).toHaveLength(1)
  })

  it('斷網時遊戲不卡住：照常結算並提示尚未同步；重試後補傳', async () => {
    const { cloud, db } = fakeCloud(ALICE)
    render(<App cloud={cloud} />)
    await settle()
    db.offline = true
    winEasy()
    await settle()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('🏆 通關成功！')
    expect(screen.getByRole('status')).toHaveTextContent('這場尚未同步到雲端')
    expect(db.account(ALICE.id).records.size).toBe(0)
    expect(localHistory(ALICE.id)).toHaveLength(1)
    backToMenu()
    expect(screen.getByRole('status')).toHaveTextContent('⚠️ 1 場尚未同步')
    expect(diffCard('簡單')).toHaveTextContent(/通關 1 次/)

    db.offline = false
    fireEvent.click(screen.getByRole('button', { name: '重試' }))
    await settle()
    expect(screen.getByRole('status')).toHaveTextContent('☁️ 已同步')
    expect(db.account(ALICE.id).records.size).toBe(1)
    expect(db.account(ALICE.id).keyStats.size).toBeGreaterThan(10)
  })

  it('沒同步的場次重新整理後還記得，恢復連線時自動補傳', async () => {
    const { cloud, db } = fakeCloud(ALICE)
    const first = render(<App cloud={cloud} />)
    await settle()
    db.offline = true
    winEasy()
    await settle()
    first.unmount()

    render(<App cloud={cloud} />)
    await settle()
    expect(screen.getByRole('status')).toHaveTextContent('⚠️ 1 場尚未同步')
    db.offline = false
    act(() => void window.dispatchEvent(new Event('online')))
    await settle()
    expect(screen.getByRole('status')).toHaveTextContent('☁️ 已同步')
    expect(db.account(ALICE.id).records.size).toBe(1)
  })

  it('選的勇者會存到帳號', async () => {
    const { cloud, db } = fakeCloud(ALICE)
    render(<App cloud={cloud} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /兔兔勇者/ }))
    await settle()
    expect(db.account(ALICE.id).hero).toBe('bunny')
  })

  it('清除紀錄會連雲端一起清；連不上雲端時不清，並顯示說明', async () => {
    const { cloud, db } = fakeCloud(ALICE)
    render(<App cloud={cloud} />)
    await settle()
    winEasy()
    await settle()
    backToMenu()

    db.offline = true
    fireEvent.click(screen.getByRole('button', { name: /清除紀錄/ }))
    expect(screen.getByRole('dialog', { name: '清除所有紀錄？' })).toHaveTextContent('包含已經存到雲端的資料')
    fireEvent.click(screen.getByRole('button', { name: /確定清除/ }))
    await settle()
    expect(screen.getByRole('dialog', { name: '清除沒有成功' })).toBeInTheDocument()
    pressEnter()
    expect(localHistory(ALICE.id)).toHaveLength(1)
    expect(db.account(ALICE.id).records.size).toBe(1)

    db.offline = false
    fireEvent.click(screen.getByRole('button', { name: /清除紀錄/ }))
    fireEvent.click(screen.getByRole('button', { name: /確定清除/ }))
    await settle()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(localHistory(ALICE.id)).toHaveLength(0)
    expect(db.account(ALICE.id).records.size).toBe(0)
    expect(db.account(ALICE.id).best).toEqual({})
    expect(diffCard('簡單')).toHaveTextContent('還沒有紀錄')
  })
})

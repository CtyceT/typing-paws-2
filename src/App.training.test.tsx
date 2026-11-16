import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { WORDS } from './game/index.ts'
import { ALICE, fakeCloud } from './test/fakeCloud.ts'
import { TRAINING_TIMEOUT_MS } from './training/loadTrainingWords.ts'

vi.mock('react-chartjs-2', () => ({ Line: () => <div data-testid="chart" /> }))

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/typing-paws-2/')
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'],
  })
  vi.setSystemTime(new Date(2026, 10, 16, 14, 5))
})
afterEach(() => vi.useRealTimers())

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
const settle = () => act(async () => void (await vi.advanceTimersByTimeAsync(0)))
const pressEnter = () => fireEvent.keyDown(document, { key: 'Enter' })
const currentWord = () => document.querySelector('[data-word]')!.getAttribute('data-word')!
const typeWord = () => [...currentWord()].forEach((key) => fireEvent.keyDown(document, { key }))
const diffCard = (name: string) => screen.getByRole('button', { name: new RegExp(`^.*${name}`) })
const openTraining = () => fireEvent.click(screen.getByRole('button', { name: /弱點特訓/ }))
/** 從開場訊息開始，把簡單難度的三關打完，停在結算畫面 */
const playEasyToWin = () => {
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
/** 先用經典闖關打幾場，累積足夠的按鍵統計（一場簡單難度大約 60～100 次按鍵，門檻是 100 次） */
const CLASSIC_GAMES = 3
const playClassic = () => {
  for (let i = 0; i < CLASSIC_GAMES; i++) {
    fireEvent.click(diffCard('簡單'))
    playEasyToWin()
    fireEvent.click(screen.getByRole('button', { name: /回到選單/ }))
  }
}
/** 特訓面板上「簡單」卡片列出的目標鍵 */
const easyTargets = () => [...diffCard('簡單').querySelectorAll('kbd')].map((k) => k.textContent!)
/** 用目標鍵組出 20 個合格的簡單難度題目（4 個小寫字母） */
const itemsFor = (targets: string[]) =>
  Array.from({ length: 20 }, (_, i) => (targets[i % targets.length] + 'mnop').slice(0, 3) + String.fromCharCode(97 + i))
const localHistory = () => JSON.parse(localStorage.getItem(`typingPaws2.u.${ALICE.id}.history`) ?? '[]') as { mode: string; difficulty: string }[]

describe('弱點特訓：入口', () => {
  it('訪客看到「登入後即可使用」的說明，不會呼叫 AI', async () => {
    const { cloud, training } = fakeCloud()
    render(<App cloud={cloud} />)
    openTraining()
    expect(screen.getByRole('button', { name: /弱點特訓/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByText('登入後即可使用')).toBeInTheDocument()
    expect(screen.getByText(/免費額度是所有玩家共用的/)).toBeInTheDocument()
    expect(screen.queryByText('題目主題')).not.toBeInTheDocument()
    // 說明裡的登入按鈕會打開登入視窗
    fireEvent.click(screen.getAllByRole('button', { name: '🔑 登入' }).at(-1)!)
    expect(screen.getByRole('dialog', { name: '登入喵喵打字' })).toBeInTheDocument()
    expect(training.requests).toEqual([])
  })

  it('沒有設定雲端功能時也看得到說明，只是沒有登入按鈕', async () => {
    render(<App cloud={null} />)
    openTraining()
    expect(screen.getByText('登入後即可使用')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '🔑 登入' })).not.toBeInTheDocument()
  })

  it('登入但資料不足：引導先打經典闖關', async () => {
    const { cloud } = fakeCloud(ALICE)
    render(<App cloud={cloud} />)
    await settle()
    openTraining()
    expect(screen.getByText('資料還不夠')).toBeInTheDocument()
    expect(screen.getByText(/目前統計了 0 次按鍵，累積到 100 次/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /去打經典闖關/ }))
    expect(screen.getByRole('button', { name: /經典闖關/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getAllByText('還沒有紀錄，來當第一次挑戰吧！')).toHaveLength(3)
  })
})

describe('弱點特訓：用 AI 題目戰鬥', () => {
  const setup = async () => {
    const fake = fakeCloud(ALICE)
    render(<App cloud={fake.cloud} />)
    await settle()
    playClassic()
    await settle()
    openTraining()
    return fake
  }

  it('選主題、選難度 → 出題中 → 用 AI 的題目戰鬥 → 結算列出特訓的鍵與前後比較', async () => {
    const { training, db } = await setup()
    const targets = easyTargets()
    expect(targets.length).toBeGreaterThanOrEqual(1)
    expect(targets.length).toBeLessThanOrEqual(3)
    training.items = itemsFor(targets)

    fireEvent.click(screen.getByRole('button', { name: /太空/ }))
    expect(screen.getByRole('button', { name: /太空/ })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(diffCard('簡單'))
    expect(screen.getByRole('status')).toHaveTextContent('AI 正在為你出題…')
    expect(training.requests).toEqual([{ difficulty: 'easy', theme: 'space', weaknesses: targets }])

    await settle()
    // 題目來自 AI，而且都含目標鍵
    expect(training.items).toContain(currentWord())
    expect(WORDS.easy).not.toContain(currentWord())
    playEasyToWin()
    await settle()

    const list = screen.getByRole('list', { name: '這次特訓的弱點' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(targets.length)
    for (const key of targets) expect(within(list).getByText(key, { selector: 'kbd' })).toBeInTheDocument()
    expect(list).toHaveTextContent(/這場錯誤率 0%（打 \d+ 次、錯 0 次）/)
    expect(list).toHaveTextContent(/之前平均 0%|之前沒有資料/)
    expect(screen.getByText(/題目由 AI 針對這些鍵出題/)).toBeInTheDocument()

    // 記成特訓場次；最佳紀錄不受影響（通關次數還是經典的那 3 場）
    expect(localHistory().map((r) => r.mode)).toEqual(['classic', 'classic', 'classic', 'training'])
    expect(JSON.parse(localStorage.getItem(`typingPaws2.u.${ALICE.id}.best`)!).easy.clears).toBe(CLASSIC_GAMES)
    expect(screen.queryByText(/新紀錄/)).not.toBeInTheDocument()
    expect([...db.account(ALICE.id).records.values()].map((r) => r.mode).sort()).toEqual(['classic', 'classic', 'classic', 'training'])

    // 再挑戰一次：沿用同一份題目，不會再請 AI 出題
    fireEvent.click(screen.getByRole('button', { name: /再挑戰一次/ }))
    expect(training.items).toContain(currentWord())
    expect(training.requests).toHaveLength(1)
  })

  it.each([
    ['generation_failed', 'AI 這次沒有出題成功'],
    ['daily_limit', '今天的 AI 出題次數用完了'],
    ['offline', '連不上 AI 出題服務'],
  ] as const)('Function 回錯（%s）：顯示提示，照常用內建字庫開始', async (code, text) => {
    const { training } = await setup()
    training.fail = code
    fireEvent.click(diffCard('簡單'))
    await settle()
    const dialog = screen.getByRole('dialog', { name: '這場先用內建字庫' })
    expect(dialog).toHaveTextContent(text)
    expect(dialog).toHaveTextContent('已經挑出含弱點鍵的字')
    pressEnter()
    expect(WORDS.easy).toContain(currentWord())
    playEasyToWin()
    await settle()
    expect(screen.getByText(/題目來自內建字庫/)).toBeInTheDocument()
    expect(localHistory().at(-1)).toMatchObject({ mode: 'training', difficulty: 'easy' })
  })

  it('AI 一直沒有回應：超過時限自動改用內建字庫，不會卡在出題畫面', async () => {
    const { training } = await setup()
    training.hang = true
    fireEvent.click(diffCard('簡單'))
    await settle()
    expect(screen.getByRole('status')).toHaveTextContent('AI 正在為你出題…')
    await act(async () => void (await vi.advanceTimersByTimeAsync(TRAINING_TIMEOUT_MS)))
    expect(screen.getByRole('dialog', { name: '這場先用內建字庫' })).toHaveTextContent('等太久')
    fireEvent.click(screen.getByRole('button', { name: '回到選單' }))
    expect(screen.getByRole('button', { name: /弱點特訓/ })).toHaveAttribute('aria-current', 'true')
  })

  it('出題中可以取消回到選單；之後才回來的題目不會把畫面切走', async () => {
    const { training } = await setup()
    training.hang = true
    fireEvent.click(diffCard('簡單'))
    fireEvent.click(screen.getByRole('button', { name: '取消，回到選單' }))
    await settle()
    expect(screen.getByText('題目主題')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('AI 回傳不合格的題目（含中文、沒有目標鍵）：前端擋下來，改用內建字庫', async () => {
    const { training } = await setup()
    training.items = ['你好', 'zzzz', '<b>']
    fireEvent.click(diffCard('簡單'))
    await settle()
    expect(screen.getByRole('dialog', { name: '這場先用內建字庫' })).toHaveTextContent('沒有通過檢查')
  })
})

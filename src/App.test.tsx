import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'

// jsdom 沒有 canvas，走勢圖用假的 Line 代替，只檢查交給 Chart.js 的資料
vi.mock('react-chartjs-2', () => ({
  Line: ({ data, ...rest }: { data: { datasets: { data: number[]; pointBackgroundColor: string[] }[] }; 'aria-label'?: string }) => (
    <div
      data-testid="wpm-chart"
      data-chart={rest['aria-label']}
      data-values={JSON.stringify(data.datasets[0].data)}
      data-colors={JSON.stringify(data.datasets[0].pointBackgroundColor)}
    />
  ),
}))

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

  it('點難度進入戰鬥畫面，先看到第一隻怪物的開場訊息', () => {
    render(<App />)
    fireEvent.click(heroCard('柴柴'))
    fireEvent.click(screen.getByRole('button', { name: /困難/ }))
    expect(screen.getByText('第 1 / 3 關 ・ 困難')).toBeInTheDocument()
    expect(screen.getByText('🐾 柴柴勇者')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: '小 Bug 蟲 出現了！' })).toBeInTheDocument()
    expect(screen.queryByText('🐾 選擇你的勇者')).not.toBeInTheDocument()
  })
})

describe('打完一場的紀錄', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'],
    })
    vi.setSystemTime(new Date(2026, 10, 15, 14, 5))
  })
  afterEach(() => vi.useRealTimers())

  const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
  const pressEnter = () => fireEvent.keyDown(document, { key: 'Enter' })
  const currentWord = () => document.querySelector('[data-word]')!.getAttribute('data-word')!
  const typeWord = () => [...currentWord()].forEach((key) => fireEvent.keyDown(document, { key }))
  const diffCard = (name: string) => screen.getByRole('button', { name: new RegExp(`^.*${name}`) })

  /** 從主選單開始，用簡單難度一路打到通關，停在結算畫面 */
  const winEasy = () => {
    fireEvent.click(diffCard('簡單'))
    pressEnter()
    advance(2450)
    advance(3000) // 讓時間走一點，WPM 才不會是 0
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

  /** 進簡單難度後放著不打，直到被打倒，停在結算畫面 */
  const loseEasy = () => {
    fireEvent.click(diffCard('簡單'))
    pressEnter()
    advance(2450)
    for (let i = 0; i < 95; i++) advance(1000)
    advance(1300)
  }

  it('通關後進結算畫面：第一次通關是新紀錄', () => {
    render(<App />)
    winEasy()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('🏆 通關成功！')
    expect(screen.getByText('簡單模式 ・ 打倒了 Deadline 龍王！')).toBeInTheDocument()
    expect(screen.getByText('✨ 新紀錄！最快 WPM ✨')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '3 顆星（滿分 3 顆）' })).toBeInTheDocument()
  })

  it('回選單後難度卡片顯示最佳紀錄，重新整理後還在', () => {
    const first = render(<App />)
    winEasy()
    fireEvent.click(screen.getByRole('button', { name: /回到選單/ }))
    expect(diffCard('簡單')).toHaveTextContent(/🏅 最高分 \d+ ・ 最快 \d+ WPM/)
    expect(diffCard('簡單')).toHaveTextContent(/通關 1 次/)
    expect(diffCard('困難')).toHaveTextContent('還沒有紀錄')
    first.unmount()
    render(<App />)
    expect(diffCard('簡單')).toHaveTextContent(/通關 1 次/)
    expect(JSON.parse(localStorage.getItem('typingPaws2.history')!)).toHaveLength(1)
  })

  it('打完一場後多一筆場次的按鍵統計，場次代號和戰績相同', () => {
    render(<App />)
    winEasy()
    const [record] = JSON.parse(localStorage.getItem('typingPaws2.history')!)
    const rows = JSON.parse(localStorage.getItem('typingPaws2.keyStats')!) as { sessionId: string; kind: string; attempts: number; errors: number; playedAt: number }[]
    expect(new Set(rows.map((r) => r.sessionId))).toEqual(new Set([record.id]))
    expect(rows.every((r) => r.playedAt === record.playedAt)).toBe(true)
    const chars = rows.filter((r) => r.kind === 'char')
    // 簡單難度三隻怪物的血量加起來要打掉 290 點，全部打對：按鍵數 = 各鍵次數的總和，沒有錯誤
    expect(chars.reduce((n, r) => n + r.errors, 0)).toBe(0)
    expect(chars.reduce((n, r) => n + r.attempts, 0)).toBeGreaterThan(20)
    expect(rows.some((r) => r.kind === 'bigram')).toBe(true)
  })

  it('被打倒也會記錄，但不算通關；0 分不算新紀錄', () => {
    render(<App />)
    loseEasy()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('喵喵被打倒了…')
    expect(screen.queryByText(/新紀錄/)).not.toBeInTheDocument()
    const history = JSON.parse(localStorage.getItem('typingPaws2.history')!)
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({ win: false, stage: 1, difficulty: 'easy', mode: 'classic' })
  })

  it('玩 2 場後出現走勢圖，戰績表與結算數據一致（新的在前）', () => {
    render(<App />)
    winEasy()
    const stat = (label: string) => screen.getByText(label).previousElementSibling!.textContent!
    const [wpm, accuracy] = [stat('WPM'), stat('準確率')]
    fireEvent.click(screen.getByRole('button', { name: /回到選單/ }))
    expect(screen.queryByTestId('wpm-chart')).not.toBeInTheDocument()
    expect(screen.getByText('玩 2 場以上就會畫出你的進步曲線 📈')).toBeInTheDocument()
    let rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(1)
    expect([...rows[0].children].map((c) => c.textContent)).toEqual(['11/15 14:05', '簡單', '🏆', wpm, accuracy])

    loseEasy()
    fireEvent.click(screen.getByRole('button', { name: /回到選單/ }))
    rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(rows[0].children[2]).toHaveTextContent('💀 1關')
    expect(rows[1].children[2]).toHaveTextContent('🏆')
    const chart = screen.getByTestId('wpm-chart')
    expect(JSON.parse(chart.getAttribute('data-values')!)).toEqual([Number(wpm), 0])
    expect(JSON.parse(chart.getAttribute('data-colors')!)).toEqual(['#6fd6b0', '#ff8fab'])
    expect(screen.getByText(`最高 ${wpm} ・ 綠點＝通關`)).toBeInTheDocument()
    expect(screen.queryByText(/還沒有戰績/)).not.toBeInTheDocument()
  })

  it('再挑戰一次會用同樣的難度重新開始', () => {
    render(<App />)
    loseEasy()
    fireEvent.click(screen.getByRole('button', { name: /再挑戰一次/ }))
    expect(screen.getByText('第 1 / 3 關 ・ 簡單')).toBeInTheDocument()
    expect(screen.getByText('100/100')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: '小 Bug 蟲 出現了！' })).toBeInTheDocument()
  })

  it('放棄回選單不會記錄', () => {
    render(<App />)
    fireEvent.click(diffCard('簡單'))
    pressEnter()
    advance(2450)
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: /放棄回選單/ }))
    expect(localStorage.getItem('typingPaws2.history')).toBeNull()
  })

  it('清除紀錄要先確認；取消不會清，確定後回到空狀態且勇者還在', () => {
    render(<App />)
    fireEvent.click(heroCard('兔兔'))
    winEasy()
    fireEvent.click(screen.getByRole('button', { name: /回到選單/ }))
    fireEvent.click(screen.getByRole('button', { name: /清除紀錄/ }))
    expect(screen.getByRole('dialog', { name: '清除所有紀錄？' })).toBeInTheDocument()
    pressEnter() // Enter 是「先不要」
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(diffCard('簡單')).toHaveTextContent(/通關 1 次/)

    fireEvent.click(screen.getByRole('button', { name: /清除紀錄/ }))
    fireEvent.click(screen.getByRole('button', { name: /確定清除/ }))
    expect(diffCard('簡單')).toHaveTextContent('還沒有紀錄')
    expect(localStorage.getItem('typingPaws2.history')).toBeNull()
    expect(localStorage.getItem('typingPaws2.best')).toBeNull()
    expect(localStorage.getItem('typingPaws2.keyStats')).toBeNull()
    expect(heroCard('兔兔')).toHaveAttribute('aria-pressed', 'true')
  })

  it('沒有紀錄時按清除不會跳確認', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /清除紀錄/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('數據儀表板', () => {
  it('從主選單進入，沒有資料時顯示引導文字，可以返回', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /數據儀表板/ }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('📊 數據儀表板')
    expect(screen.getByText('還沒有數據')).toBeInTheDocument()
    expect(screen.queryByText('場數')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /去打一場/ }))
    expect(screen.getByText('🐾 選擇你的勇者')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /數據儀表板/ }))
    fireEvent.click(screen.getByRole('button', { name: /回到選單/ }))
    expect(screen.getByText('🐾 選擇你的勇者')).toBeInTheDocument()
  })

  it('有戰績時顯示總覽數字', () => {
    localStorage.setItem(
      'typingPaws2.history',
      JSON.stringify([
        { id: 'a', playedAt: 1, mode: 'classic', difficulty: 'easy', win: true, wpm: 40, accuracy: 96, maxCombo: 20, score: 3000, damage: 290, durationMs: 60000, stage: 3 },
        { id: 'b', playedAt: 2, mode: 'classic', difficulty: 'hard', win: false, wpm: 30, accuracy: 90, maxCombo: 9, score: 400, damage: 80, durationMs: 30000, stage: 1 },
      ]),
    )
    localStorage.setItem(
      'typingPaws2.keyStats',
      JSON.stringify([{ id: 'a:char:e', sessionId: 'a', playedAt: 1, kind: 'char', key: 'e', attempts: 25, errors: 2, timedCount: 20, totalMs: 4000 }]),
    )
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /數據儀表板/ }))
    expect(screen.queryByText('還沒有數據')).not.toBeInTheDocument()
    const stat = (label: string) => screen.getByText(label).previousElementSibling!.textContent
    expect([stat('場數'), stat('通關'), stat('平均 WPM'), stat('平均準確率'), stat('統計按鍵數')]).toEqual(['2', '1', '35', '93%', '25'])
  })

  const seedKeyStats = (rows: [key: string, attempts: number, errors: number][], kind = 'char') =>
    localStorage.setItem(
      'typingPaws2.keyStats',
      JSON.stringify(rows.map(([key, attempts, errors]) => ({ id: `a:${kind}:${key}`, sessionId: 'a', playedAt: 1, kind, key, attempts, errors, timedCount: attempts - errors, totalMs: (attempts - errors) * 200 }))),
    )
  const heatKey = (key: string) => document.querySelector(`[data-key="${key}"]`)!

  it('鍵盤熱力圖：常打錯的鍵等級比較高，移到按鍵上看得到數字', () => {
    seedKeyStats([
      ['e', 40, 10],
      ['a', 40, 0],
      ['!', 6, 3],
    ])
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /數據儀表板/ }))
    expect(screen.getByRole('group', { name: '鍵盤熱力圖' })).toBeInTheDocument()
    expect(heatKey('e')).toHaveAttribute('data-level', '5')
    expect(heatKey('a')).toHaveAttribute('data-level', '1')
    expect(heatKey('1')).toHaveAttribute('data-level', '5') // ! 併到 1 那顆鍵
    expect(heatKey('z')).toHaveAttribute('data-level', '0')

    expect(screen.getByText(/把滑鼠移到按鍵上/)).toBeInTheDocument()
    fireEvent.mouseEnter(heatKey('e'))
    expect(screen.getByText('E：打了 40 次・錯 10 次（25%）・平均 200 ms')).toBeInTheDocument()
    fireEvent.mouseLeave(screen.getByRole('group', { name: '鍵盤熱力圖' }))
    expect(screen.getByText(/把滑鼠移到按鍵上/)).toBeInTheDocument()
    fireEvent.focus(heatKey('z'))
    expect(screen.getByText('Z：還沒有資料')).toBeInTheDocument()
  })

  it('弱點排行榜：內容和弱點分析的結果一致，最弱的排第一', () => {
    const letters: [string, number, number][] = [...'abcdfghijk'].map((k) => [k, 30, 0])
    seedKeyStats([...letters, ['q', 20, 8], ['z', 20, 4], ['e', 40, 2]])
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /數據儀表板/ }))
    const items = within(screen.getByRole('list', { name: '弱點排行榜' })).getAllByRole('listitem')
    expect(items.map((li) => li.getAttribute('data-weakness'))).toEqual(['char:q', 'char:z'])
    expect(items[0]).toHaveTextContent('字母')
    expect(items[0]).toHaveTextContent('常打錯')
    expect(items[0]).toHaveTextContent('錯誤率 40%（打 20 次、錯 8 次）')
    expect(items[0]).toHaveTextContent('平均 200 ms')
    expect(items[1]).toHaveTextContent('錯誤率 20%（打 20 次、錯 4 次）')
  })

  it('弱點排行榜：資料不足與沒有弱點時顯示說明', () => {
    seedKeyStats([['q', 20, 8]])
    const first = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /數據儀表板/ }))
    expect(screen.getByText(/目前統計了 20 次按鍵，累積到 100 次就會開始分析弱點/)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: '弱點排行榜' })).not.toBeInTheDocument()
    first.unmount()

    seedKeyStats([...'abcdfghijk'].map((k) => [k, 30, 0]))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /數據儀表板/ }))
    expect(screen.getByText(/目前沒有明顯的弱點/)).toBeInTheDocument()
  })

  it('趨勢圖：畫出 WPM 與準確率，可以切換最近 10 場與全部', () => {
    const history = Array.from({ length: 12 }, (_, i) => ({
      id: `g${i}`, playedAt: i + 1, mode: 'classic', difficulty: 'easy', win: i % 2 === 0, wpm: 30 + i, accuracy: 90 + i * 0.5, maxCombo: 5, score: 100, damage: 50, durationMs: 30000, stage: 3,
    }))
    localStorage.setItem('typingPaws2.history', JSON.stringify(history))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /數據儀表板/ }))
    const values = (name: string) => JSON.parse(document.querySelector(`[data-chart="${name} 趨勢"]`)!.getAttribute('data-values')!)
    expect(screen.getByRole('button', { name: '最近 10 場' })).toHaveAttribute('aria-pressed', 'true')
    expect(values('WPM')).toEqual([32, 33, 34, 35, 36, 37, 38, 39, 40, 41])
    expect(values('準確率')).toEqual([91, 91.5, 92, 92.5, 93, 93.5, 94, 94.5, 95, 95.5])

    fireEvent.click(screen.getByRole('button', { name: '全部（12 場）' }))
    expect(screen.getByRole('button', { name: '全部（12 場）' })).toHaveAttribute('aria-pressed', 'true')
    expect(values('WPM')).toHaveLength(12)
    expect(values('WPM')[0]).toBe(30)
    // 表格檢視的列數和圖上的點一樣多
    expect(screen.getAllByRole('row', { hidden: true })).toHaveLength(13)
  })

  it('只有從 1.0 匯入的戰績、沒有按鍵統計時，熱力圖顯示說明', () => {
    localStorage.setItem(
      'typingPaws2.history',
      JSON.stringify([{ id: 'v1-1-0', playedAt: 1, mode: 'classic', difficulty: 'easy', win: true, wpm: 40, accuracy: 96, maxCombo: 20, score: 3000, damage: null, durationMs: null, stage: 3 }]),
    )
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /數據儀表板/ }))
    expect(screen.getByText('場數')).toBeInTheDocument()
    expect(screen.getByText(/還沒有按鍵統計/)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: '鍵盤熱力圖' })).not.toBeInTheDocument()
  })
})

describe('匯入 1.0 舊紀錄', () => {
  const LEGACY_KEY = 'typingPaws.v1'
  const LEGACY_RAW = JSON.stringify({
    avatar: 'panda',
    best: { easy: { score: 3210, wpm: 45, combo: 31, acc: 96.5, clears: 2 } },
    history: [
      { t: 1790000000000, diff: 'easy', win: true, wpm: 45, acc: 96.5, combo: 31, score: 3210, stage: 3 },
      { t: 1790000100000, diff: 'hard', win: false, wpm: 30, acc: 80, combo: 9, score: 400, stage: 1 },
    ],
  })
  const dialog = () => screen.queryByRole('dialog', { name: '發現 1.0 版的舊紀錄' })

  it('沒有舊紀錄時不會詢問', () => {
    render(<App />)
    expect(dialog()).not.toBeInTheDocument()
    expect(localStorage.getItem('typingPaws2.legacyImport')).toBeNull()
  })

  it('選擇匯入後看得到舊的勇者與戰績，之後不再詢問，舊紀錄沒有被改動', () => {
    localStorage.setItem(LEGACY_KEY, LEGACY_RAW)
    const first = render(<App />)
    expect(dialog()).toHaveTextContent('找到 勇者「熊熊」、2 場戰績、最佳紀錄')
    fireEvent.click(screen.getByRole('button', { name: /匯入/ }))
    expect(dialog()).not.toBeInTheDocument()
    expect(heroCard('熊熊')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^.*簡單/ })).toHaveTextContent('🏅 最高分 3210 ・ 最快 45 WPM')
    expect(screen.getByRole('button', { name: /^.*簡單/ })).toHaveTextContent('通關 2 次')
    expect(JSON.parse(localStorage.getItem('typingPaws2.history')!)).toHaveLength(2)
    expect(localStorage.getItem(LEGACY_KEY)).toBe(LEGACY_RAW)

    first.unmount()
    render(<App />)
    expect(dialog()).not.toBeInTheDocument()
    expect(heroCard('熊熊')).toHaveAttribute('aria-pressed', 'true')
    expect(JSON.parse(localStorage.getItem('typingPaws2.history')!)).toHaveLength(2)
  })

  it('選擇略過就不匯入，之後也不再詢問，舊紀錄沒有被改動', () => {
    localStorage.setItem(LEGACY_KEY, LEGACY_RAW)
    const first = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '略過' }))
    expect(dialog()).not.toBeInTheDocument()
    expect(heroCard('喵喵')).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('typingPaws2.history')).toBeNull()
    expect(localStorage.getItem('typingPaws2.legacyImport')).toBe('skipped')
    expect(localStorage.getItem(LEGACY_KEY)).toBe(LEGACY_RAW)

    first.unmount()
    render(<App />)
    expect(dialog()).not.toBeInTheDocument()
  })
})

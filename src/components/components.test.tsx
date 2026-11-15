import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HERO_EXPRESSIONS, HERO_ORDER, INK } from '../game/index.ts'
import { Button, Card, HeroAvatar, MessageDialog, ProgressBar, Tag } from './index.ts'

describe('Button', () => {
  it('預設是 type="button"，點擊會呼叫 onClick', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>開始</Button>)
    const btn = screen.getByRole('button', { name: '開始' })
    expect(btn).toHaveAttribute('type', 'button')
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('不同樣式有不同的 class，並保留外部傳入的 class', () => {
    render(
      <>
        <Button>a</Button>
        <Button variant="ghost" size="small" className="extra">
          b
        </Button>
      </>,
    )
    const a = screen.getByRole('button', { name: 'a' })
    const b = screen.getByRole('button', { name: 'b' })
    expect(b.className).not.toBe(a.className)
    expect(b).toHaveClass('extra')
  })
})

describe('Card', () => {
  it('顯示內容並轉交屬性', () => {
    render(<Card data-testid="c">內容</Card>)
    expect(screen.getByTestId('c')).toHaveTextContent('內容')
  })
})

describe('Tag', () => {
  it('顯示文字', () => {
    render(<Tag tone="hard">困難</Tag>)
    expect(screen.getByText('困難')).toBeInTheDocument()
  })
})

describe('ProgressBar', () => {
  it('依 value 設定寬度與無障礙數值', () => {
    render(<ProgressBar tone="player" value={0.64} label="勇者血量" />)
    const bar = screen.getByRole('progressbar', { name: '勇者血量' })
    expect(bar).toHaveAttribute('aria-valuenow', '64')
    expect(bar.firstElementChild).toHaveStyle({ width: '64%' })
  })

  it('超出範圍或不是數字時夾在 0～100%', () => {
    render(
      <>
        <ProgressBar tone="monster" value={1.8} label="over" />
        <ProgressBar tone="monster" value={-1} label="under" />
        <ProgressBar tone="charge" value={NaN} label="nan" />
      </>,
    )
    expect(screen.getByRole('progressbar', { name: 'over' })).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByRole('progressbar', { name: 'under' })).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByRole('progressbar', { name: 'nan' })).toHaveAttribute('aria-valuenow', '0')
  })
})

describe('MessageDialog', () => {
  const setup = (open = true) => {
    const onPrimary = vi.fn()
    const onGhost = vi.fn()
    const view = render(
      <MessageDialog
        open={open}
        emoji="⏸"
        title="暫停中"
        text={'第一行\n第二行'}
        buttons={[
          { label: '繼續', primary: true, onClick: onPrimary },
          { label: '放棄', onClick: onGhost },
        ]}
      />,
    )
    return { onPrimary, onGhost, ...view }
  }

  it('關閉時不顯示', () => {
    setup(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('顯示標題、分行的內文與按鈕', () => {
    setup()
    const dialog = screen.getByRole('dialog', { name: '暫停中' })
    expect(dialog).toHaveTextContent('第一行第二行')
    expect(dialog.querySelectorAll('br')).toHaveLength(1)
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('點按鈕呼叫對應的動作', () => {
    const { onPrimary, onGhost } = setup()
    fireEvent.click(screen.getByRole('button', { name: '放棄' }))
    expect(onGhost).toHaveBeenCalledTimes(1)
    expect(onPrimary).not.toHaveBeenCalled()
  })

  it('按 Enter 觸發主要按鈕，其他按鍵不會', () => {
    const { onPrimary } = setup()
    fireEvent.keyDown(document, { key: 'a' })
    expect(onPrimary).not.toHaveBeenCalled()
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(onPrimary).toHaveBeenCalledTimes(1)
  })

  it('關閉後 Enter 不再觸發', () => {
    const { onPrimary, unmount } = setup()
    unmount()
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(onPrimary).not.toHaveBeenCalled()
  })
})

describe('HeroAvatar', () => {
  const svgOf = (container: HTMLElement) => container.querySelector('svg')!

  it('每位勇者、每種表情都畫得出來，而且只畫一組表情', () => {
    for (const hero of HERO_ORDER) {
      for (const expression of HERO_EXPRESSIONS) {
        const { container, unmount } = render(<HeroAvatar hero={hero} expression={expression} />)
        const svg = svgOf(container)
        expect(svg).toHaveAttribute('viewBox', '0 0 120 124')
        expect(svg).toHaveAttribute('data-hero', hero)
        expect(svg).toHaveAttribute('data-expression', expression)
        expect(svg.querySelectorAll(':scope > g:last-child')).toHaveLength(1)
        unmount()
      }
    }
  })

  it('預設是一般表情，四種表情的五官都不同', () => {
    const faces = HERO_EXPRESSIONS.map((expression) => {
      const { container, unmount } = render(<HeroAvatar hero="cat" expression={expression} />)
      const html = svgOf(container).lastElementChild!.innerHTML
      unmount()
      return html
    })
    expect(new Set(faces).size).toBe(4)
    const { container } = render(<HeroAvatar hero="cat" />)
    expect(svgOf(container)).toHaveAttribute('data-expression', 'normal')
    expect(svgOf(container).lastElementChild!.innerHTML).toBe(faces[0])
  })

  it('四位勇者的外觀都不同', () => {
    const bodies = HERO_ORDER.map((hero) => {
      const { container, unmount } = render(<HeroAvatar hero={hero} />)
      const html = svgOf(container).innerHTML
      unmount()
      return html
    })
    expect(new Set(bodies).size).toBe(4)
  })

  it('熊貓的眼睛是白色（畫在黑眼圈上），其他勇者是深紫色', () => {
    const eyeFill = (hero: 'cat' | 'panda') => {
      const { container, unmount } = render(<HeroAvatar hero={hero} />)
      const fill = svgOf(container).lastElementChild!.firstElementChild!.getAttribute('fill')
      unmount()
      return fill
    }
    expect(eyeFill('panda')).toBe('#ffffff')
    expect(eyeFill('cat')).toBe(INK)
  })

  it('是裝飾用圖片（aria-hidden），並保留外部傳入的 class 與屬性', () => {
    const { container } = render(<HeroAvatar hero="bunny" className="extra" data-testid="av" />)
    const svg = svgOf(container)
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveClass('extra')
    expect(svg).toHaveAttribute('data-testid', 'av')
  })
})

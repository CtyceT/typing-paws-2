import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button, Card, MessageDialog, ProgressBar, Tag } from './index.ts'

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

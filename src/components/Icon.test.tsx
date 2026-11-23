import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ICON_NAMES } from '../game/index.ts'
import { Icon } from './Icon.tsx'
import { ICON_PATHS } from './icon-paths.ts'
import { StickerIcon } from './StickerIcon.tsx'

describe('Icon', () => {
  it('每個圖示代號都有 Duotone 的兩層形狀（淡色色塊＋線條）', () => {
    expect(Object.keys(ICON_PATHS).sort()).toEqual([...ICON_NAMES].sort())
    for (const name of ICON_NAMES) {
      const [light, line] = ICON_PATHS[name]
      expect(light, name).toMatch(/^M/)
      expect(line, name).toMatch(/^M/)
    }
  })

  it('有 label：是獨立的圖示，螢幕閱讀器念得出來', () => {
    render(<Icon name="pause" label="暫停" />)
    expect(screen.getByRole('img', { name: '暫停' })).toHaveAttribute('data-icon', 'pause')
  })

  it('沒有 label：旁邊有文字，圖示本身對輔助科技隱藏，不影響按鈕的名稱', () => {
    render(
      <button type="button">
        <Icon name="key" /> 登入
      </button>,
    )
    expect(screen.getByRole('button', { name: '登入' }).querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

describe('StickerIcon', () => {
  it('色塊加上圖示；有 label 時念得出來，沒有時隱藏', () => {
    const { container, rerender } = render(<StickerIcon name="trophy" tone="lilac" />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('svg')).toHaveAttribute('data-icon', 'trophy')
    rerender(<StickerIcon name="trophy" tone="lilac" label="三關闖關" />)
    expect(screen.getByRole('img', { name: '三關闖關' })).toBeInTheDocument()
  })
})

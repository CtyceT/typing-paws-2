import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { monsterById } from '../game/index.ts'

// monster-01 假裝有圖、其他還沒有圖
vi.mock('./monsterImages.ts', () => ({
  monsterImageUrl: (id: string) => (id === 'monster-01' ? '/fake/monster-01.webp' : undefined),
  preloadMonsterImages: () => {},
}))
const { MonsterSprite } = await import('./MonsterSprite.tsx')

describe('MonsterSprite', () => {
  it('有圖：顯示圖片，名字放在 aria-label', () => {
    render(<MonsterSprite monster={monsterById('monster-01')} />)
    const sprite = screen.getByRole('img', { name: monsterById('monster-01').name })
    expect(sprite.querySelector('img')).toHaveAttribute('src', '/fake/monster-01.webp')
  })

  it('圖載入失敗：改顯示 emoji，之後重新建立也不再重試', () => {
    const m = monsterById('monster-01')
    const { unmount } = render(<MonsterSprite monster={m} />)
    fireEvent.error(screen.getByRole('img', { name: m.name }).querySelector('img')!)
    expect(screen.getByRole('img', { name: m.name })).toHaveTextContent(m.emoji)
    unmount()
    render(<MonsterSprite monster={m} anim="hit" />)
    expect(screen.getByRole('img', { name: m.name }).querySelector('img')).toBeNull()
  })

  it('還沒有圖：顯示佔位圖，魔王戴皇冠', () => {
    const { container, rerender } = render(<MonsterSprite monster={monsterById('monster-07')} />)
    expect(container.querySelector('[data-placeholder]')).toHaveTextContent('07')
    expect(container.querySelectorAll('svg path')).toHaveLength(2)
    rerender(<MonsterSprite monster={monsterById('monster-09')} />)
    expect(container.querySelectorAll('svg path')).toHaveLength(3)
  })
})

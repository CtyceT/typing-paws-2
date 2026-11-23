import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { themeLineup } from '../game/index.ts'
import { BattleScreen } from './BattleScreen.tsx'

const DAILY = themeLineup('daily')

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'],
  })
})
afterEach(() => vi.useRealTimers())

const COUNTDOWN_MS = 2450
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
const currentWord = () => document.querySelector('[data-word]')!.getAttribute('data-word')!
const typeKey = (key: string) => fireEvent.keyDown(document, { key })
const typeWord = (word: string) => [...word].forEach(typeKey)
const pressEnter = () => fireEvent.keyDown(document, { key: 'Enter' })
const statValue = (label: string) => screen.getByText(label).nextElementSibling!.textContent
const dialog = () => screen.queryByRole('dialog')

const setup = (difficulty: 'easy' | 'normal' | 'hard' = 'easy') => {
  const onExit = vi.fn()
  const onFinish = vi.fn()
  render(<BattleScreen hero="cat" difficulty={difficulty} onExit={onExit} onFinish={onFinish} />)
  return { onExit, onFinish }
}

/** 關掉開場訊息並等倒數結束 */
const startBattle = () => {
  pressEnter()
  advance(COUNTDOWN_MS)
}

describe('開場與倒數', () => {
  it('先顯示開場訊息，這時打字不算', () => {
    setup()
    expect(dialog()).toHaveAccessibleName(`${DAILY[0].name} 出現了！`)
    typeKey(currentWord()[0])
    expect(statValue('準確率')).toBe('100%')
    expect(screen.getByText('60/60')).toBeInTheDocument()
  })

  it('按 Enter 後倒數 3、2、1、GO!，倒數中不計時也不能打字', () => {
    setup()
    pressEnter()
    expect(dialog()).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('3')
    advance(650)
    expect(screen.getByRole('status')).toHaveTextContent('2')
    advance(650)
    expect(screen.getByRole('status')).toHaveTextContent('1')
    typeKey('#')
    advance(650)
    expect(screen.getByRole('status')).toHaveTextContent('GO!')
    advance(500)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(statValue('時間')).toBe('0.0s')
    expect(statValue('準確率')).toBe('100%')
    expect(screen.getByLabelText('打字輸入')).toHaveFocus()
  })
})

describe('鍵盤輸入', () => {
  it('打完一個字會扣怪物血並換下一個字', () => {
    setup()
    startBattle()
    const word = currentWord()
    const next = screen.getByText('下一個 →').nextElementSibling!.textContent
    typeWord(word)
    expect(screen.getByText(`${60 - word.length * 3}/60`)).toBeInTheDocument()
    expect(currentWord()).toBe(next)
    expect(screen.getByText('COMBO').previousElementSibling).toHaveTextContent(String(word.length))
  })

  it('打錯會標紅、Combo 歸零、準確率下降', () => {
    setup()
    startBattle()
    const word = currentWord()
    typeKey(word[0])
    typeKey('#')
    expect(statValue('準確率')).toBe('50%')
    expect(document.querySelectorAll('[data-word] span')[1].className).toMatch(/err/)
    typeKey(word[1])
    expect(document.querySelectorAll('[data-word] span')[1].className).not.toMatch(/err/)
  })

  it('功能鍵與快捷鍵不算打字', () => {
    setup()
    startBattle()
    typeKey('Shift')
    fireEvent.keyDown(document, { key: 'r', ctrlKey: true })
    expect(statValue('準確率')).toBe('100%')
  })

  it('手機鍵盤送來的 input 事件也能打字，全形會轉半形', () => {
    setup()
    startBattle()
    const word = currentWord()
    const input = screen.getByLabelText('打字輸入') as HTMLInputElement
    const fullWidth = String.fromCharCode(word.charCodeAt(0) + 0xfee0)
    fireEvent.input(input, { target: { value: fullWidth + word.slice(1) } })
    expect(input.value).toBe('')
    expect(screen.getByText(`${60 - word.length * 3}/60`)).toBeInTheDocument()
  })

  it('輸入框失去焦點時提示點一下，取回焦點後消失', () => {
    setup()
    startBattle()
    const input = screen.getByLabelText('打字輸入')
    expect(input).toHaveFocus()
    act(() => input.blur())
    expect(screen.getByText(/點一下這裡繼續打字/)).toBeInTheDocument()
    fireEvent.click(document.querySelector('[data-battle=arena]')!)
    expect(input).toHaveFocus()
    expect(screen.queryByText(/點一下這裡繼續打字/)).not.toBeInTheDocument()
  })
})

describe('遊戲迴圈', () => {
  it('時間會前進，怪物蓄力滿了會攻擊', () => {
    setup()
    startBattle()
    advance(3500)
    expect(Number.parseFloat(statValue('時間')!)).toBeGreaterThan(3)
    expect(screen.getByText('攻擊蓄力').nextElementSibling!.textContent).toMatch(/^(4\d|50)%$/)
    expect(screen.getByText('100/100')).toBeInTheDocument()
    advance(4000) // 簡單難度 7 秒蓄滿
    expect(screen.getByText('92/100')).toBeInTheDocument()
  })

  it('打倒怪物後跳出過關訊息，繼續後倒數再進下一關，並且補血', () => {
    setup()
    startBattle()
    advance(7500) // 先挨一下，才看得到補血
    expect(screen.getByText('92/100')).toBeInTheDocument()
    while (!screen.queryByText('0/60')) typeWord(currentWord())
    expect(dialog()).not.toBeInTheDocument()
    advance(900)
    expect(dialog()).toHaveAccessibleName('第 1 關 CLEAR！')
    expect(dialog()).toHaveTextContent('喵喵恢復 8 HP')
    expect(dialog()).toHaveTextContent(DAILY[1].name)
    pressEnter()
    expect(dialog()).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('3')
    expect(screen.getByText('第 2 / 3 關 ・ 簡單')).toBeInTheDocument()
    expect(screen.getByText('100/100')).toBeInTheDocument()
    expect(screen.getByText('90/90')).toBeInTheDocument()
    advance(COUNTDOWN_MS)
    typeKey(currentWord()[0])
    expect(screen.getByText('COMBO').previousElementSibling).not.toHaveTextContent(/^0$/)
  })

  it('可以從第一關一路打到通關', () => {
    const { onFinish, onExit } = setup()
    startBattle()
    for (let stage = 1; stage <= 3; stage++) {
      expect(screen.getByText(`第 ${stage} / 3 關 ・ 簡單`)).toBeInTheDocument()
      const maxHp = [60, 90, 140][stage - 1]
      while (!screen.queryByText(`0/${maxHp}`)) typeWord(currentWord())
      if (stage < 3) {
        expect(dialog()).not.toBeInTheDocument() // 每一關都要等一下才跳過關訊息
        advance(900)
        expect(dialog()).toHaveAccessibleName(`第 ${stage} 關 CLEAR！`)
        pressEnter()
        advance(COUNTDOWN_MS)
      }
    }
    expect(onFinish).not.toHaveBeenCalled() // 先讓最後一擊的動畫播完
    advance(1100)
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ phase: 'won', stage: 2, monsterHp: 0, wrong: 0 })
    advance(5000)
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onExit).not.toHaveBeenCalled()
  })

  it('一直不打字會被打倒', () => {
    const { onFinish } = setup()
    startBattle()
    for (let i = 0; i < 95; i++) advance(1000) // 每 7 秒被打 8 滴血，13 下倒地
    expect(screen.getByText('0/100')).toBeInTheDocument()
    advance(1300)
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ phase: 'lost', stage: 0, playerHp: 0 })
    const time = statValue('時間')
    advance(3000)
    expect(statValue('時間')).toBe(time) // 結束後不再計時
  })
})

describe('暫停', () => {
  const chargeText = () => screen.getByText('攻擊蓄力').nextElementSibling!.textContent
  const setHidden = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
    fireEvent(document, new Event('visibilitychange'))
  }
  afterEach(() => {
    Reflect.deleteProperty(document, 'hidden')
  })

  it('按 Esc 暫停，暫停 10 秒時間與蓄力都不前進，再按 Esc 繼續', () => {
    setup()
    startBattle()
    advance(2000)
    typeKey('Escape')
    expect(dialog()).toHaveAccessibleName('暫停中')
    const [time, charge] = [statValue('時間'), chargeText()]
    advance(10000)
    expect(statValue('時間')).toBe(time)
    expect(chargeText()).toBe(charge)
    expect(screen.getByText('100/100')).toBeInTheDocument()

    typeKey('Escape')
    expect(dialog()).not.toBeInTheDocument()
    expect(screen.getByLabelText('打字輸入')).toHaveFocus()
    advance(1000)
    expect(Number.parseFloat(statValue('時間')!)).toBeCloseTo(Number.parseFloat(time!) + 1, 0)
  })

  it('暫停中打字不算，按 Enter 或「繼續」可以回到戰鬥', () => {
    setup()
    startBattle()
    typeKey('Escape')
    typeKey('#')
    expect(statValue('準確率')).toBe('100%')
    pressEnter()
    expect(dialog()).not.toBeInTheDocument()
    typeKey('Escape')
    fireEvent.click(screen.getByRole('button', { name: /繼續/ }))
    expect(dialog()).not.toBeInTheDocument()
    typeKey(currentWord()[0])
    expect(screen.getByText('COMBO').previousElementSibling).toHaveTextContent('1')
  })

  it('暫停按鈕可以暫停', () => {
    setup()
    startBattle()
    fireEvent.click(screen.getByRole('button', { name: /暫停/ }))
    expect(dialog()).toHaveAccessibleName('暫停中')
  })

  it('放棄回選單', () => {
    const { onExit } = setup()
    startBattle()
    typeKey('Escape')
    fireEvent.click(screen.getByRole('button', { name: /放棄回選單/ }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('切換分頁會自動暫停，切回來不會自己繼續', () => {
    setup()
    startBattle()
    advance(1000)
    setHidden(true)
    expect(dialog()).toHaveAccessibleName('暫停中')
    const time = statValue('時間')
    setHidden(false)
    advance(5000)
    expect(dialog()).toHaveAccessibleName('暫停中')
    expect(statValue('時間')).toBe(time)
  })

  it('開場訊息與倒數中不能暫停', () => {
    setup()
    typeKey('Escape')
    expect(dialog()).toHaveAccessibleName(`${DAILY[0].name} 出現了！`)
    pressEnter()
    typeKey('Escape')
    setHidden(true)
    expect(dialog()).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('輸入法防呆與 Caps Lock 提醒', () => {
  const composing = () => fireEvent.keyDown(document, { key: 'Process', isComposing: true })
  const warning = () => screen.queryByRole('alert')

  it('戰鬥中偵測到中文輸入法會自動暫停並提示，暫停中不計時', () => {
    setup()
    startBattle()
    advance(1000)
    composing()
    expect(dialog()).toHaveAccessibleName('好像切到中文輸入法了')
    expect(warning()).toHaveTextContent('偵測到中文輸入法')
    expect(statValue('準確率')).toBe('100%') // 不算打錯
    const time = statValue('時間')
    advance(5000)
    expect(statValue('時間')).toBe(time)
  })

  it('按「切好了，繼續」回到戰鬥，提示消失', () => {
    setup()
    startBattle()
    composing()
    fireEvent.click(screen.getByRole('button', { name: /切好了，繼續/ }))
    expect(dialog()).not.toBeInTheDocument()
    expect(warning()).not.toBeInTheDocument()
    expect(screen.getByLabelText('打字輸入')).toHaveFocus()
    typeKey(currentWord()[0])
    expect(screen.getByText('COMBO').previousElementSibling).toHaveTextContent('1')
  })

  it('直接打出中文字、輸入框開始組字、手機送來中文，都會觸發', () => {
    for (const trigger of [
      () => typeKey('ㄅ'),
      () => fireEvent.compositionStart(screen.getByLabelText('打字輸入')),
      () => fireEvent.input(screen.getByLabelText('打字輸入'), { target: { value: '喵' } }),
    ]) {
      const { unmount } = render(<BattleScreen hero="cat" difficulty="easy" onExit={() => {}} onFinish={() => {}} />)
      startBattle()
      advance(2000) // 超過自動暫停的冷卻時間
      trigger()
      expect(dialog()).toHaveAccessibleName('好像切到中文輸入法了')
      unmount()
    }
  })

  it('剛按繼續的 1.5 秒內再偵測到只提示、不再暫停；提示 6 秒後消失', () => {
    setup()
    startBattle()
    composing()
    pressEnter()
    advance(500)
    composing()
    expect(dialog()).not.toBeInTheDocument()
    expect(warning()).toHaveTextContent('偵測到中文輸入法')
    advance(5900)
    expect(warning()).toBeInTheDocument()
    advance(200)
    expect(warning()).not.toBeInTheDocument()
  })

  it('開場訊息時偵測到只提示，不會蓋掉開場訊息', () => {
    setup()
    composing()
    expect(dialog()).toHaveAccessibleName(`${DAILY[0].name} 出現了！`)
    expect(warning()).toHaveTextContent('偵測到中文輸入法')
  })

  it('全形英數照樣可以打，不會被當成中文輸入法', () => {
    setup()
    startBattle()
    const word = currentWord()
    typeKey(String.fromCharCode(word.charCodeAt(0) + 0xfee0))
    expect(dialog()).not.toBeInTheDocument()
    expect(warning()).not.toBeInTheDocument()
    expect(screen.getByText('COMBO').previousElementSibling).toHaveTextContent('1')
  })

  it('Caps Lock 開著打字母會提醒 3 秒，字元照樣送出', () => {
    setup()
    startBattle()
    fireEvent.keyDown(document, { key: 'A', modifierCapsLock: true })
    expect(warning()).toHaveTextContent('Caps Lock 開著喔')
    expect(statValue('準確率')).not.toBe('100%') // 簡單字庫都是小寫，大寫 A 算打錯
    advance(3100)
    expect(warning()).not.toBeInTheDocument()
  })

  it('Caps Lock 沒開、或開著但打的是數字，不提醒', () => {
    setup()
    startBattle()
    typeKey('a')
    fireEvent.keyDown(document, { key: '1', modifierCapsLock: true })
    expect(warning()).not.toBeInTheDocument()
  })
})

describe('動畫與特效', () => {
  const anims = () => [...document.querySelectorAll('[data-battle=arena] [data-anim]')].map((el) => el.getAttribute('data-anim'))
  const arena = () => document.querySelector('[data-battle=arena]')!

  it('打完一個字：勇者衝出去並變開心，0.12 秒後怪物被打到、跳出傷害數字，之後恢復', () => {
    setup()
    startBattle()
    const word = currentWord()
    typeWord(word)
    advance(20)
    expect(anims()).toEqual(['attack', 'idle'])
    expect(arena().querySelector('svg[data-expression]')).toHaveAttribute('data-expression', 'happy')
    advance(120)
    expect(anims()).toEqual(['attack', 'hit'])
    expect(screen.getByText(`-${word.length * 3}`)).toBeInTheDocument()
    advance(600)
    expect(anims()).toEqual(['idle', 'idle'])
    expect(arena().querySelector('svg[data-expression]')).toHaveAttribute('data-expression', 'normal')
    advance(600)
    expect(screen.queryByText(`-${word.length * 3}`)).not.toBeInTheDocument()
  })

  it('怪物攻擊：怪物衝過來，勇者被打到變受傷表情並跳出紅色數字', () => {
    setup()
    startBattle()
    advance(7100)
    advance(20) // 測試裡畫面要等 advance 結束才更新，特效在下一次 advance 才開始播
    expect(anims()[1]).toBe('attack')
    advance(200)
    expect(anims()[0]).toBe('hit')
    expect(arena().querySelector('svg[data-expression]')).toHaveAttribute('data-expression', 'hurt')
    expect(screen.getByText('-8')).toBeInTheDocument()
    expect(arena().className).toMatch(/shake/)
  })

  it('打倒怪物：怪物倒地到換關為止，下一關的怪物恢復待機', () => {
    setup()
    startBattle()
    while (!screen.queryByText('0/60')) typeWord(currentWord())
    advance(500)
    expect(anims()[1]).toBe('ko')
    advance(400)
    expect(anims()[1]).toBe('ko')
    pressEnter()
    advance(50)
    expect(anims()[1]).toBe('idle')
  })

  it('被打倒：勇者倒地', () => {
    setup()
    startBattle()
    for (let i = 0; i < 95; i++) advance(1000)
    expect(anims()[0]).toBe('ko')
    expect(arena().querySelector('svg[data-expression]')).toHaveAttribute('data-expression', 'ko')
  })

  it('打錯：題目晃一下', () => {
    setup()
    startBattle()
    typeKey('#')
    advance(20)
    expect(document.querySelector('[data-word]')!.parentElement!.className).toMatch(/wordShake/)
  })

  it('每 10 Combo 跳出提示', () => {
    setup('normal')
    startBattle()
    while (Number(screen.getByText('COMBO').previousElementSibling!.textContent) < 10) typeKey(currentWord()[document.querySelectorAll('[data-word] span[class*=done]').length])
    advance(20)
    expect(screen.getByText('10 COMBO!')).toBeInTheDocument()
  })
})

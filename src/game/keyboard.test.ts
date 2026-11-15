import { describe, expect, it } from 'vitest'
import { interpretKey, interpretText } from './keyboard.ts'

describe('interpretKey', () => {
  it('一般字元是打字', () => {
    expect(interpretKey({ key: 'a' })).toEqual({ type: 'char', char: 'a', capsLockOn: false })
    expect(interpretKey({ key: ' ' })).toEqual({ type: 'char', char: ' ', capsLockOn: false })
    expect(interpretKey({ key: '&' })).toEqual({ type: 'char', char: '&', capsLockOn: false })
  })

  it('全形英數轉成半形', () => {
    expect(interpretKey({ key: 'Ａ' })).toMatchObject({ type: 'char', char: 'A' })
    expect(interpretKey({ key: '　' })).toMatchObject({ type: 'char', char: ' ' })
  })

  it('Esc 是暫停', () => {
    expect(interpretKey({ key: 'Escape' })).toEqual({ type: 'pause' })
  })

  it('組字中、Process 鍵、中文字元都算偵測到輸入法', () => {
    expect(interpretKey({ key: 'a', isComposing: true })).toEqual({ type: 'ime' })
    expect(interpretKey({ key: 'Process' })).toEqual({ type: 'ime' })
    expect(interpretKey({ key: 'ㄅ' })).toEqual({ type: 'ime' })
    expect(interpretKey({ key: '喵' })).toEqual({ type: 'ime' })
  })

  it('功能鍵與快捷鍵不處理', () => {
    for (const key of ['Enter', 'Shift', 'Backspace', 'ArrowLeft', 'Tab', 'F5', 'Unidentified']) {
      expect(interpretKey({ key })).toEqual({ type: 'ignore' })
    }
    expect(interpretKey({ key: 'r', ctrlKey: true })).toEqual({ type: 'ignore' })
    expect(interpretKey({ key: 'r', metaKey: true })).toEqual({ type: 'ignore' })
    expect(interpretKey({ key: 'd', altKey: true })).toEqual({ type: 'ignore' })
  })

  it('Caps Lock 開著打字母才提醒，數字與標點不提醒', () => {
    expect(interpretKey({ key: 'A', capsLock: true })).toMatchObject({ type: 'char', char: 'A', capsLockOn: true })
    expect(interpretKey({ key: '1', capsLock: true })).toMatchObject({ capsLockOn: false })
    expect(interpretKey({ key: 'a', capsLock: false })).toMatchObject({ capsLockOn: false })
  })
})

describe('interpretText', () => {
  it('拆成一個一個字元', () => {
    expect(interpretText('cat')).toEqual({ chars: ['c', 'a', 't'], ime: false })
    expect(interpretText('')).toEqual({ chars: [], ime: false })
  })

  it('全形轉半形', () => {
    expect(interpretText('ａｂ　ｃ')).toEqual({ chars: ['a', 'b', ' ', 'c'], ime: false })
  })

  it('有中文就標記輸入法，英文部分照樣保留', () => {
    expect(interpretText('a喵b')).toEqual({ chars: ['a', 'b'], ime: true })
  })
})

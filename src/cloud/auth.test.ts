import { describe, expect, it } from 'vitest'
import { authErrorFromUrl, authRedirectUrl, toAuthUser } from './auth.ts'

describe('登入者資料', () => {
  it('GitHub：用帳號名稱和大頭貼', () => {
    expect(toAuthUser({ id: 'u1', email: 'a@example.com', user_metadata: { user_name: 'octocat', full_name: 'The Octocat', avatar_url: 'https://avatars.example/1.png' } })).toEqual({
      id: 'u1',
      name: 'octocat',
      avatarUrl: 'https://avatars.example/1.png',
    })
  })

  it('Google：沒有帳號名稱時用姓名', () => {
    expect(toAuthUser({ id: 'u2', user_metadata: { full_name: '王小明' } })?.name).toBe('王小明')
  })

  it('什麼名字都沒有時用 email 的前半段，連 email 都沒有就叫玩家', () => {
    expect(toAuthUser({ id: 'u3', email: 'paws@example.com' })?.name).toBe('paws')
    expect(toAuthUser({ id: 'u4', user_metadata: { user_name: '  ' } })?.name).toBe('玩家')
  })

  it('大頭貼不是 https 就不用；名字太長會截斷', () => {
    const user = toAuthUser({ id: 'u5', user_metadata: { name: 'x'.repeat(100), avatar_url: 'javascript:alert(1)' } })
    expect(user?.avatarUrl).toBeNull()
    expect(user?.name).toHaveLength(40)
  })

  it('沒有 id 或不是物件時回傳 null', () => {
    expect(toAuthUser(null)).toBeNull()
    expect(toAuthUser(undefined)).toBeNull()
    expect(toAuthUser({ email: 'a@example.com' })).toBeNull()
  })
})

describe('登入後導回的網址', () => {
  it('是網站的首頁，包含 GitHub Pages 的子路徑', () => {
    expect(authRedirectUrl('https://ctycet.github.io', '/typing-paws-2/')).toBe('https://ctycet.github.io/typing-paws-2/')
    expect(authRedirectUrl('http://localhost:5173', '/typing-paws-2/')).toBe('http://localhost:5173/typing-paws-2/')
  })
})

describe('導回時的錯誤', () => {
  it('沒有錯誤時是 null', () => {
    expect(authErrorFromUrl('', '')).toBeNull()
    expect(authErrorFromUrl('?code=abc', '')).toBeNull()
  })

  it('取消授權', () => {
    expect(authErrorFromUrl('?error=access_denied&error_description=The+user+has+denied', '')).toBe('你取消了登入，或沒有同意授權。')
  })

  it('其他錯誤會附上說明，也讀得到 # 後面的參數', () => {
    expect(authErrorFromUrl('', '#error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code')).toBe(
      '登入沒有成功（Unable to exchange external code）。',
    )
  })

  it('說明只留可列印的 ASCII 並限制長度', () => {
    const msg = authErrorFromUrl(`?error=x&error_code=y&error_description=${encodeURIComponent('壞<b>' + 'a'.repeat(300))}`, '')!
    expect(msg).toMatch(/^登入沒有成功（<b>a+）。$/)
    expect(msg.length).toBeLessThan(140)
  })
})

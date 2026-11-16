import { describe, expect, it, vi } from 'vitest'
import { ALICE, fakeCloud } from '../test/fakeCloud.ts'
import { AUTH_STORAGE_KEY, lazyCloud, mayBeSignedIn } from './lazy.ts'

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('可能已經登入嗎', () => {
  const storage = (value: string | null) => ({ getItem: (key: string) => (key === AUTH_STORAGE_KEY ? value : null) })

  it('沒有存過登入狀態、網址也沒有代碼：一定是訪客', () => {
    expect(mayBeSignedIn(storage(null), '')).toBe(false)
    expect(mayBeSignedIn(storage(null), '?demo&error=access_denied')).toBe(false)
  })

  it('有存過登入狀態，或剛從供應商導回來', () => {
    expect(mayBeSignedIn(storage('{"access_token":"x"}'), '')).toBe(true)
    expect(mayBeSignedIn(storage(null), '?code=abc')).toBe(true)
  })

  it('localStorage 不能用時當作訪客', () => {
    const broken = { getItem: () => { throw new Error('denied') } }
    expect(mayBeSignedIn(broken, '')).toBe(false)
  })
})

describe('之後才載入的雲端功能', () => {
  it('訪客：立刻回報沒登入，而且不會載入', async () => {
    const load = vi.fn(async () => fakeCloud().cloud)
    const cloud = lazyCloud(load, false)
    const seen: unknown[] = []
    cloud.auth.subscribe((user) => seen.push(user))
    await tick()
    expect(seen).toEqual([null])
    expect(load).not.toHaveBeenCalled()
  })

  it('按下登入時才載入，之後的登入狀態也收得到', async () => {
    const real = fakeCloud()
    const load = vi.fn(async () => real.cloud)
    const cloud = lazyCloud(load, false)
    const seen: unknown[] = []
    cloud.auth.subscribe((user) => seen.push(user))
    await cloud.auth.signIn('github', 'https://example.test/')
    expect(load).toHaveBeenCalledTimes(1)
    expect(real.auth.signIns).toEqual([{ provider: 'github', redirectTo: 'https://example.test/' }])
    real.auth.setUser(ALICE)
    expect(seen.at(-1)).toEqual(ALICE)
  })

  it('可能已登入：馬上載入，由真正的實作回報登入者；只載入一次', async () => {
    const real = fakeCloud(ALICE)
    const load = vi.fn(async () => real.cloud)
    const cloud = lazyCloud(load, true)
    const seen: unknown[] = []
    const stop = cloud.auth.subscribe((user) => seen.push(user))
    expect(seen).toEqual([])
    await tick()
    expect(seen).toEqual([ALICE])
    await cloud.data(ALICE.id).pushHero('panda')
    expect(real.db.account(ALICE.id).hero).toBe('panda')
    expect(load).toHaveBeenCalledTimes(1)
    stop()
    real.auth.setUser(null)
    expect(seen).toEqual([ALICE])
  })

  it('載入失敗（斷網）：先當訪客；之後再用到時會重試', async () => {
    const real = fakeCloud()
    const load = vi.fn<() => Promise<typeof real.cloud>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(real.cloud)
    const cloud = lazyCloud(load, true)
    const seen: unknown[] = []
    cloud.auth.subscribe((user) => seen.push(user))
    await tick()
    expect(seen).toEqual([null])
    await cloud.auth.signIn('github', 'https://example.test/')
    expect(load).toHaveBeenCalledTimes(2)
    expect(real.auth.signIns).toHaveLength(1)
  })

  it('載入失敗時，資料的請求會失敗而不是卡住', async () => {
    const cloud = lazyCloud(async () => Promise.reject(new Error('offline')), true)
    await expect(cloud.data('u1').pull()).rejects.toThrow('offline')
  })
})

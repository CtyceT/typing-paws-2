import { STORAGE_PREFIX } from '../storage/keys.ts'
import type { AuthUser } from './auth.ts'
import type { CloudData } from './data.ts'
import type { Cloud } from './index.ts'

/** 登入狀態存在 localStorage 的哪個鍵 */
export const AUTH_STORAGE_KEY = `${STORAGE_PREFIX}auth`

/**
 * 這次開啟網頁「可能」是登入狀態嗎？
 * 是：localStorage 裡有上次的登入狀態，或網址帶著供應商導回來的一次性代碼（?code=）。
 * 都沒有的話一定是訪客，不需要為了確認這件事去下載 supabase-js。
 */
export function mayBeSignedIn(storage: Pick<Storage, 'getItem'>, search: string): boolean {
  try {
    if (storage.getItem(AUTH_STORAGE_KEY) !== null) return true
  } catch {
    // localStorage 不能用：登入狀態也存不住，當作訪客
  }
  return new URLSearchParams(search).has('code')
}

/**
 * 把「之後才載入」的雲端功能包成一般的 Cloud 介面。
 * - 訪客（maybeSignedIn 是 false）：立刻回報沒登入，什麼都不下載；按下登入時才載入。
 * - 可能已登入：馬上開始載入，登入狀態由真正的實作回報。載入失敗（斷網）時先當訪客。
 * load 只會被呼叫一次；失敗的話下次用到時會重試。
 */
export function lazyCloud(load: () => Promise<Cloud>, maybeSignedIn: boolean): Cloud {
  let loading: Promise<Cloud> | null = null
  const real = () => {
    loading ??= load().catch((error: unknown) => {
      loading = null
      throw error
    })
    return loading
  }
  /** 已經訂閱登入狀態的人：真正的實作載入之後要補接上去 */
  const listeners = new Map<(user: AuthUser | null) => void, { stop: (() => void) | null; attached: boolean }>()
  const attach = (cloud: Cloud) => {
    for (const [listener, entry] of listeners) {
      if (entry.attached) continue
      entry.attached = true
      entry.stop = cloud.auth.subscribe(listener)
    }
  }
  const data = (userId: string): CloudData => {
    const inner = real().then((cloud) => cloud.data(userId))
    // 先接住失敗：這個 Promise 可能很久之後才有人等它
    inner.catch(() => {})
    return {
      pushSessions: async (...args) => (await inner).pushSessions(...args),
      pushBest: async (...args) => (await inner).pushBest(...args),
      pushHero: async (...args) => (await inner).pushHero(...args),
      pull: async () => (await inner).pull(),
      clear: async () => (await inner).clear(),
    }
  }
  return {
    auth: {
      subscribe(listener) {
        listeners.set(listener, { stop: null, attached: false })
        if (maybeSignedIn || loading) real().then(attach, () => listeners.has(listener) && listener(null))
        else listener(null)
        return () => {
          listeners.get(listener)?.stop?.()
          listeners.delete(listener)
        }
      },
      async signIn(provider, redirectTo) {
        const cloud = await real()
        attach(cloud)
        await cloud.auth.signIn(provider, redirectTo)
      },
      async signOut() {
        await (await real()).auth.signOut()
      },
    },
    data,
  }
}

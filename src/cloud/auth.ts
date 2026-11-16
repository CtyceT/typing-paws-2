import type { SupabaseClient } from '@supabase/supabase-js'

/** 登入供應商。要開放新的供應商：先在 Supabase 後台啟用，再把它加進 AUTH_PROVIDERS */
export type AuthProvider = 'github' | 'google'

export const PROVIDER_LABELS: Readonly<Record<AuthProvider, string>> = {
  github: 'GitHub',
  google: 'Google',
}

/** 目前開放的登入方式（依顯示順序）。Google 在後台設定好之後加進來就會出現按鈕 */
export const AUTH_PROVIDERS: readonly AuthProvider[] = ['github']

/** 畫面需要的登入者資料 */
export interface AuthUser {
  id: string
  /** 顯示名稱：供應商的帳號名稱或姓名，都沒有時用 email 的前半段 */
  name: string
  avatarUrl: string | null
}

/** 登入功能的介面。畫面只透過這個介面登入登出，測試時可以換成假的 */
export interface AuthService {
  /**
   * 訂閱登入狀態。訂閱後一定會先收到一次目前的狀態（沒登入是 null），之後每次登入、登出都會再收到。
   * 回傳取消訂閱的函式。
   */
  subscribe(listener: (user: AuthUser | null) => void): () => void
  /** 跳轉到供應商的登入頁；登入完成後會回到 redirectTo */
  signIn(provider: AuthProvider, redirectTo: string): Promise<void>
  signOut(): Promise<void>
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

/** 把 Supabase 的 user 整理成畫面要用的資料；資料不完整時回傳 null */
export function toAuthUser(user: unknown): AuthUser | null {
  if (typeof user !== 'object' || user === null) return null
  const { id, email, user_metadata } = user as { id?: unknown; email?: unknown; user_metadata?: unknown }
  if (typeof id !== 'string' || id === '') return null
  const meta = (typeof user_metadata === 'object' && user_metadata !== null ? user_metadata : {}) as Record<string, unknown>
  const name = text(meta.user_name) ?? text(meta.preferred_username) ?? text(meta.full_name) ?? text(meta.name) ?? text(email)?.split('@')[0] ?? '玩家'
  const avatar = text(meta.avatar_url)
  return { id, name: name.slice(0, 40), avatarUrl: avatar && /^https:\/\//.test(avatar) ? avatar : null }
}

/** 登入完成後要回到的網址：目前這個網站的首頁（去掉查詢參數與 #） */
export function authRedirectUrl(origin: string, baseUrl: string): string {
  return `${origin}${baseUrl.startsWith('/') ? '' : '/'}${baseUrl}`
}

/**
 * 供應商把人導回來時，如果登入失敗，網址會帶 error 參數（在查詢參數或 # 後面）。
 * 回傳要給玩家看的說明；沒有錯誤時回傳 null。
 */
export function authErrorFromUrl(search: string, hash: string): string | null {
  for (const part of [search.replace(/^\?/, ''), hash.replace(/^#/, '')]) {
    const params = new URLSearchParams(part)
    if (!params.has('error') && !params.has('error_code')) continue
    if (params.get('error') === 'access_denied' && !params.has('error_code')) return '你取消了登入，或沒有同意授權。'
    const detail = (params.get('error_description') ?? params.get('error') ?? '').replace(/[^\x20-\x7E]/g, '').slice(0, 120)
    return detail ? `登入沒有成功（${detail}）。` : '登入沒有成功。'
  }
  return null
}

/** 用 Supabase Auth 實作的登入功能 */
export function createSupabaseAuth(client: SupabaseClient): AuthService {
  return {
    subscribe(listener) {
      // 訂閱後 Supabase 會先送一次 INITIAL_SESSION（從 localStorage 還原，或剛從供應商導回來）
      const { data } = client.auth.onAuthStateChange((_event, session) => listener(toAuthUser(session?.user)))
      return () => data.subscription.unsubscribe()
    },
    async signIn(provider, redirectTo) {
      const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo } })
      if (error) throw error
    },
    async signOut() {
      // scope: 'local' 只登出這個瀏覽器，而且斷網時也能登出
      const { error } = await client.auth.signOut({ scope: 'local' })
      if (error) throw error
    },
  }
}

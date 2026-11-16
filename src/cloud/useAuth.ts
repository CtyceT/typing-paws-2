import { useEffect, useState } from 'react'
import type { AuthService, AuthUser } from './auth.ts'

export type AuthState = { status: 'loading' } | { status: 'ready'; user: AuthUser | null }

/** 等登入狀態最多等這麼久；超過就先當訪客（之後狀態回來了會再切換） */
export const AUTH_WAIT_MS = 4000

const sameUser = (a: AuthUser | null, b: AuthUser | null) => a?.id === b?.id && a?.name === b?.name && a?.avatarUrl === b?.avatarUrl

/**
 * 目前的登入狀態。沒有登入功能（auth 是 null）時永遠是「已就緒、沒登入」。
 * 還原登入狀態通常只要幾毫秒；網路很慢時不會一直卡在載入中。
 */
export function useAuth(auth: AuthService | null): AuthState {
  const [state, setState] = useState<AuthState>(auth ? { status: 'loading' } : { status: 'ready', user: null })

  useEffect(() => {
    if (!auth) return
    const set = (user: AuthUser | null) =>
      // token 更新時也會收到通知；內容沒變就沿用原本的物件，避免整個畫面重新整理
      setState((prev) => (prev.status === 'ready' && sameUser(prev.user, user) ? prev : { status: 'ready', user }))
    const timer = setTimeout(() => setState((prev) => (prev.status === 'loading' ? { status: 'ready', user: null } : prev)), AUTH_WAIT_MS)
    const unsubscribe = auth.subscribe(set)
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [auth])

  return state
}

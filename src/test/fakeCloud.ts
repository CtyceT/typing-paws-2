import type { AuthProvider, AuthService, AuthUser, Cloud } from '../cloud/index.ts'

export const ALICE: AuthUser = { id: 'user-alice', name: 'alice', avatarUrl: null }
export const BOB: AuthUser = { id: 'user-bob', name: 'bob', avatarUrl: 'https://avatars.example/bob.png' }

/** 假的登入功能：signIn 不會真的跳轉，只記下呼叫；用 setUser 模擬登入完成或登出 */
export function fakeAuth(initial: AuthUser | null = null) {
  let user = initial
  const listeners = new Set<(user: AuthUser | null) => void>()
  const signIns: { provider: AuthProvider; redirectTo: string }[] = []
  const service: AuthService = {
    subscribe(listener) {
      listeners.add(listener)
      listener(user)
      return () => listeners.delete(listener)
    },
    async signIn(provider, redirectTo) {
      if (control.failSignIn) throw new Error('network')
      signIns.push({ provider, redirectTo })
    },
    async signOut() {
      control.setUser(null)
    },
  }
  const control = {
    service,
    signIns,
    failSignIn: false,
    setUser(next: AuthUser | null) {
      user = next
      listeners.forEach((l) => l(user))
    },
  }
  return control
}

export function fakeCloud(initial: AuthUser | null = null) {
  const auth = fakeAuth(initial)
  const cloud: Cloud = { auth: auth.service }
  return { cloud, auth }
}

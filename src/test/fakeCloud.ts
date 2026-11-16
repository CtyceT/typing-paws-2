import type { AuthProvider, AuthService, AuthUser, Cloud, CloudData } from '../cloud/index.ts'
import { DIFFICULTY_ORDER, HISTORY_LIMIT, type BestRecords, type GameRecord, type HeroId, type KeyStatRow } from '../game/index.ts'

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

/** 假的雲端裡，一個帳號的資料 */
export interface FakeAccount {
  records: Map<string, GameRecord>
  keyStats: Map<string, KeyStatRow>
  best: BestRecords
  hero: HeroId | null
}

/**
 * 假的雲端資料庫（存在記憶體裡），行為照真的資料表：同一個 id 重複上傳只會有一筆、最佳紀錄只會變好。
 * offline 設成 true 之後每個請求都會失敗；calls 記下每一次請求的名稱。
 */
export function fakeDatabase() {
  const accounts = new Map<string, FakeAccount>()
  const account = (userId: string): FakeAccount => {
    let a = accounts.get(userId)
    if (!a) accounts.set(userId, (a = { records: new Map(), keyStats: new Map(), best: {}, hero: null }))
    return a
  }
  const db = {
    offline: false,
    calls: [] as string[],
    account,
    data(userId: string): CloudData {
      const request = async (name: string) => {
        db.calls.push(name)
        if (db.offline) throw new Error('Failed to fetch')
      }
      return {
        async pushSessions(records, keyStats) {
          await request('pushSessions')
          const a = account(userId)
          for (const r of records) a.records.set(r.id, r)
          for (const k of keyStats) {
            if (!a.records.has(k.sessionId)) throw new Error('foreign key violation')
            a.keyStats.set(k.id, k)
          }
        },
        async pushBest(best) {
          await request('pushBest')
          const a = account(userId)
          for (const d of DIFFICULTY_ORDER) {
            const [next, prev] = [best[d], a.best[d]]
            if (!next) continue
            a.best[d] = prev
              ? {
                  score: Math.max(prev.score, next.score),
                  wpm: Math.max(prev.wpm, next.wpm),
                  maxCombo: Math.max(prev.maxCombo, next.maxCombo),
                  accuracy: Math.max(prev.accuracy, next.accuracy),
                  clears: Math.max(prev.clears, next.clears),
                }
              : { ...next }
          }
        },
        async pushHero(hero) {
          await request('pushHero')
          account(userId).hero = hero
        },
        async pull() {
          await request('pull')
          const a = account(userId)
          const history = [...a.records.values()].sort((x, y) => x.playedAt - y.playedAt).slice(-HISTORY_LIMIT)
          const ids = new Set(history.map((r) => r.id))
          return { best: structuredClone(a.best), history, keyStats: [...a.keyStats.values()].filter((k) => ids.has(k.sessionId)), hero: a.hero }
        },
        async clear() {
          await request('clear')
          const a = account(userId)
          a.records.clear()
          a.keyStats.clear()
          a.best = {}
        },
      }
    },
  }
  return db
}

export function fakeCloud(initial: AuthUser | null = null) {
  const auth = fakeAuth(initial)
  const db = fakeDatabase()
  const cloud: Cloud = { auth: auth.service, data: (userId) => db.data(userId) }
  return { cloud, auth, db }
}

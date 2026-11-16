import { useCallback, useEffect, useRef, useState } from 'react'
import type { CloudData } from '../cloud/index.ts'
import {
  addResult,
  appendSessionStats,
  EMPTY_RECORDS,
  mergeRecords,
  newRecordKind,
  pendingUpload,
  sessionMisses,
  summarizeSession,
  type BattleResult,
  type HeroId,
  type KeyEvent,
  type KeyStatRow,
  type NewRecordKind,
  type Records,
  type SessionMiss,
  type SyncPhase,
} from '../game/index.ts'
import { loadHero, saveHero } from '../storage/hero.ts'
import { createLocalKeyStatsStore } from '../storage/keyStats.ts'
import type { StorageScope } from '../storage/keys.ts'
import { loadHeroDirty, loadPending, saveHeroDirty, savePending } from '../storage/pending.ts'
import { clearRecords, loadRecords, saveRecords } from '../storage/records.ts'

/** 某個身分（訪客或一個帳號）在這個瀏覽器裡的資料 */
interface PlayerData {
  hero: HeroId
  records: Records
  keyStats: KeyStatRow[]
  /** 還沒上傳到雲端的場次 id（訪客永遠是空的） */
  pending: string[]
}

/** 打完一場、存好之後回傳給結算畫面用的資料 */
export interface SavedGame {
  id: string
  newRecord: NewRecordKind
  misses: SessionMiss[]
}

/**
 * 玩家的資料與雲端同步。
 *
 * 畫面永遠讀寫本機這一份（local-first）：每個動作都是先存 localStorage、更新畫面，再在背景上傳。
 * 上傳失敗（斷網）不會影響遊戲，只會把場次留在待上傳清單，之後連上網路、再打完一場或按「重試」時補傳。
 *
 * scope 是資料屬於誰（null 是訪客）；cloud 是那個帳號的雲端資料（訪客或沒有雲端功能時是 null）。
 * 這個 hook 假設 scope 和 cloud 在元件存在期間不會變：換帳號時由外層用 key 重新建立整個元件。
 */
export function usePlayerData(scope: StorageScope, cloud: CloudData | null) {
  const [store] = useState(() => createLocalKeyStatsStore(scope))
  const [data, setData] = useState<PlayerData>(() => ({
    hero: loadHero(scope),
    records: loadRecords(scope),
    keyStats: store.load(),
    pending: scope === null ? [] : loadPending(scope),
  }))
  const [phase, setPhase] = useState<SyncPhase>('idle')
  /** 最新的資料：背景的同步跑完時畫面可能已經又變了，要用這一份而不是當時的那一份 */
  const latest = useRef(data)
  /** 同步一次只跑一個，後面的排隊 */
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const alive = useRef(true)

  /** 更新資料：畫面、localStorage 一起改 */
  const commit = useCallback(
    (patch: Partial<PlayerData>) => {
      const next = { ...latest.current, ...patch }
      // 按鍵統計存檔時只會留最近幾場，畫面用的也要是同一份
      if (patch.keyStats !== undefined) next.keyStats = store.replaceAll(patch.keyStats)
      if (patch.hero !== undefined) saveHero(next.hero, scope)
      if (patch.records !== undefined) saveRecords(next.records, scope)
      if (patch.pending !== undefined && scope !== null) savePending(next.pending, scope)
      latest.current = next
      setData(next)
    },
    [scope, store],
  )

  /** 把一件要連雲端的工作排進佇列。回傳的 Promise 一定會完成（失敗時是 false），不會丟出例外 */
  const enqueue = useCallback((job: () => Promise<void>): Promise<boolean> => {
    const result = queue.current.then(async () => {
      if (!alive.current) return false
      setPhase('syncing')
      try {
        await job()
        if (alive.current) setPhase('idle')
        return true
      } catch {
        if (alive.current) setPhase('failed')
        return false
      }
    })
    queue.current = result
    return result
  }, [])

  /** 上傳還沒上傳的場次、最佳紀錄與勇者 */
  const upload = useCallback(
    async (cloud: CloudData, userId: string) => {
      const { records, keyStats, pending, hero } = latest.current
      const batch = pendingUpload(records, keyStats, pending)
      await cloud.pushSessions(batch.records, batch.keyStats)
      if (batch.records.length > 0) await cloud.pushBest(records.best)
      if (loadHeroDirty(userId)) {
        await cloud.pushHero(hero)
        // 上傳途中又換了勇者的話，記號留著，下次再傳
        if (latest.current.hero === hero) saveHeroDirty(false, userId)
      }
      if (!alive.current) return
      const done = new Set(pending)
      if (done.size > 0) commit({ pending: latest.current.pending.filter((id) => !done.has(id)) })
    },
    [commit],
  )

  /** 和雲端同步；沒登入時什麼都不做 */
  const sync = useCallback(() => {
    if (!cloud || scope === null) return
    void enqueue(() => upload(cloud, scope))
  }, [cloud, scope, enqueue, upload])

  // 進遊戲（登入）時同步一次；之後每次恢復連線也同步
  useEffect(() => {
    alive.current = true
    sync()
    window.addEventListener('online', sync)
    return () => {
      alive.current = false
      window.removeEventListener('online', sync)
    }
  }, [sync])

  const selectHero = useCallback(
    (hero: HeroId) => {
      commit({ hero })
      if (scope !== null) saveHeroDirty(true, scope)
      sync()
    },
    [commit, scope, sync],
  )

  /** 打完一場：存成績與按鍵統計，登入時在背景上傳 */
  const addGame = useCallback(
    (result: BattleResult, keyLog: readonly KeyEvent[]): SavedGame => {
      const playedAt = Date.now()
      const id = `${playedAt}-${Math.random().toString(36).slice(2, 8)}`
      const before = latest.current
      const sessionStats = summarizeSession(keyLog, { sessionId: id, playedAt })
      commit({
        records: addResult(before.records, result, { id, playedAt }),
        keyStats: appendSessionStats(before.keyStats, sessionStats),
        ...(scope !== null && { pending: [...before.pending, id] }),
      })
      sync()
      return { id, newRecord: newRecordKind(before.records.best[result.difficulty], result), misses: sessionMisses(sessionStats) }
    },
    [commit, scope, sync],
  )

  /** 把另一份紀錄併進來（匯入 1.0 的舊紀錄）；登入時新併進來的場次也會上傳 */
  const importRecords = useCallback(
    (extra: Records) => {
      const before = latest.current
      commit({
        records: mergeRecords(before.records, extra),
        ...(scope !== null && { pending: [...new Set([...before.pending, ...extra.history.map((r) => r.id)])] }),
      })
      sync()
    },
    [commit, scope, sync],
  )

  /**
   * 清除所有紀錄。登入時要先把雲端的刪掉才清本機的（不然下次同步又會載回來）；
   * 雲端刪除失敗時什麼都不清，回傳 false。
   */
  const clearAll = useCallback(async (): Promise<boolean> => {
    if (cloud && scope !== null && !(await enqueue(() => cloud.clear()))) return false
    clearRecords(scope)
    store.clear()
    if (scope !== null) savePending([], scope)
    const next = { ...latest.current, records: EMPTY_RECORDS, keyStats: [], pending: [] }
    latest.current = next
    setData(next)
    return true
  }, [cloud, scope, enqueue, store])

  return { ...data, phase, selectHero, addGame, importRecords, clearAll, retrySync: sync }
}

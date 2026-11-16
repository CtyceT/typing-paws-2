import type { SupabaseClient } from '@supabase/supabase-js'
import {
  chunk,
  HISTORY_LIMIT,
  toBestRecordRows,
  toCloudSnapshot,
  toGameRecordRow,
  toKeyStatDbRow,
  type BestRecords,
  type CloudSnapshot,
  type GameRecord,
  type HeroId,
  type KeyStatRow,
} from '../game/index.ts'

/**
 * 某個登入帳號的雲端資料。每個方法失敗（斷網、逾時、被資料庫拒絕）都會丟出例外，由呼叫的人決定怎麼處理；
 * 畫面永遠讀本機那一份，所以這裡失敗不會讓遊戲卡住。測試時可以換成假的。
 */
export interface CloudData {
  /** 上傳場次和它們的按鍵統計。重複上傳同一場不會變成兩筆 */
  pushSessions(records: readonly GameRecord[], keyStats: readonly KeyStatRow[]): Promise<void>
  /** 上傳最佳紀錄。資料庫只會留下比較好的數字，不會被舊資料蓋掉 */
  pushBest(best: BestRecords): Promise<void>
  /** 上傳選中的勇者 */
  pushHero(hero: HeroId): Promise<void>
  /** 讀取最近幾場的場次與按鍵統計、最佳紀錄、勇者 */
  pull(): Promise<CloudSnapshot>
  /** 刪除這個帳號所有的場次、按鍵統計與最佳紀錄 */
  clear(): Promise<void>
}

/** 每個請求最多等這麼久 */
const TIMEOUT_MS = 15000
/** 一次請求最多讀幾列（Supabase 預設每個請求最多回傳 1000 列） */
const PAGE_SIZE = 1000
/** 一次請求最多上傳幾列 */
const UPLOAD_BATCH = 500

type Result = { error: unknown }

/** 讀取用：失敗時丟例外，成功時回傳資料 */
async function read<T>(request: PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
  const { data, error } = await request
  if (error) throw error
  return data
}

/** Supabase 的請求失敗時不會丟例外，而是回傳 error；這裡統一轉成例外 */
async function run(request: PromiseLike<Result>): Promise<void> {
  const { error } = await request
  if (error) throw error
}

/** 用 Supabase 資料表實作。每張表都有 RLS，就算這裡把 userId 傳錯，也只碰得到登入者自己的列 */
export function createSupabaseData(client: SupabaseClient, userId: string): CloudData {
  const timeout = () => AbortSignal.timeout(TIMEOUT_MS)
  return {
    async pushSessions(records, keyStats) {
      // 先場次、後統計：統計有外鍵連到場次
      for (const rows of chunk(records.map((r) => toGameRecordRow(r, userId)), UPLOAD_BATCH)) {
        await run(client.from('game_records').upsert(rows, { onConflict: 'user_id,id' }).abortSignal(timeout()))
      }
      for (const rows of chunk(keyStats.map((r) => toKeyStatDbRow(r, userId)), UPLOAD_BATCH)) {
        await run(client.from('key_stats').upsert(rows, { onConflict: 'user_id,id' }).abortSignal(timeout()))
      }
    },
    async pushBest(best) {
      const rows = toBestRecordRows(best, userId)
      if (rows.length === 0) return
      await run(client.from('best_records').upsert(rows, { onConflict: 'user_id,difficulty' }).abortSignal(timeout()))
    },
    async pushHero(hero) {
      await run(client.from('profiles').update({ hero }).eq('id', userId).abortSignal(timeout()))
    },
    async pull() {
      const [best, history, profile] = await Promise.all([
        read(client.from('best_records').select('difficulty, score, wpm, max_combo, accuracy, clears').eq('user_id', userId).abortSignal(timeout())),
        read(
          client
            .from('game_records')
            .select('id, played_at, mode, difficulty, win, wpm, accuracy, max_combo, score, damage, duration_ms, stage')
            .eq('user_id', userId)
            .order('played_at', { ascending: false })
            .limit(HISTORY_LIMIT)
            .abortSignal(timeout()),
        ),
        read(client.from('profiles').select('hero').eq('id', userId).abortSignal(timeout()).maybeSingle()),
      ])
      // 只讀這幾場的按鍵統計；30 場大約 2000 多列，要分頁
      const sessionIds = (history ?? []).map((r) => r.id as string)
      const keyStats: unknown[] = []
      for (let from = 0; sessionIds.length > 0; from += PAGE_SIZE) {
        const page = await read(
          client
            .from('key_stats')
            .select('id, session_id, played_at, kind, key, attempts, errors, timed_count, total_ms')
            .eq('user_id', userId)
            .in('session_id', sessionIds)
            .order('id')
            .range(from, from + PAGE_SIZE - 1)
            .abortSignal(timeout()),
        )
        keyStats.push(...(page ?? []))
        if (!page || page.length < PAGE_SIZE) break
      }
      return toCloudSnapshot({ best, history, keyStats, hero: (profile as { hero?: unknown } | null)?.hero ?? null })
    },
    async clear() {
      // 刪場次時，底下的按鍵統計會跟著刪（外鍵 on delete cascade）
      await run(client.from('game_records').delete().eq('user_id', userId).abortSignal(timeout()))
      await run(client.from('best_records').delete().eq('user_id', userId).abortSignal(timeout()))
    },
  }
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { STORAGE_PREFIX } from '../storage/keys.ts'
import { parseCloudConfig } from './config.ts'

const config = parseCloudConfig(import.meta.env)

/**
 * Supabase 連線。沒有設定環境變數時是 null：遊戲照常可以玩，只是沒有登入與雲端同步。
 * 前端只用 publishable key；資料靠每張表的 Row Level Security 保護。
 */
export const supabase: SupabaseClient | null = config
  ? createClient(config.url, config.publishableKey, {
      auth: {
        // 1.0 和 2.0 共用網域：登入狀態的 localStorage 鍵也要用 typingPaws2. 開頭（預設是 sb-<專案>-auth-token）
        storageKey: `${STORAGE_PREFIX}auth`,
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

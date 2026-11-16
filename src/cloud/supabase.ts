// supabase-js 只從這個檔案載入，而且這個檔案只會被動態 import（見 lazy.ts）：
// 訪客不會下載 supabase-js，要登入或已經登入時才下載（ROADMAP 11.5）。
import { createClient } from '@supabase/supabase-js'
import { AUTH_STORAGE_KEY } from './lazy.ts'
import { createSupabaseAuth } from './auth.ts'
import type { CloudConfig } from './config.ts'
import { createSupabaseData } from './data.ts'
import type { Cloud } from './index.ts'

/**
 * 建立 Supabase 連線。前端只用 publishable key；資料靠每張表的 Row Level Security 保護。
 */
export function createSupabaseCloud(config: CloudConfig): Cloud {
  const client = createClient(config.url, config.publishableKey, {
    auth: {
      // 1.0 和 2.0 共用網域：登入狀態的 localStorage 鍵也要用 typingPaws2. 開頭（預設是 sb-<專案>-auth-token）
      storageKey: AUTH_STORAGE_KEY,
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return { auth: createSupabaseAuth(client), data: (userId) => createSupabaseData(client, userId) }
}

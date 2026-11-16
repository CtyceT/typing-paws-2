import type { AuthService } from './auth.ts'
import { parseCloudConfig } from './config.ts'
import type { CloudData } from './data.ts'
import { lazyCloud, mayBeSignedIn } from './lazy.ts'

export * from './auth.ts'
export * from './data.ts'
export * from './useAuth.ts'

/** 雲端功能的入口。App 只認得這個介面，測試時可以整個換成假的 */
export interface Cloud {
  auth: AuthService
  /** 某個登入帳號的雲端資料 */
  data(userId: string): CloudData
}

const config = parseCloudConfig(import.meta.env)

/**
 * 用環境變數設定的 Supabase 專案；沒設定時是 null（只有訪客模式）。
 * supabase-js 是動態載入的：訪客不會下載它，要登入或已經登入時才下載。
 */
export const defaultCloud: Cloud | null = config
  ? lazyCloud(() => import('./supabase.ts').then((m) => m.createSupabaseCloud(config)), mayBeSignedIn(window.localStorage, window.location.search))
  : null

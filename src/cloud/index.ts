import { createSupabaseAuth, type AuthService } from './auth.ts'
import { supabase } from './supabase.ts'

export * from './auth.ts'
export * from './useAuth.ts'

/** 雲端功能的入口。App 只認得這個介面，測試時可以整個換成假的 */
export interface Cloud {
  auth: AuthService
}

/** 用環境變數設定的 Supabase 專案；沒設定時是 null（只有訪客模式） */
export const defaultCloud: Cloud | null = supabase ? { auth: createSupabaseAuth(supabase) } : null

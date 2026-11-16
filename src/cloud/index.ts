import { createSupabaseAuth, type AuthService } from './auth.ts'
import { createSupabaseData, type CloudData } from './data.ts'
import { supabase } from './supabase.ts'

export * from './auth.ts'
export * from './data.ts'
export * from './useAuth.ts'

/** 雲端功能的入口。App 只認得這個介面，測試時可以整個換成假的 */
export interface Cloud {
  auth: AuthService
  /** 某個登入帳號的雲端資料 */
  data(userId: string): CloudData
}

/** 用環境變數設定的 Supabase 專案；沒設定時是 null（只有訪客模式） */
export const defaultCloud: Cloud | null = (() => {
  const client = supabase
  return client ? { auth: createSupabaseAuth(client), data: (userId) => createSupabaseData(client, userId) } : null
})()

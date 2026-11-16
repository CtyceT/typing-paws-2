/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase 專案網址；沒設定時只有訪客模式 */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase 的 publishable key（公開的，可以放在前端） */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

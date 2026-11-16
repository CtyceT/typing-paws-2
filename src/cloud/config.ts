/** 連線到 Supabase 需要的公開設定 */
export interface CloudConfig {
  url: string
  publishableKey: string
}

/**
 * 從環境變數整理出 Supabase 設定。沒設定或明顯不對時回傳 null，遊戲就只有訪客模式。
 * 會拒絕秘密金鑰（sb_secret_ 開頭，或舊格式 JWT 裡 role 是 service_role 的）：那種金鑰絕對不能出現在前端。
 */
export function parseCloudConfig(env: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_PUBLISHABLE_KEY?: string }): CloudConfig | null {
  const url = (env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '')
  const publishableKey = (env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim()
  if (!/^https?:\/\/[^\s/]+$/.test(url) || publishableKey === '' || /\s/.test(publishableKey)) return null
  if (isSecretKey(publishableKey)) return null
  return { url, publishableKey }
}

/** 是不是不該放在前端的秘密金鑰 */
export function isSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true
  const payload = key.split('.')[1]
  if (!payload) return false
  try {
    const json: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json === 'object' && json !== null && (json as { role?: unknown }).role === 'service_role'
  } catch {
    return false
  }
}

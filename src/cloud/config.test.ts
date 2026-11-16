import { describe, expect, it } from 'vitest'
import { isSecretKey, parseCloudConfig } from './config.ts'

const jwt = (payload: object) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(payload))}.sig`

describe('Supabase 設定', () => {
  it('兩個變數都有時回傳設定，並去掉空白與結尾的斜線', () => {
    expect(parseCloudConfig({ VITE_SUPABASE_URL: ' https://abc.supabase.co/ ', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x\r' })).toEqual({
      url: 'https://abc.supabase.co',
      publishableKey: 'sb_publishable_x',
    })
  })

  it('缺任何一個、或是空字串時回傳 null（只有訪客模式）', () => {
    expect(parseCloudConfig({})).toBeNull()
    expect(parseCloudConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co' })).toBeNull()
    expect(parseCloudConfig({ VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' })).toBeNull()
  })

  it('網址格式不對時回傳 null', () => {
    expect(parseCloudConfig({ VITE_SUPABASE_URL: 'abc.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' })).toBeNull()
    expect(parseCloudConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co/rest/v1', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' })).toBeNull()
  })

  it('拒絕秘密金鑰', () => {
    expect(isSecretKey('sb_secret_abc')).toBe(true)
    expect(isSecretKey(jwt({ role: 'service_role' }))).toBe(true)
    expect(isSecretKey(jwt({ role: 'anon' }))).toBe(false)
    expect(isSecretKey('sb_publishable_abc')).toBe(false)
    expect(parseCloudConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abc' })).toBeNull()
  })
})

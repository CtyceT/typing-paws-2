import { expect, it } from 'vitest'
import { supabase } from './supabase.ts'

it('測試環境不會連到真的 Supabase', () => {
  expect(supabase).toBeNull()
})

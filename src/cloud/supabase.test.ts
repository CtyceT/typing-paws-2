import { expect, it } from 'vitest'
import { defaultCloud } from './index.ts'

it('測試環境不會連到真的 Supabase', () => {
  expect(defaultCloud).toBeNull()
})

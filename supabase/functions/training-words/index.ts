// 弱點特訓出題的 Edge Function（Deno）。流程都在 _shared/training/handler.ts，這裡只負責把環境變數接上去。
// 金鑰來源：GEMINI_API_KEY、GROQ_API_KEY 是在 Supabase 後台設定的 secrets；
// SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY 由 Supabase 自動提供。
import { supabaseBackend } from '../_shared/training/backend.ts'
import { createTrainingHandler, DEFAULT_ALLOWED_ORIGINS } from '../_shared/training/handler.ts'
import { geminiProvider, groqProvider, type LlmProvider } from '../_shared/training/providers.ts'

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): unknown }

const env = (name: string) => (Deno.env.get(name) ?? '').trim()

const providers: LlmProvider[] = []
if (env('GEMINI_API_KEY')) providers.push(geminiProvider(env('GEMINI_API_KEY')))
if (env('GROQ_API_KEY')) providers.push(groqProvider(env('GROQ_API_KEY')))

// 要多開放其他網址（例如自訂網域）時，設定 ALLOWED_ORIGINS（逗號分隔）
const extraOrigins = env('ALLOWED_ORIGINS').split(',').map((s) => s.trim()).filter(Boolean)

Deno.serve(
  createTrainingHandler({
    backend: supabaseBackend(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY')),
    providers,
    allowedOrigins: [...DEFAULT_ALLOWED_ORIGINS, ...extraOrigins],
  }),
)

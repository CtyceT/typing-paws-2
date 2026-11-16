// 出題 prompt 的版本登記。每個版本一個檔案（v1.ts、v2.ts…），用量紀錄（ai_usage.prompt_version）和快取鍵都帶著版本號。
import type { TrainingRequest } from '../request.ts'
import { PROMPT_V1 } from './v1.ts'

export interface PromptTemplate {
  /** 版本號，例如 v1 */
  version: string
  temperature: number
  /** 角色設定（system prompt） */
  system: string
  /** 依請求組出 user prompt */
  user(req: TrainingRequest): string
}

export const PROMPTS: Readonly<Record<string, PromptTemplate>> = { [PROMPT_V1.version]: PROMPT_V1 }

/** 線上使用的版本 */
export const CURRENT_PROMPT_VERSION = PROMPT_V1.version

/** 組好要送給 LLM 的內容 */
export interface BuiltPrompt {
  version: string
  temperature: number
  system: string
  user: string
}

/** 出題 prompt 組合函式（ROADMAP 4.4）：弱點、難度、主題 → prompt。版本不存在時丟出例外 */
export function buildTrainingPrompt(req: TrainingRequest, version: string = CURRENT_PROMPT_VERSION): BuiltPrompt {
  const template = PROMPTS[version]
  if (!template) throw new Error(`沒有這個 prompt 版本：${version}`)
  return { version: template.version, temperature: template.temperature, system: template.system, user: template.user(req) }
}

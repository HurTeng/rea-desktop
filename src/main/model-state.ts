import type { JsonObject } from '../shared/types'

export interface FunctionCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: FunctionCall[]
  tool_call_id?: string
  reasoning_content?: string
  nativeOutput?: JsonObject[]
}

// 只在完整工具轮次之间保存，恢复时不会留下无结果的工具调用。
export interface ModelRunState {
  questionId: string
  question: string
  replyId: string
  configurationKey: string
  messages: ChatMessage[]
  answer: string
  toolRounds: number
  finished?: boolean
}

// 保守估算，包含中文和工具定义；服务端实际上下文限制另行处理。
export function estimateTokens(value: unknown): number {
  const text = JSON.stringify(value)
  const nonAscii = text.match(/[\u0080-\uffff]/g)?.length ?? 0
  return Math.ceil((text.length - nonAscii) / 3 + nonAscii * 2)
}

export function appendAnswer(previous: string, next: string): string {
  if (!previous) return next
  // 续写偶尔会重复上一段末尾，合并时去掉精确重叠。
  for (let size = Math.min(previous.length, next.length); size >= 20; size--) {
    if (previous.endsWith(next.slice(0, size))) return previous + next.slice(size)
  }
  return previous + next
}

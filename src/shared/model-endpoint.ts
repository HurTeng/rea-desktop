import type { ModelProtocol } from './types'

/** 接受 API 基础地址或完整的 Chat Completions 地址。 */
export function chatCompletionUrl(baseUrl: string): string {
  const url = new URL(baseUrl.trim())
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('模型服务地址需要使用 HTTP 或 HTTPS。')
  if (url.username || url.password || url.search || url.hash)
    throw new Error('模型地址不能包含凭据、查询参数或锚点。')

  let path = url.pathname.replace(/\/+$/, '')
  // 裸域名按 OpenAI 兼容约定补 /v1，本地服务（Ollama、LM Studio、vLLM）常直接填主机地址。
  if (!path) path = '/v1'
  // 方舟采用 /api/v3；兼容旧界面提示造成的裸域名或 /v1 配置。
  if (/^ark\.[a-z0-9-]+\.volces\.com$/.test(url.hostname) && path === '/v1') path = '/api/v3'
  url.pathname = path.endsWith('/chat/completions') ? path : `${path}/chat/completions`
  return url.toString()
}

export function modelEndpoint(baseUrl: string, protocol: ModelProtocol): string {
  if (protocol === 'chat-completions') return chatCompletionUrl(baseUrl)
  const url = new URL(baseUrl.trim())
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('模型地址需要使用 HTTP 或 HTTPS，且不能包含凭据、查询参数或锚点。')
  let path = url.pathname.replace(/\/+$/, '')
  const suffix = protocol === 'anthropic' ? '/messages' : '/responses'
  if (!path.endsWith(suffix)) {
    if (protocol === 'anthropic' && !path.endsWith('/v1')) path += '/v1'
    if (protocol === 'responses' && !path) path = '/v1'
    path += suffix
  }
  url.pathname = path
  return url.toString()
}

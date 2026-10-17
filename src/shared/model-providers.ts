import type { ModelProtocol } from './types'

export interface ModelProvider {
  id: string
  name: string
  nameEn: string
  group: 'local' | 'global' | 'china'
  protocol: ModelProtocol
  baseUrl: string
  model?: string
  modelPlaceholder?: string
}

// 只收录服务商公开的 OpenAI/Anthropic 兼容地址，不含任何密钥或账号信息。
// 本地服务（Ollama、LM Studio、vLLM 等）不需要密钥，API Key 留空即可。
export const MODEL_PROVIDERS: ModelProvider[] = [
  {
    id: 'ollama',
    name: 'Ollama',
    nameEn: 'Ollama',
    group: 'local',
    protocol: 'chat-completions',
    baseUrl: 'http://localhost:11434/v1',
    modelPlaceholder: 'qwen3:8b'
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    nameEn: 'LM Studio',
    group: 'local',
    protocol: 'chat-completions',
    baseUrl: 'http://localhost:1234/v1',
    modelPlaceholder: 'loaded-model-id'
  },
  {
    id: 'vllm',
    name: 'vLLM / SGLang',
    nameEn: 'vLLM / SGLang',
    group: 'local',
    protocol: 'chat-completions',
    baseUrl: 'http://localhost:8000/v1',
    modelPlaceholder: 'served-model-name'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    nameEn: 'OpenAI',
    group: 'global',
    protocol: 'chat-completions',
    baseUrl: 'https://api.openai.com/v1'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    nameEn: 'Anthropic',
    group: 'global',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    nameEn: 'OpenRouter',
    group: 'global',
    protocol: 'chat-completions',
    baseUrl: 'https://openrouter.ai/api/v1'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    nameEn: 'Google Gemini',
    group: 'global',
    protocol: 'chat-completions',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai'
  },
  {
    id: 'groq',
    name: 'Groq',
    nameEn: 'Groq',
    group: 'global',
    protocol: 'chat-completions',
    baseUrl: 'https://api.groq.com/openai/v1'
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    nameEn: 'xAI Grok',
    group: 'global',
    protocol: 'chat-completions',
    baseUrl: 'https://api.x.ai/v1'
  },
  {
    id: 'mistral',
    name: 'Mistral',
    nameEn: 'Mistral',
    group: 'global',
    protocol: 'chat-completions',
    baseUrl: 'https://api.mistral.ai/v1'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    nameEn: 'DeepSeek',
    group: 'china',
    protocol: 'chat-completions',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash'
  },
  {
    id: 'ark',
    name: '火山方舟',
    nameEn: 'Volcano Ark',
    group: 'china',
    protocol: 'chat-completions',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    modelPlaceholder: 'ep-xxxxxxxx 或模型 ID'
  },
  {
    id: 'ark-coding',
    name: '火山 Coding Plan',
    nameEn: 'Volcano Coding Plan',
    group: 'china',
    protocol: 'anthropic',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/coding'
  },
  {
    id: 'dashscope',
    name: '阿里云百炼',
    nameEn: 'Alibaba Bailian',
    group: 'china',
    protocol: 'chat-completions',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    nameEn: 'Zhipu GLM',
    group: 'china',
    protocol: 'chat-completions',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4'
  },
  {
    id: 'moonshot',
    name: '月之暗面 Kimi',
    nameEn: 'Moonshot Kimi',
    group: 'china',
    protocol: 'chat-completions',
    baseUrl: 'https://api.moonshot.cn/v1'
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    nameEn: 'SiliconFlow',
    group: 'china',
    protocol: 'chat-completions',
    baseUrl: 'https://api.siliconflow.cn/v1'
  },
  {
    id: 'modelscope',
    name: '魔搭 ModelScope',
    nameEn: 'ModelScope',
    group: 'china',
    protocol: 'chat-completions',
    baseUrl: 'https://api-inference.modelscope.cn/v1'
  },
  {
    id: 'hunyuan',
    name: '腾讯混元',
    nameEn: 'Tencent Hunyuan',
    group: 'china',
    protocol: 'chat-completions',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1'
  },
  {
    id: 'qianfan',
    name: '百度千帆',
    nameEn: 'Baidu Qianfan',
    group: 'china',
    protocol: 'chat-completions',
    baseUrl: 'https://qianfan.baidubce.com/v2'
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    nameEn: 'MiniMax',
    group: 'china',
    protocol: 'chat-completions',
    baseUrl: 'https://api.minimaxi.com/v1'
  },
  {
    id: 'stepfun',
    name: '阶跃星辰',
    nameEn: 'StepFun',
    group: 'china',
    protocol: 'chat-completions',
    baseUrl: 'https://api.stepfun.com/v1'
  }
]

export const PROVIDER_GROUPS: { id: ModelProvider['group']; label: string; labelEn: string }[] = [
  { id: 'local', label: '本地模型', labelEn: 'Local models' },
  { id: 'global', label: '国际服务', labelEn: 'Global services' },
  { id: 'china', label: '国内服务', labelEn: 'China services' }
]

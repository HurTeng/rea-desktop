import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import type { CCSwitchCandidate, SettingsInput } from '../shared/types'
import { object, runtimePaths } from './rea'
import { saveSettings } from './storage'

// Electron 自身没有 node:sqlite；使用随应用分发的 Node，只读打开数据库。
const READ_PROVIDERS = `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.argv[1], { readOnly: true });
try { process.stdout.write(JSON.stringify(db.prepare('SELECT id, app_type, name, settings_config, is_current FROM providers ORDER BY is_current DESC, name').all())); }
finally { db.close(); }
`
interface Candidate extends CCSwitchCandidate {
  input?: SettingsInput
}

async function candidates(): Promise<Candidate[]> {
  const path = join(homedir(), '.cc-switch', 'cc-switch.db')
  let stdout: string
  try {
    ;({ stdout } = await promisify(execFile)(
      runtimePaths().command,
      ['--no-warnings', '-e', READ_PROVIDERS, path],
      { maxBuffer: 8 * 1024 * 1024, timeout: 10_000 }
    ))
  } catch (error) {
    if (String(error).includes('unable to open database'))
      throw new Error(`未找到 CC Switch 数据库：${path}`)
    throw new Error('无法读取 CC Switch 数据库，请确认已安装并配置 CC Switch。')
  }
  const rows = JSON.parse(stdout) as Record<string, unknown>[]
  const result: Candidate[] = []
  for (const row of rows) {
    const app = String(row.app_type)
    if (!['claude', 'claude-desktop', 'codex', 'opencode', 'pi'].includes(app)) continue
    const id = `cc-switch:${app}:${row.id}`
    const candidate: Candidate = {
      id,
      name: `${row.name} · ${app}`,
      protocol: 'chat-completions',
      baseUrl: '',
      model: '',
      hasApiKey: false,
      current: Boolean(row.is_current),
      available: false,
      source: 'CC Switch'
    }
    try {
      const settings = object(JSON.parse(String(row.settings_config)))
      const env = object(settings.env)
      let apiKey = ''
      if (app === 'claude' || app === 'claude-desktop') {
        candidate.protocol = 'anthropic'
        candidate.baseUrl = String(env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com')
        candidate.model = String(env.ANTHROPIC_MODEL || env.ANTHROPIC_DEFAULT_SONNET_MODEL || '')
        apiKey = String(env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_API_KEY || '')
      } else if (app === 'codex') {
        const config =
          typeof settings.config === 'string'
            ? object(parse(settings.config))
            : object(settings.config)
        const provider = object(object(config.model_providers)[String(config.model_provider)])
        candidate.protocol = provider.wire_api === 'chat' ? 'chat-completions' : 'responses'
        candidate.baseUrl = String(provider.base_url || 'https://api.openai.com/v1')
        candidate.model = String(config.model || '')
        const auth = object(settings.auth)
        apiKey = String(auth.OPENAI_API_KEY || '')
        if (!apiKey && typeof provider.env_key === 'string')
          apiKey = process.env[provider.env_key] || ''
      } else if (app === 'opencode') {
        const options = object(settings.options)
        candidate.protocol = String(settings.npm).includes('anthropic')
          ? 'anthropic'
          : 'chat-completions'
        candidate.baseUrl = String(options.baseURL || '')
        candidate.model = Object.keys(object(settings.models))[0] || ''
        apiKey = String(options.apiKey || '')
      } else {
        candidate.protocol = String(settings.api).includes('anthropic')
          ? 'anthropic'
          : String(settings.api).includes('responses')
            ? 'responses'
            : 'chat-completions'
        candidate.baseUrl = String(settings.baseUrl || '')
        const first = Array.isArray(settings.models) ? settings.models[0] : null
        candidate.model = typeof first === 'string' ? first : String(object(first).id || '')
        apiKey = String(settings.apiKey || '')
      }
      candidate.hasApiKey = Boolean(apiKey && !apiKey.startsWith('{env:'))
      candidate.available = Boolean(candidate.baseUrl && candidate.model && candidate.hasApiKey)
      if (candidate.available)
        candidate.input = {
          id,
          name: candidate.name,
          protocol: candidate.protocol,
          baseUrl: candidate.baseUrl,
          model: candidate.model,
          apiKey
        }
      else
        candidate.reason = !candidate.hasApiKey
          ? '没有可导入的 API Key（官方订阅登录/OAuth 或环境变量不属于 API Key 配置）'
          : '缺少服务地址或默认模型，请手动新建配置'
    } catch {
      candidate.reason = '配置格式无法识别，请手动新建配置'
    }
    result.push(candidate)
  }
  return result
}

export async function listCCSwitch(): Promise<CCSwitchCandidate[]> {
  return (await candidates()).map((candidate) => {
    const value = { ...candidate }
    delete value.input
    return value
  })
}

export async function importCCSwitch(id: string): ReturnType<typeof saveSettings> {
  const candidate = (await candidates()).find((item) => item.id === id)
  if (!candidate?.input) throw new Error(candidate?.reason || 'CC Switch 配置不存在。')
  return saveSettings(candidate.input, 'CC Switch')
}

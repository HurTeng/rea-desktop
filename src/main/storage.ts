import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { app, safeStorage } from 'electron'
import { modelEndpoint } from '../shared/model-endpoint'
import type { ModelRunState } from './model-state'
import type {
  EvidencePreview,
  AppearancePreferences,
  JsonObject,
  ModelSettings,
  ModelProfile,
  ModelProtocol,
  SettingsInput,
  Task,
  TaskOverview
} from '../shared/types'

interface StoredProfile {
  id: string
  name: string
  protocol: ModelProtocol
  baseUrl: string
  model: string
  encryptedKey?: string
  source?: string
}

interface StoredSettings {
  activeId: string
  profiles: StoredProfile[]
}

export function dataDirectory(): string {
  return join(app.getPath('userData'), 'workspace')
}

export function taskDirectory(id: string): string {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('任务 ID 无效。')
  return join(dataDirectory(), 'tasks', id)
}

export function bundlePath(id: string): string {
  return join(taskDirectory(id), 'evidence.json')
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const staging = `${path}.${randomUUID()}.tmp`
  await writeFile(staging, JSON.stringify(value, null, 2), { mode: 0o600 })
  await rename(staging, path)
}

export async function loadTask(id: string): Promise<Task> {
  const task = JSON.parse(await readFile(join(taskDirectory(id), 'task.json'), 'utf8')) as Task
  // 上一次退出时未完成的任务可以继续追问，界面显示为已中断。
  if (task.status === 'analyzing' || task.status === 'answering') task.status = 'cancelled'
  return task
}

export async function saveTask(task: Task): Promise<void> {
  await writeJson(join(taskDirectory(task.id), 'task.json'), task)
}

export async function loadModelRun(id: string): Promise<ModelRunState | null> {
  try {
    return JSON.parse(await readFile(join(taskDirectory(id), 'model-run.json'), 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    return null
  }
}

export async function saveModelRun(id: string, state: ModelRunState): Promise<void> {
  await writeJson(join(taskDirectory(id), 'model-run.json'), state)
}

export async function clearModelRun(id: string): Promise<void> {
  await rm(join(taskDirectory(id), 'model-run.json'), { force: true })
}

export async function listTasks(): Promise<TaskOverview[]> {
  const directory = join(dataDirectory(), 'tasks')
  await mkdir(directory, { recursive: true })
  const entries = await readdir(directory, { withFileTypes: true })
  const tasks: TaskOverview[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[a-f0-9-]{36}$/.test(entry.name)) continue
    const task = await loadTask(entry.name)
    tasks.push({
      id: task.id,
      title: task.title,
      targetName: task.target.name,
      status: task.status,
      updatedAt: task.updatedAt
    })
  }
  return tasks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function removeTask(id: string): Promise<void> {
  await rm(taskDirectory(id), { recursive: true, force: true })
}

export async function clearTaskDirectories(): Promise<number> {
  const directory = join(dataDirectory(), 'tasks')
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
  const ids = entries
    .filter((entry) => entry.isDirectory() && /^[a-f0-9-]{36}$/.test(entry.name))
    .map((entry) => entry.name)
  for (const id of ids) await rm(join(directory, id), { recursive: true, force: true })
  return ids.length
}

export async function saveEvidence(
  taskId: string,
  evidence: JsonObject,
  metadata: JsonObject
): Promise<void> {
  const id = String(evidence.evidence_id)
  if (!/^ev_[a-f0-9]{64}$/.test(id)) throw new Error('REA 返回了无效的证据 ID。')
  await writeJson(join(taskDirectory(taskId), 'records', `${id}.json`), {
    evidence,
    _meta: metadata
  })
}

export async function loadEvidence(
  taskId: string,
  id: string,
  maxCharacters = 100_000
): Promise<EvidencePreview> {
  if (!/^(ev|obs)_[a-f0-9]{64}$/.test(id)) throw new Error('证据 ID 无效。')
  const text = await readFile(join(taskDirectory(taskId), 'records', `${id}.json`), 'utf8')
  return { id, text: text.slice(0, maxCharacters), truncated: text.length > maxCharacters }
}

async function storedSettings(): Promise<StoredSettings> {
  try {
    const value = JSON.parse(await readFile(join(dataDirectory(), 'settings.json'), 'utf8'))
    if (Array.isArray(value.profiles)) return value
    return {
      activeId: 'legacy',
      profiles: [{ ...value, id: 'legacy', name: '原有配置', protocol: 'chat-completions' }]
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    return { activeId: '', profiles: [] }
  }
}

function publicProfile(profile: StoredProfile): ModelProfile {
  return {
    id: profile.id,
    name: profile.name,
    protocol: profile.protocol,
    baseUrl: profile.baseUrl,
    model: profile.model,
    hasApiKey: Boolean(profile.encryptedKey),
    source: profile.source
  }
}

export async function getSettings(): Promise<ModelSettings> {
  const settings = await storedSettings()
  const profiles = settings.profiles.map(publicProfile)
  const active = profiles.find((profile) => profile.id === settings.activeId)
  return {
    ...(active ?? {
      id: '',
      name: '',
      protocol: 'chat-completions' as const,
      baseUrl: 'https://api.openai.com/v1',
      model: '',
      hasApiKey: false
    }),
    profiles
  }
}

export interface ModelConfiguration {
  baseUrl: string
  model: string
  apiKey: string
  protocol: ModelProtocol
}

export async function modelConfiguration(input?: SettingsInput): Promise<ModelConfiguration> {
  const settings = await storedSettings()
  const previous = settings.profiles.find(
    (profile) => profile.id === (input ? input.id : settings.activeId)
  )
  const apiKey = input?.clearApiKey
    ? ''
    : input?.apiKey?.trim() ||
      (previous?.encryptedKey
        ? safeStorage.decryptString(Buffer.from(previous.encryptedKey, 'base64'))
        : '')
  const baseUrl = (input?.baseUrl ?? previous?.baseUrl ?? '').trim().replace(/\/+$/, '')
  const model = (input?.model ?? previous?.model ?? '').trim()
  const protocol = input?.protocol ?? previous?.protocol ?? 'chat-completions'
  if (!model) throw new Error('请先在模型设置中填写模型名称。')
  modelEndpoint(baseUrl, protocol)
  return { baseUrl, model, apiKey, protocol }
}

export async function saveSettings(input: SettingsInput, source?: string): Promise<ModelSettings> {
  const settings = await storedSettings()
  const previous = settings.profiles.find((profile) => profile.id === input.id)
  const configuration = await modelConfiguration(input)
  let encryptedKey = input.clearApiKey ? undefined : previous?.encryptedKey
  if (input.apiKey?.trim()) {
    if (
      !safeStorage.isEncryptionAvailable() ||
      (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')
    )
      throw new Error('系统密钥存储不可用，无法安全保存 API Key。可连接无需密钥的本地模型服务。')
    encryptedKey = safeStorage.encryptString(configuration.apiKey).toString('base64')
  }
  const profile: StoredProfile = {
    id: input.id || randomUUID(),
    name: input.name?.trim() || configuration.model,
    protocol: configuration.protocol,
    baseUrl: configuration.baseUrl,
    model: configuration.model,
    encryptedKey,
    source: source ?? previous?.source
  }
  const index = settings.profiles.findIndex((item) => item.id === profile.id)
  if (index >= 0) settings.profiles[index] = profile
  else settings.profiles.push(profile)
  settings.activeId = profile.id
  await writeJson(join(dataDirectory(), 'settings.json'), settings)
  return getSettings()
}

export async function activateModel(id: string): Promise<ModelSettings> {
  const settings = await storedSettings()
  if (!settings.profiles.some((profile) => profile.id === id)) throw new Error('模型配置不存在。')
  settings.activeId = id
  await writeJson(join(dataDirectory(), 'settings.json'), settings)
  return getSettings()
}

export async function deleteModel(id: string): Promise<ModelSettings> {
  const settings = await storedSettings()
  settings.profiles = settings.profiles.filter((profile) => profile.id !== id)
  if (settings.activeId === id) settings.activeId = settings.profiles[0]?.id ?? ''
  await writeJson(join(dataDirectory(), 'settings.json'), settings)
  return getSettings()
}

export async function getPreferences(): Promise<AppearancePreferences | null> {
  try {
    return JSON.parse(
      await readFile(join(dataDirectory(), 'preferences.json'), 'utf8')
    ) as AppearancePreferences
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    return null
  }
}

export async function savePreferences(preferences: AppearancePreferences): Promise<void> {
  await writeJson(join(dataDirectory(), 'preferences.json'), preferences)
}

export async function listToolRuns(): Promise<import('../shared/types').ToolRunOverview[]> {
  const directory = join(dataDirectory(), 'tool-runs')
  await mkdir(directory, { recursive: true })
  const names = (await readdir(directory))
    .filter((name) => /^\d+-[a-f0-9-]{36}\.json$/.test(name))
    .sort()
    .reverse()
    .slice(0, 30)
  return Promise.all(
    names.map(async (id) => {
      const record = await readToolRun(id)
      return {
        id,
        tool: String(record.tool),
        createdAt: String(record.createdAt),
        taskId: typeof record.taskId === 'string' ? record.taskId : null
      }
    })
  )
}
export async function readToolRun(id: string): Promise<JsonObject> {
  if (!/^\d+-[a-f0-9-]{36}\.json$/.test(id)) throw new Error('工具记录 ID 无效。')
  return JSON.parse(await readFile(join(dataDirectory(), 'tool-runs', id), 'utf8')) as JsonObject
}

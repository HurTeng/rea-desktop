import { object } from '../shared/json'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { app } from 'electron'
import { dirname, join } from 'node:path'
import { access, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { EngineStatus, EngineTool, JsonObject, Task } from '../shared/types'
import { bundlePath } from './storage'
import { getEngineSettings } from './engine-settings'

export const REA_VERSION = '6.5.0'
export type ReaTool = Awaited<ReturnType<Client['listTools']>>['tools'][number]

export { object } from '../shared/json'

export function runtimePaths(preferSource = true): { command: string; script: string } {
  const root = app.isPackaged ? join(process.resourcesPath, 'app.asar.unpacked') : app.getAppPath()
  const runtime = app.isPackaged
    ? join(process.resourcesPath, 'runtime')
    : join(root, 'resources', 'runtime')
  const command = join(runtime, process.platform === 'win32' ? 'node.exe' : 'node')
  const source = join(root, 'node_modules', 'rea-agents', 'desktop-source')
  const script =
    preferSource && existsSync(join(source, 'manifest.json'))
      ? join(source, 'scripts', 'rea.mjs')
      : join(root, 'node_modules', 'rea-agents', 'scripts', 'rea.mjs')
  return { command, script }
}

export async function bundledCatalog(): Promise<EngineStatus | null> {
  if ((await getEngineSettings()).command) return null
  const { command, script } = runtimePaths()
  const buildType = script.includes('desktop-source') ? 'source' : 'release'
  const catalog = JSON.parse(
    await readFile(join(dirname(command), `${buildType}-catalog.json`), 'utf8')
  ) as EngineStatus
  return { ...catalog, runtime: command, entrypoint: script }
}

export class ReaConnection {
  private client: Client | null = null
  taskId: string | null = null
  tools: ReaTool[] = []
  available = new Set<string>()
  lastMetadata: JsonObject = {}
  status: EngineStatus = { version: REA_VERSION, tools: [], providers: [], runtime: '' }
  private configurationKey = ''
  private boundPath: string | null = null
  private entrypoint = ''
  private buildType: EngineStatus['buildType'] = 'release'

  async connect(
    task: Pick<Task, 'id' | 'bundleSaved' | 'engine'>,
    signal: AbortSignal,
    catalogOnly = false
  ): Promise<boolean> {
    signal.throwIfAborted()
    const configuration = await getEngineSettings()
    const { command, script } = runtimePaths(task.engine !== 'release')
    const configurationKey = JSON.stringify([configuration, script])
    if (this.client && this.taskId === task.id && this.configurationKey === configurationKey) {
      if (!catalogOnly && this.status.availabilityPending) {
        await this.refresh(signal)
        return true
      }
      return false
    }
    await this.close()
    signal.throwIfAborted()
    if (!configuration.command) await Promise.all([access(command), access(script)])
    signal.throwIfAborted()
    const transport = new StdioClientTransport({
      command: configuration.command || command,
      args: configuration.command ? configuration.arguments || [] : [script, 'mcp'],
      stderr: 'pipe',
      cwd: app.getPath('userData'),
      env: Object.fromEntries(
        Object.entries({ ...process.env, ...configuration.environment }).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string'
        )
      )
    })
    const client = new Client({ name: 'rea-desktop', version: app.getVersion() })
    this.client = client
    this.taskId = task.id
    this.configurationKey = configurationKey
    this.entrypoint = script
    this.buildType = configuration.command
      ? 'custom'
      : script.includes('desktop-source')
        ? 'source'
        : 'release'
    // 将 REA 诊断保留到开发日志，不转发模型密钥或进程环境。
    transport.stderr?.on('data', (chunk) => console.warn('[REA]', String(chunk).trim()))
    client.onclose = () => {
      if (this.client === client) {
        this.client = null
        this.taskId = null
      }
    }
    try {
      await client.connect(transport, { signal, timeout: 60_000 })
      signal.throwIfAborted()
      const catalog = await client.listTools({}, { signal, timeout: 60_000 })
      this.tools = catalog.tools
      let cursor = catalog.nextCursor
      while (cursor) {
        const page = await client.listTools({ cursor }, { signal, timeout: 60_000 })
        this.tools.push(...page.tools)
        cursor = page.nextCursor
      }
      this.status = {
        version: REA_VERSION,
        entrypoint: this.entrypoint,
        buildType: this.buildType,
        tools: [],
        providers: [],
        runtime: configuration.command || command
      }
      this.status = this.catalogStatus()
      // 浏览目录不需要探测外部依赖，也不需要恢复任务证据包。
      if (catalogOnly) return true
      await this.refresh(signal)
      if (task.bundleSaved) {
        try {
          await this.call('import_evidence_bundle', { path: bundlePath(task.id) }, signal)
        } catch (error) {
          // The source checkout can change Evidence schemas without a release-version
          // bump. Keep historical bundles with their original runtime, never rewrite
          // or strip their provenance to make a newer schema accept them.
          if (
            !task.engine &&
            !configuration.command &&
            script.includes('desktop-source') &&
            error instanceof Error &&
            error.message.includes('Evidence bundle validation failed')
          ) {
            await this.close()
            task.engine = 'release'
            return this.connect(task, signal)
          }
          throw error
        }
      }
      task.engine = script.includes('desktop-source') ? 'source' : 'release'
      return true
    } catch (error) {
      await this.close()
      throw error
    }
  }

  catalogStatus(): EngineStatus {
    return {
      ...this.status,
      availabilityPending: true,
      warning: undefined,
      tools: this.tools.map((tool) => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: object(tool.inputSchema),
        available: false,
        reason: 'availability_unknown',
        remediation: null,
        effects: ['mutatesTarget', 'executesForeignCode', 'mayDiscardData']
      }))
    }
  }

  async refresh(signal?: AbortSignal): Promise<EngineStatus> {
    const args = { expected_package_version: REA_VERSION }
    let session: JsonObject = {}
    let warning: string | undefined
    try {
      session = object((await this.call('binary_session', args, signal)).result)
    } catch (error) {
      // 外部提供方探测失败时保留完整目录，不自动重试并重复等待。
      signal?.throwIfAborted()
      warning = `环境自检未完成，可继续浏览工具或稍后刷新：${error instanceof Error ? error.message : String(error)}`
    }
    const inventory = session.tool_availability
    const groups = Array.isArray(inventory) ? inventory : object(inventory).groups
    if (!Array.isArray(groups) && !warning) {
      throw new Error('REA 的工具可用性格式与当前客户端版本不匹配。')
    }
    const entries = new Map<string, EngineTool>()
    for (const item of Array.isArray(groups) ? groups : []) {
      const entry = object(item)
      const names =
        typeof entry.name === 'string'
          ? [entry.name]
          : Array.isArray(entry.names)
            ? entry.names.map(String)
            : []
      for (const name of names) {
        const tool = this.tools.find((candidate) => candidate.name === name)
        if (!tool) continue
        const effects = Array.isArray(entry.effects)
          ? entry.effects.map(String)
          : Object.entries(object(entry.effects))
              .filter(([, value]) => value === true)
              .map(([key]) => key)
        entries.set(name, {
          name,
          description: tool.description || '',
          inputSchema: object(tool.inputSchema),
          available: entry.available === true,
          reason: String(entry.reason ?? ''),
          remediation: typeof entry.remediation === 'string' ? entry.remediation : null,
          effects
        })
      }
    }
    this.available = new Set(
      [...entries.values()].filter((tool) => tool.available).map((tool) => tool.name)
    )
    const { command } = runtimePaths()
    this.status = {
      version: REA_VERSION,
      entrypoint: this.entrypoint,
      buildType: this.buildType,
      tools: this.tools.map(
        (tool) =>
          entries.get(tool.name) ?? {
            name: tool.name,
            description: tool.description || '',
            inputSchema: object(tool.inputSchema),
            available: false,
            reason: warning ?? 'REA did not report availability for this tool.',
            remediation: null,
            // 自检失败不代表操作没有影响。保留已知声明；未知时必须显式确认。
            effects: this.status.tools.find((item) => item.name === tool.name)?.effects ?? [
              'mutatesTarget',
              'executesForeignCode',
              'mayDiscardData'
            ]
          }
      ),
      providers: Array.isArray(session.analysis_provider_candidates)
        ? session.analysis_provider_candidates.map(object)
        : [],
      runtime: (await getEngineSettings()).command || command,
      ...(warning ? { warning } : {})
    }
    return this.status
  }

  async openTarget(task: Pick<Task, 'target'>, signal: AbortSignal): Promise<JsonObject> {
    if (this.boundPath === task.target.inputPath) return {}
    const configuration = await getEngineSettings()
    const result = await this.call(
      'open_binary',
      {
        path: task.target.inputPath,
        ...(task.target.format === 'dos-com' ? { format: 'dos-com' } : {}),
        ...(configuration.provider === 'auto' ? {} : { provider_id: configuration.provider })
      },
      signal
    )
    this.boundPath = task.target.inputPath
    await this.refresh(signal)
    return result
  }

  async call(name: string, args: JsonObject, signal?: AbortSignal): Promise<JsonObject> {
    if (!this.client) throw new Error('REA 连接已关闭，请重新运行当前任务。')
    if (name === 'open_binary' || name === 'close_binary') this.boundPath = null
    const reply = await this.client.callTool(
      { name, arguments: args },
      {
        signal,
        ...(name === 'binary_session' ? { maxTotalTimeout: 8_000 } : {}),
        timeout:
          name === 'binary_session'
            ? 8_000
            : Math.min(
                2_147_483_647,
                Math.max(
                  1_860_000,
                  ...['duration_ms', 'timeout_ms', 'analysis_timeout_ms'].map((key) =>
                    typeof args[key] === 'number' ? Number(args[key]) + 60_000 : 0
                  )
                )
              )
      }
    )
    this.lastMetadata = object(reply._meta)
    const text = (reply.content ?? [])
      .flatMap((item) => (item.type === 'text' ? [item.text] : []))
      .join('\n')
    if (reply.isError) {
      let diagnostic: JsonObject | null = null
      try {
        diagnostic = object(object(JSON.parse(text)).error)
      } catch {
        /* 非 JSON 诊断保留原文。 */
      }
      // 结果超过 MCP 传输预算时引擎已完成分析并保留证据，只把可读结论带回界面。
      if (diagnostic?.code === 'resource_constraint') {
        const evidence = String(object(diagnostic.details).evidence_id ?? '')
        throw new Error(
          `分析已完成，但完整结果超过 MCP 传输预算（约 10 MiB），无法一次传回。${
            evidence ? `完整证据已保留在引擎中（evidence_id: ${evidence}）。` : ''
          }请改用摘要模式重新分析，或在 REA 工具面板中按证据 ID 读取。`
        )
      }
      const message = diagnostic
        ? `${String(diagnostic.code ?? '分析失败')}：${String(diagnostic.message ?? text)}\n${JSON.stringify(diagnostic.details ?? diagnostic.context ?? {})}`
        : text
      throw new Error(message.slice(0, 2000))
    }
    if (reply.structuredContent) return object(reply.structuredContent)
    if (!text) return { content: reply.content ?? [] }
    try {
      const value: unknown = JSON.parse(text)
      return value && typeof value === 'object' && !Array.isArray(value)
        ? object(value)
        : { result: value }
    } catch {
      return { text }
    }
  }

  async export(task: Task): Promise<void> {
    if (this.taskId !== task.id || !this.client || !task.parentEvidenceId) return
    await this.call('export_evidence_bundle', { path: bundlePath(task.id), overwrite: true })
    task.bundleSaved = true
  }

  async close(): Promise<void> {
    const client = this.client
    this.client = null
    this.taskId = null
    this.boundPath = null
    this.tools = []
    this.available.clear()
    this.status = { version: REA_VERSION, tools: [], providers: [], runtime: '' }
    await client?.close()
  }
}

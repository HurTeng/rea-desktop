import { retainedToolArguments } from '../shared/json'
import { recoverCode } from './recovery'
import { randomUUID, createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { JsonObject, Task } from '../shared/types'
import { isJavaScriptTarget } from '../shared/formats'
import { object, type ReaConnection } from './rea'
import { prepareAnalysis } from './analysis'
import { taskDirectory, writeJson } from './storage'

export type RecordTool = (
  name: string,
  args: JsonObject,
  title: string,
  signal?: AbortSignal
) => Promise<JsonObject>

export function resultValue(value: JsonObject): unknown {
  return value.normalized_result ?? value.result ?? value
}

export async function saveObservation(
  task: Task,
  name: string,
  args: JsonObject,
  result: JsonObject,
  metadata: JsonObject
): Promise<string> {
  const record = {
    source:
      'REA Desktop observation of the original REA tool response; this is not a canonical REA Evidence record.',
    target: task.target.inputPath,
    operation: name,
    arguments: retainedToolArguments(args),
    result,
    _meta: metadata
  }
  const id = `obs_${createHash('sha256').update(JSON.stringify(record)).digest('hex')}`
  await writeJson(join(taskDirectory(task.id), 'records', `${id}.json`), record)
  return id
}

export async function analyzeFormat(
  task: Task,
  engine: ReaConnection,
  record: RecordTool,
  signal: AbortSignal,
  progress: (text: string) => void
): Promise<JsonObject> {
  task.analysisFamily =
    task.target.family ?? (isJavaScriptTarget(task.target) ? 'javascript' : 'package')
  task.analysisIssues = []
  task.targetFacts = {
    ...task.targetFacts,
    format: task.target.format,
    managed: task.target.managed,
    packaging: task.target.packaging
  }
  if (isJavaScriptTarget(task.target) && !task.target.appleBundle) {
    progress('正在准备应用架构入口与文件索引')
    const analysis = await prepareAnalysis(task, signal)
    progress('正在使用 REA 分析应用结构与模块')
    return record(
      'analyze_javascript_application',
      { ...analysis, detail: 'summary', max_heap_mb: 2048, analysis_timeout_ms: 30_000 },
      '应用概览',
      signal
    )
  }
  if (task.target.packaging?.kind === 'pyinstaller') {
    progress('正在读取 PyInstaller 归档并提取字节码')
    try {
      task.recovery ??= await recoverCode(task, record, signal)
      const index = object(
        JSON.parse(await readFile(join(task.recovery.directory, 'pyinstaller-index.json'), 'utf8'))
      )
      const entries = Array.isArray(index.entries) ? index.entries.map(object) : []
      const facts = {
        parser: 'REA Desktop PyInstaller CArchive reader',
        python_version:
          index.pythonVersionString ??
          `${Math.floor(Number(index.pythonVersion) / 100)}.${Number(index.pythonVersion) % 100}`,
        python_version_tag: index.pythonVersion,
        archive_entries: entries.length,
        archive_sha256: index.sha256,
        observed_entry_samples: entries
          .filter((entry) =>
            /(?:^main$|PyQt|PySide|Qt5|tkinter|python3|base_library|PYZ|django|flask)/i.test(
              String(entry.name)
            )
          )
          .slice(0, 35)
          .map((entry) => ({ name: entry.name, type: entry.type })),
        limitations: task.recovery.limitations
      }
      task.targetFacts = { ...task.targetFacts, pyinstaller_archive: facts }
      const id = await saveObservation(
        task,
        'desktop_inspect_pyinstaller_archive',
        { path: task.target.inputPath },
        facts,
        {}
      )
      if (!task.evidence.some((item) => item.id === id))
        task.evidence.push({
          id,
          operation: 'desktop_inspect_pyinstaller_archive',
          title: 'PyInstaller 归档与字节码',
          createdAt: new Date().toISOString()
        })
    } catch (error) {
      signal.throwIfAborted()
      task.analysisIssues.push(
        `PyInstaller: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
  const path = task.target.inputPath
  const optional = async (
    name: string,
    args: JsonObject,
    title: string
  ): Promise<JsonObject | null> => {
    if (!engine.available.has(name)) {
      const tool = engine.status.tools.find((item) => item.name === name)
      task.analysisIssues!.push(
        `${name}: ${tool?.reason || 'unavailable'}. ${tool?.remediation || ''}`
      )
      return null
    }
    try {
      progress(`正在读取证据 · ${name}`)
      return await record(name, args, title, signal)
    } catch (error) {
      signal.throwIfAborted()
      task.analysisIssues!.push(
        `${name}: ${error instanceof Error ? error.message : String(error)}`
      )
      return null
    }
  }
  const open = async (): Promise<void> => {
    const opened = await engine.openTarget(task, signal)
    task.targetFacts = { ...task.targetFacts, ...object(opened.result) }
  }
  let primary: JsonObject | null = null
  if (task.target.family === 'managed') {
    primary = await optional(
      'inspect_managed_artifact',
      { path, detail: 'summary' },
      '.NET 程序集概览'
    )
    await optional('inspect_managed_members', { path, detail: 'summary' }, '.NET 类型与 CIL 概览')
  } else if (['har', 'mitmproxy', 'saz', 'qlog'].includes(task.target.format)) {
    primary = await optional(
      'inspect_web_network_capture',
      { capture_path: path, format: task.target.format },
      '网络记录'
    )
  } else if (task.target.format === 'pcap') {
    primary = await optional('inspect_pcap_capture', { path, detail: 'summary' }, 'PCAP 网络记录')
  } else if (task.target.format === 'wasm') {
    primary = await optional('inspect_wasm_artifact', { path, detail: 'summary' }, 'WASM 模块')
  } else if (task.target.format === 'sqlite') {
    primary = await optional('inspect_sqlite_database', { path }, 'SQLite 数据库结构')
  } else if (task.target.format === 'firmware') {
    primary = await optional('inspect_firmware_regions', { path }, '固件区域')
  } else if (task.target.format === 'evm') {
    primary = await optional('inspect_evm_interface', { path, encoding: 'hex' }, 'EVM 字节码接口')
  } else if (task.target.format === 'core') {
    primary = await optional('inspect_recorded_crash', { path }, '崩溃记录')
  } else if (['dex', 'class', 'jeb-project'].includes(task.target.format)) {
    primary = await optional('open_jeb_project', { path }, 'JEB 项目与单元')
  } else if (task.target.format === 'signal') {
    throw new Error('逻辑记录需要明确解码器和通道，请在 REA 工具面板选择 decode_signal_recording。')
  } else if (task.target.format === 'web' && task.target.web) {
    const args = { cdp_endpoint: task.target.web.cdpEndpoint, target_id: task.target.web.targetId }
    primary = await optional('inspect_web_page', args, '网页静态观察')
    await optional('analyze_web_bundle', args, '网页脚本与路由')
  } else if (task.target.family === 'native') {
    if (task.target.format === 'pe')
      primary = await optional(
        'inspect_pe_resources',
        { path, max_file_bytes: Math.min(536870912, Math.max(task.target.bytes || 0, 67108864)) },
        'PE 资源与清单'
      )
    try {
      await open()
      const overview = await optional('binary_overview', {}, '原生程序概览')
      if (overview) primary = overview
      if (task.target.format.startsWith('mach-o'))
        primary ??= await optional('inspect_macho', {}, 'Mach-O 静态结构')
    } catch (error) {
      signal.throwIfAborted()
      task.analysisIssues!.push(error instanceof Error ? error.message : String(error))
    }
    if ((task.target.bytes || 0) <= 268435456) {
      const go = await optional('inspect_go_binary', { path }, 'Go 构建信息')
      primary ??= go
      const rust = await optional('inspect_rust_binary', { path }, 'Rust 依赖信息')
      primary ??= rust
    }
  } else {
    await open()
    if (task.target.appleBundle) {
      // Apple 结构投影需要完整清单 Evidence；只有超出 MCP 传输预算时才退回摘要视图。
      primary =
        (await optional('inspect_artifact', {}, '安装包与文件资源')) ??
        (await optional('inspect_artifact', { detail: 'summary' }, '安装包与文件资源'))
      await optional(
        'project_apple_application_graph',
        { inventory_evidence: primary ? [primary] : [] },
        'Apple 应用结构'
      )
    } else {
      // 完整清单 Evidence 常超出 MCP 传输预算；摘要视图保留同样的清单覆盖范围。
      primary = await optional('inspect_artifact', { detail: 'summary' }, '安装包与文件资源')
    }
    if (task.target.format === 'plist')
      primary = (await optional('inspect_plist', { path }, 'Plist 配置')) ?? primary
    if (task.target.format === 'apk') {
      await optional('inspect_android_package', { path }, 'Android 应用概览')
      await optional('identify_flutter_build', { path }, 'Flutter 构建识别')
    }
  }
  if (!primary)
    throw new Error(
      `该格式已接入，但当前环境未能完成分析。\n${task.analysisIssues.join('\n')}\n请在设置中检查分析引擎，或使用 REA 工具面板查看依赖诊断。`
    )
  return primary
}

export function observationId(value: JsonObject): string | null {
  const normalized = object(value.normalized_result)
  return typeof normalized.parent_evidence_id === 'string'
    ? normalized.parent_evidence_id
    : typeof value.evidence_id === 'string'
      ? value.evidence_id
      : typeof value.desktop_observation_id === 'string'
        ? value.desktop_observation_id
        : null
}

export async function exportDesktopObservations(task: Task, destination: string): Promise<void> {
  const observations = await Promise.all(
    task.evidence
      .filter((item) => item.id.startsWith('obs_'))
      .map(async (item) =>
        JSON.parse(
          await readFile(join(taskDirectory(task.id), 'records', `${item.id}.json`), 'utf8')
        )
      )
  )
  await writeJson(`${destination}.desktop.json`, {
    format: 'rea-desktop-observations-v1',
    exportedAt: new Date().toISOString(),
    id: randomUUID(),
    target: task.target,
    targetFacts: task.targetFacts,
    analysisScope: task.analysisScope,
    analysisIssues: task.analysisIssues,
    recovery: task.recovery,
    evidence: task.evidence,
    observations
  })
}

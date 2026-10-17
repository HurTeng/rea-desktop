import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { z } from 'zod'
import {
  listTasks,
  listToolRuns,
  readToolRun,
  getSettings,
  saveSettings,
  activateModel,
  deleteModel,
  getPreferences,
  savePreferences
} from './storage'
import { checkModel } from './model'
import { resolveTarget } from './target'
import { TaskManager } from './tasks'
import { listCCSwitch, importCCSwitch } from './cc-switch'
import { ReaConnection, REA_VERSION } from './rea'
import { randomUUID } from 'node:crypto'
import { TARGET_FORMATS } from '../shared/formats'
import { getEngineSettings, saveEngineSettings } from './engine-settings'
import { writeFile, stat, readFile } from 'node:fs/promises'
import { extname, isAbsolute, basename } from 'node:path'
import { translate } from '../shared/locale'

const settingsSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().max(100).optional(),
    protocol: z.enum(['chat-completions', 'responses', 'anthropic']).optional(),
    baseUrl: z.url(),
    model: z.string().trim().min(1),
    apiKey: z.string().optional(),
    clearApiKey: z.boolean().optional()
  })
  .strict()
const runSchema = z
  .object({
    taskId: z.uuid().optional(),
    target: z
      .object({
        path: z.string(),
        inputPath: z.string(),
        companionPath: z.string().optional(),
        name: z.string(),
        format: z.enum(TARGET_FORMATS)
      })
      .optional(),
    question: z.string().max(8000),
    analysisMode: z.enum(['architecture', 'full']).optional(),
    language: z.enum(['zh', 'en']).optional()
  })
  .strict()

export function registerIpc(): TaskManager {
  const broadcast = (channel: string, value: unknown): void => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(channel, value)
    }
  }
  const manager = new TaskManager(
    (task) => broadcast('rea:task-updated', task),
    (progress) => broadcast('rea:progress', progress)
  )
  ipcMain.handle('rea:pick-target', async (_, kind: unknown, locale: unknown) => {
    const language = z.enum(['zh', 'en']).default('zh').parse(locale)
    const choice = z.enum(['file', 'directory']).parse(kind)
    const result = await dialog.showOpenDialog({
      title: translate(choice === 'file' ? '选择分析文件' : '选择应用目录', language),
      properties: choice === 'file' ? ['openFile'] : ['openDirectory'],
      ...(choice === 'file'
        ? {
            filters: [{ name: translate('所有分析文件', language), extensions: ['*'] }]
          }
        : {})
    })
    return result.canceled || !result.filePaths[0] ? null : resolveTarget(result.filePaths[0])
  })
  ipcMain.handle('rea:pick-path', async (_, kind: unknown) => {
    const choice = z.enum(['file', 'directory', 'save']).parse(kind)
    if (choice === 'save') {
      const result = await dialog.showSaveDialog({})
      return result.canceled ? null : (result.filePath ?? null)
    }
    const result = await dialog.showOpenDialog({
      properties: choice === 'directory' ? ['openDirectory'] : ['openFile']
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })
  ipcMain.handle('rea:save-tool-artifact', async (_, input: unknown) => {
    const artifact = z
      .object({
        dataBase64: z.string().max(16 * 1024 * 1024),
        mediaType: z.string(),
        name: z.string().optional()
      })
      .parse(input)
    const result = await dialog.showSaveDialog({
      defaultPath: basename(artifact.name || 'rea-artifact.bin')
    })
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, Buffer.from(artifact.dataBase64, 'base64'), { mode: 0o600 })
    return result.filePath
  })
  ipcMain.handle('rea:save-tool-result', async (_, value: unknown) => {
    const record = z.record(z.string(), z.unknown()).parse(value)
    const result = await dialog.showSaveDialog({
      defaultPath: 'rea-tool-result.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, JSON.stringify(record, null, 2), { mode: 0o600 })
    return result.filePath
  })
  ipcMain.handle('rea:reveal-path', (_, value: unknown) => {
    const path = z.string().parse(value)
    if (!isAbsolute(path)) throw new Error('需要本机绝对路径。')
    shell.showItemInFolder(path)
  })
  ipcMain.handle('rea:preview-image', async (_, value: unknown) => {
    const path = z.string().parse(value)
    const mime = (
      {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.gif': 'image/gif'
      } as Record<string, string>
    )[extname(path).toLowerCase()]
    if (!isAbsolute(path) || !mime) throw new Error('请选择本机 PNG/JPEG/WebP/GIF 图片。')
    if ((await stat(path)).size > 8 * 1024 * 1024)
      throw new Error('图片超过 8 MiB，请在输出目录查看。')
    return `data:${mime};base64,${(await readFile(path)).toString('base64')}`
  })
  ipcMain.handle('rea:list-tool-runs', () => listToolRuns())
  ipcMain.handle('rea:read-tool-run', (_, id: unknown) => readToolRun(z.string().parse(id)))
  ipcMain.handle('rea:get-engine-settings', () => getEngineSettings())
  ipcMain.handle('rea:save-engine-settings', (_, input: unknown) =>
    saveEngineSettings(
      z
        .object({
          command: z.string().optional(),
          arguments: z.array(z.string()).optional(),
          provider: z.string().min(1),
          environment: z.record(z.string(), z.string())
        })
        .strict()
        .parse(input)
    )
  )
  ipcMain.handle('rea:get-engine-status', (_, id: unknown) =>
    manager.engineStatus(z.uuid().optional().parse(id))
  )
  ipcMain.handle('rea:get-engine-catalog', (_, id: unknown) =>
    manager.engineCatalog(z.uuid().optional().parse(id))
  )
  ipcMain.handle('rea:cancel-engine-status', () => manager.cancelEngineStatus())
  ipcMain.handle('rea:run-tool', (_, input: unknown) =>
    manager.tool(
      z
        .object({
          taskId: z.uuid().optional(),
          name: z.string().min(1),
          args: z.record(z.string(), z.unknown()),
          allowEffects: z.boolean().optional()
        })
        .strict()
        .parse(input)
    )
  )
  ipcMain.handle('rea:recover-code', (_, id: unknown, procedure: unknown) =>
    manager.recover(z.uuid().parse(id), z.string().min(1).optional().parse(procedure))
  )
  ipcMain.handle('rea:read-recovered', (_, id: unknown, path: unknown) =>
    manager.readRecovery(z.uuid().parse(id), z.string().parse(path))
  )
  ipcMain.handle('rea:export-recovered', (_, id: unknown) =>
    manager.exportRecovery(z.uuid().parse(id))
  )
  ipcMain.handle('rea:reveal-recovery', (_, id: unknown) =>
    manager.revealRecovery(z.uuid().parse(id))
  )
  ipcMain.handle('rea:resolve-target', (_, path: unknown) => resolveTarget(z.string().parse(path)))
  ipcMain.handle('rea:list-tasks', () => listTasks())
  ipcMain.handle('rea:get-task', (_, id: unknown) => manager.get(z.uuid().parse(id)))
  ipcMain.handle('rea:run-task', (_, input: unknown) => manager.run(runSchema.parse(input)))
  ipcMain.handle('rea:cancel-task', () => manager.cancel())
  ipcMain.handle('rea:delete-task', (_, id: unknown) => manager.deleteTask(z.uuid().parse(id)))
  ipcMain.handle('rea:clear-tasks', () => manager.clearTasks())
  ipcMain.handle('rea:list-modules', (_, id: unknown, offset: unknown) =>
    manager.modules(z.uuid().parse(id), z.number().int().min(0).parse(offset))
  )
  ipcMain.handle('rea:get-evidence', (_, taskId: unknown, id: unknown) =>
    manager.evidence(z.uuid().parse(taskId), z.string().parse(id))
  )
  ipcMain.handle('rea:export-task', (_, id: unknown, format: unknown, language: unknown) =>
    manager.export(
      z.uuid().parse(id),
      z.enum(['markdown', 'json']).parse(format),
      z.enum(['zh', 'en']).default('zh').parse(language)
    )
  )
  ipcMain.handle('rea:get-preferences', () => getPreferences())
  ipcMain.handle('rea:save-preferences', (_, value: unknown) =>
    savePreferences(
      z
        .object({ theme: z.enum(['light', 'dark']), language: z.enum(['zh', 'en']) })
        .strict()
        .parse(value)
    )
  )
  ipcMain.handle('rea:get-settings', () => getSettings())
  ipcMain.handle('rea:save-settings', (_, input: unknown) =>
    saveSettings(settingsSchema.parse(input))
  )
  ipcMain.handle('rea:check-model', (_, input: unknown) => checkModel(settingsSchema.parse(input)))
  ipcMain.handle('rea:activate-model', (_, id: unknown) => activateModel(z.string().parse(id)))
  ipcMain.handle('rea:delete-model', (_, id: unknown) => deleteModel(z.string().parse(id)))
  ipcMain.handle('rea:list-cc-switch', () => listCCSwitch())
  ipcMain.handle('rea:import-cc-switch', (_, id: unknown) => importCCSwitch(z.string().parse(id)))
  ipcMain.handle('rea:check-engine', async () => {
    const engine = new ReaConnection()
    try {
      await engine.connect({ id: randomUUID(), bundleSaved: false }, new AbortController().signal)
      const names = [
        'analyze_javascript_application',
        'inspect_analysis_view',
        'trace_application_feature',
        'export_evidence_bundle',
        'import_evidence_bundle'
      ]
      const missing = names.filter((name) => !engine.available.has(name))
      if (missing.length) throw new Error(`REA 缺少工具：${missing.join('、')}`)
      return `REA ${REA_VERSION} 已连接，内置 Node 与 JavaScript/ASAR 分析、模块查询、功能追踪、证据导入导出均可用。此类分析不需要 Ghidra、Python 或 Hopper。`
    } finally {
      await engine.close()
    }
  })
  ipcMain.handle('rea:open-external', async (_, url: unknown) => {
    const parsed = new URL(z.string().parse(url))
    if (!['http:', 'https:'].includes(parsed.protocol))
      throw new Error('仅支持打开 HTTP 或 HTTPS 链接。')
    await shell.openExternal(parsed.href)
  })
  return manager
}

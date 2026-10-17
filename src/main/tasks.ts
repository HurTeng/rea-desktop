import { retainedToolArguments } from '../shared/json'
import { randomUUID } from 'node:crypto'
import { mkdir, copyFile, writeFile, cp } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { dialog, shell } from 'electron'
import { z } from 'zod'
import type { JsonObject, ModulePage, Progress, Target, Task } from '../shared/types'
import { answerQuestion } from './model'
import { bundledCatalog, object, ReaConnection } from './rea'
import {
  clearTaskDirectories,
  dataDirectory,
  writeJson,
  bundlePath,
  clearModelRun,
  getSettings,
  loadEvidence,
  loadModelRun,
  loadTask,
  removeTask,
  saveEvidence,
  saveModelRun,
  saveTask,
  taskDirectory
} from './storage'
import { resolveTarget } from './target'
import { isJavaScriptTarget } from '../shared/formats'
import {
  analyzeFormat,
  observationId,
  saveObservation,
  resultValue,
  exportDesktopObservations
} from './format-analysis'
import { formatReadNames, bindReadArguments, rowsFrom } from './format-tools'
import { recoverCode, readRecoveredFile } from './recovery'
import { translate, localizeSystemText, type Language } from '../shared/locale'

const moduleQuery = z
  .object({
    offset: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(16).default(8)
  })
  .strict()
const moduleSelector = z
  .object({
    path: z.string().optional(),
    node_id: z
      .string()
      .regex(/^jag_node_[a-f0-9]{64}$/)
      .optional()
  })
  .strict()
  .refine(
    (value) => Boolean(value.path !== undefined) !== Boolean(value.node_id),
    '提供 path 或 node_id 中的一项。'
  )
const featureQuery = z
  .object({
    kind: z.enum(['module', 'string', 'channel', 'route', 'node-id', 'api', 'native-export']),
    value: z.string().min(1),
    match: z.enum(['exact', 'contains']).default('exact'),
    direction: z.enum(['both', 'outgoing', 'incoming']).default('both')
  })
  .strict()

interface RunInput {
  taskId?: string
  target?: Target
  question: string
  analysisMode?: 'architecture' | 'full'
  language?: Language
}

interface EngineOperation {
  controller: AbortController
  done: Promise<void>
  finish: () => void
}

export class TaskManager {
  private rea = new ReaConnection()
  private inspector = new ReaConnection()
  private inspectorId = randomUUID()
  private active: Task | null = null
  private operations = new Map<ReaConnection, EngineOperation>()
  private statusControllers = new Set<AbortController>()
  private closing = false

  constructor(
    private notify: (task: Task) => void,
    private progress: (value: Progress | null) => void
  ) {}

  get busy(): boolean {
    return this.operations.size > 0
  }

  private reserve(engine: ReaConnection, controller = new AbortController()): EngineOperation {
    if (this.closing) throw new Error('应用正在退出。')
    let finish!: () => void
    const done = new Promise<void>((resolve) => {
      finish = resolve
    })
    const operation = { controller, done, finish }
    this.operations.set(engine, operation)
    return operation
  }

  private beginOperation(engine: ReaConnection, message: string): EngineOperation {
    if (this.busy) throw new Error(message)
    return this.reserve(engine)
  }

  private async beginStatusRead(
    engine: ReaConnection,
    controller: AbortController
  ): Promise<EngineOperation> {
    // 状态查询只等待自己使用的连接，并允许在排队期间取消。
    const { signal } = controller
    let previous: EngineOperation | undefined
    signal.throwIfAborted()
    while ((previous = this.operations.get(engine))) {
      await new Promise<void>((resolve, reject) => {
        const abort = (): void => reject(signal.reason)
        signal.addEventListener('abort', abort, { once: true })
        void previous!.done.then(() => {
          signal.removeEventListener('abort', abort)
          resolve()
        })
      })
      signal.throwIfAborted()
    }
    return this.reserve(engine, controller)
  }

  private finishOperation(engine: ReaConnection, operation: EngineOperation): void {
    this.operations.delete(engine)
    operation.finish()
  }

  private async persist(task: Task): Promise<void> {
    task.updatedAt = new Date().toISOString()
    await saveTask(task)
    this.notify(task)
  }

  async get(id: string): Promise<Task> {
    return this.active?.id === id ? this.active : loadTask(id)
  }

  private async record(
    task: Task,
    name: string,
    args: JsonObject,
    title: string,
    signal?: AbortSignal,
    engine = this.rea
  ): Promise<JsonObject> {
    const result = await engine.call(name, args, signal)
    if (typeof result.evidence_id !== 'string') {
      const id = await saveObservation(task, name, args, result, engine.lastMetadata)
      result.desktop_observation_id = id
      if (!task.evidence.some((item) => item.id === id))
        task.evidence.push({ id, operation: name, title, createdAt: new Date().toISOString() })
      await this.persist(task)
    }
    if (typeof result.evidence_id === 'string') {
      await saveEvidence(task.id, result, engine.lastMetadata)
      if (!task.evidence.some((item) => item.id === result.evidence_id)) {
        task.evidence.push({
          id: result.evidence_id,
          operation: String(result.operation ?? name),
          title,
          createdAt: new Date().toISOString()
        })
      }
      await this.persist(task)
    }
    return result
  }

  private source(task: Task): JsonObject {
    if (!task.parentEvidenceId) throw new Error('请先完成应用分析。')
    return { kind: 'retained-evidence', evidence_id: task.parentEvidenceId }
  }

  private async checkpoint(task: Task): Promise<void> {
    await this.rea.export(task)
    await this.persist(task)
  }

  async run(input: RunInput): Promise<Task> {
    const operation = this.beginOperation(this.rea, '当前任务仍在运行，请等待完成或停止后再开始。')
    try {
      return await this.runTask(input, operation.controller.signal)
    } finally {
      this.finishOperation(this.rea, operation)
    }
  }

  private async runTask(input: RunInput, signal: AbortSignal): Promise<Task> {
    let question = input.question.trim().slice(0, 8000)
    let retrying = false
    let task: Task
    if (input.taskId) {
      task = await loadTask(input.taskId)
      retrying = !question && ['error', 'cancelled'].includes(task.status)
      if (retrying)
        question = task.messages.findLast((message) => message.role === 'user')?.content ?? ''
      if (!task.parentEvidenceId)
        task.target = {
          ...(await resolveTarget(task.target.path)),
          companionPath: input.target?.companionPath ?? task.target.companionPath
        }
    } else {
      if (!input.target) throw new Error('请先选择应用。')
      const target = await resolveTarget(input.target.path)
      if (input.target.companionPath) {
        const companion = await resolveTarget(input.target.companionPath)
        if (companion.format !== 'directory') throw new Error('补充文件需要选择目录。')
        target.companionPath = companion.inputPath
      }
      const now = new Date().toISOString()
      task = {
        id: randomUUID(),
        analysisMode: input.analysisMode ?? 'architecture',
        target,
        title:
          question.slice(0, 40) ||
          `${target.name} · ${translate('应用分析', input.language ?? 'zh')}`,
        status: 'analyzing',
        createdAt: now,
        updatedAt: now,
        messages: [],
        summary: null,
        parentEvidenceId: null,
        evidence: [],
        bundleSaved: false,
        error: null
      }
    }
    signal.throwIfAborted()
    task.language = input.language ?? task.language ?? 'zh'
    this.active = task
    const progress = (label: string): void => this.progress({ taskId: task.id, label })
    task.error = null
    task.status = task.parentEvidenceId ? 'answering' : 'analyzing'
    if (question && !retrying)
      task.messages.push({
        id: randomUUID(),
        role: 'user',
        content: question,
        createdAt: new Date().toISOString()
      })
    try {
      await mkdir(taskDirectory(task.id), { recursive: true })
      await this.persist(task)
      if (!task.bundleSaved && this.rea.taskId !== task.id) {
        task.summary = null
        task.parentEvidenceId = null
      }
      progress(task.bundleSaved ? '正在恢复已保存的分析证据' : '正在连接本地分析引擎')
      await this.rea.connect(task, signal)
      if (!task.parentEvidenceId) {
        task.status = 'analyzing'
        const result = await analyzeFormat(
          task,
          this.rea,
          (name, args, title, requestSignal) => this.record(task, name, args, title, requestSignal),
          signal,
          progress
        )
        const parentId = observationId(result)
        if (!parentId) throw new Error('分析工具没有返回证据或桌面观察记录。')
        task.summary = result
        task.parentEvidenceId = parentId
        if (!task.evidence.some((item) => item.id === task.parentEvidenceId))
          task.evidence.unshift({
            id: task.parentEvidenceId,
            operation: String(result.operation || 'app_analysis'),
            title: task.analysisScope ? '架构入口分析（摘要）' : '应用分析（摘要）',
            createdAt: new Date().toISOString()
          })
        progress('正在保存本地分析证据')
        await this.checkpoint(task)
      }
      if (task.analysisFamily === 'native' || task.target.appleBundle) {
        try {
          await this.rea.openTarget(task, signal)
        } catch {
          /* 已保存的静态资源仍可用于解释。 */
        }
      }
      signal.throwIfAborted()
      if (
        task.analysisScope &&
        !task.messages.some(
          (message) => message.role === 'notice' && message.content.includes('架构快速分析')
        )
      ) {
        const scope = task.analysisScope
        task.messages.push({
          id: randomUUID(),
          role: 'notice',
          createdAt: new Date().toISOString(),
          content: `架构快速分析：归档共 ${scope.totalFiles} 个文件，已用 REA 解析 ${scope.selectedFiles} 个架构入口。${scope.limitations.join(' ')} 完整索引保存在任务 artifact/inventory.json。`
        })
      }
      const settings = await getSettings()
      if (settings.model && question) {
        task.status = 'answering'
        await this.persist(task)
        const resume = retrying ? await loadModelRun(task.id) : null
        let replyId: string | undefined
        let savedEvidenceCount = task.evidence.length
        const content = await answerQuestion({
          task,
          catalog: this.rea.tools,
          available: this.rea.available,
          signal,
          progress,
          resume,
          checkpoint: async (state) => {
            replyId = state.replyId
            if (state.answer) {
              let draft = task.messages.find((message) => message.id === state.replyId)
              if (!draft) {
                draft = {
                  id: state.replyId,
                  role: 'assistant',
                  content: '',
                  createdAt: new Date().toISOString()
                }
                task.messages.push(draft)
              }
              draft.content = state.answer
              draft.incomplete = true
            }
            if (task.evidence.length !== savedEvidenceCount) {
              await this.checkpoint(task)
              savedEvidenceCount = task.evidence.length
            }
            await saveModelRun(task.id, state)
            await this.persist(task)
          },
          execute: async (name, args) => {
            const evidence = await this.execute(task, name, args, signal)
            return {
              evidence_id: evidence.evidence_id,
              desktop_observation_id: evidence.desktop_observation_id,
              evidence,
              _meta: this.rea.lastMetadata
            }
          }
        })
        signal.throwIfAborted()
        const draft = task.messages.find((message) => message.id === replyId)
        if (draft) {
          draft.content = content
          delete draft.incomplete
        }
        progress('正在保存解释与证据')
        await this.checkpoint(task)
        await clearModelRun(task.id)
      } else {
        task.messages.push({
          id: randomUUID(),
          role: 'notice',
          content: settings.model
            ? '静态分析已完成。可以输入具体功能问题继续调查。'
            : '静态分析已完成，可以查看应用概览和模块。配置模型后，继续追问即可获得中文解释。',
          createdAt: new Date().toISOString()
        })
      }
      task.status = 'completed'
    } catch (error) {
      if (signal.aborted) {
        task.status = 'cancelled'
        task.messages.push({
          id: randomUUID(),
          role: 'notice',
          content: '任务已停止，已保存的分析和证据仍可查看。',
          createdAt: new Date().toISOString()
        })
      } else {
        task.status = 'error'
        task.error = error instanceof Error ? error.message : String(error)
      }
    } finally {
      try {
        await this.persist(task)
      } finally {
        this.active = null
        this.progress(null)
      }
    }
    return task
  }

  private async execute(
    task: Task,
    name: string,
    args: JsonObject,
    signal: AbortSignal
  ): Promise<JsonObject> {
    if (name === 'read_saved_evidence') {
      const query = z
        .object({
          id: z.string(),
          offset: z.number().int().min(0).default(0),
          limit: z.number().int().min(100).max(12000).default(10000)
        })
        .strict()
        .parse(args)
      const preview = await this.evidence(task.id, query.id, true)
      const end = query.offset + query.limit
      return {
        ...(query.id.startsWith('obs_')
          ? { desktop_observation_id: query.id }
          : { evidence_id: query.id }),
        excerpt: preview.text.slice(query.offset, end),
        offset: query.offset,
        next_offset: end < preview.text.length ? end : null,
        source_preview_truncated: preview.truncated,
        note: 'Original saved record excerpt; offsets count characters. A truncated preview does not establish missing facts.'
      }
    }
    if (
      (!isJavaScriptTarget(task.target) || task.target.appleBundle) &&
      formatReadNames(task).includes(name)
    ) {
      const input = bindReadArguments(task, name, args, this.rea.tools)
      return this.record(task, name, input, name, signal)
    }
    const source = this.source(task)
    if (name === 'list_modules') {
      const page = moduleQuery.parse(args)
      return this.record(
        task,
        'inspect_analysis_view',
        { source, view: { kind: 'page', collection: 'modules', ...page } },
        `模块列表 · ${page.offset + 1}`,
        signal
      )
    }
    if (name === 'inspect_module') {
      const selector = moduleSelector.parse(args)
      return this.record(
        task,
        'inspect_analysis_view',
        { source, view: { kind: 'item', collection: 'modules', selector } },
        `模块 · ${selector.path ?? selector.node_id}`,
        signal
      )
    }
    if (name === 'trace_feature') {
      const { direction, ...seed } = featureQuery.parse(args)
      return this.record(
        task,
        'trace_application_feature',
        { application: source, seed, direction },
        `功能追踪 · ${seed.value}`,
        signal
      )
    }
    if (name === 'trace_semantics') {
      const query = object(args.query)
      if (!Object.keys(query).length || Object.keys(args).some((key) => key !== 'query'))
        throw new Error('语义查询参数无效。')
      return this.record(
        task,
        'trace_javascript_semantics',
        { application: source, query },
        '语义关系追踪',
        signal
      )
    }
    throw new Error('不支持该工具。')
  }

  async cancel(): Promise<void> {
    await this.stopOperations(new Error('用户停止了操作。'))
  }

  async deleteTask(id: string): Promise<void> {
    if (this.busy) throw new Error('任务完成或停止后即可删除记录。')
    await removeTask(id)
  }

  async clearTasks(): Promise<number> {
    if (this.busy) throw new Error('任务完成或停止后即可清理记录。')
    return clearTaskDirectories()
  }

  async cancelEngineStatus(): Promise<void> {
    const operations = [...this.operations].filter(([, operation]) =>
      this.statusControllers.has(operation.controller)
    )
    for (const controller of this.statusControllers)
      controller.abort(new Error('已停止引擎状态检查。'))
    await Promise.allSettled(operations.map(([engine]) => engine.close()))
    await Promise.all(operations.map(([, operation]) => operation.done))
  }

  private async stopOperations(reason: Error): Promise<void> {
    const operations = [...this.operations.values()]
    for (const controller of this.statusControllers) controller.abort(reason)
    for (const operation of operations) operation.controller.abort(reason)
    await Promise.allSettled([this.rea.close(), this.inspector.close()])
    await Promise.all(operations.map((operation) => operation.done))
  }

  async engineCatalog(taskId?: string): Promise<import('../shared/types').EngineStatus> {
    if (this.closing) throw new Error('应用正在退出。')
    // 已有目录可直接浏览，不能因为目标分析或状态探测占用连接而排队。
    if (taskId && this.rea.taskId === taskId && this.rea.status.tools.length) return this.rea.status
    const engine = this.inspector
    const snapshot = (): import('../shared/types').EngineStatus =>
      taskId ? engine.catalogStatus() : engine.status
    if (engine.status.tools.length) return snapshot()
    const bundled = await bundledCatalog()
    if (bundled) return bundled
    const controller = new AbortController()
    const timer = setTimeout(
      () => controller.abort(new Error('工具目录加载超时，请重试或检查引擎配置。')),
      15_000
    )
    this.statusControllers.add(controller)
    let operation: EngineOperation | undefined
    try {
      operation = await this.beginStatusRead(engine, controller)
      if (!engine.status.tools.length)
        await engine.connect({ id: this.inspectorId, bundleSaved: false }, controller.signal, true)
      return snapshot()
    } finally {
      clearTimeout(timer)
      if (operation) this.finishOperation(engine, operation)
      this.statusControllers.delete(controller)
    }
  }

  async engineStatus(taskId?: string): Promise<import('../shared/types').EngineStatus> {
    const engine = taskId ? this.rea : this.inspector
    const controller = new AbortController()
    const timer = setTimeout(
      () => controller.abort(new Error('引擎状态检查超时，当前操作可能仍在进行，可稍后刷新。')),
      30_000
    )
    this.statusControllers.add(controller)
    let operation: EngineOperation | undefined
    try {
      operation = await this.beginStatusRead(engine, controller)
      const task = taskId ? await loadTask(taskId) : { id: this.inspectorId, bundleSaved: false }
      const { signal } = controller
      signal.throwIfAborted()
      const connected = await engine.connect(task, signal)
      if (taskId) await saveTask(task as Task)
      return connected ? engine.status : await engine.refresh(signal)
    } finally {
      clearTimeout(timer)
      if (operation) this.finishOperation(engine, operation)
      this.statusControllers.delete(controller)
    }
  }

  async tool(input: {
    taskId?: string
    name: string
    args: JsonObject
    allowEffects?: boolean
  }): Promise<JsonObject> {
    const engine = input.taskId ? this.rea : this.inspector
    const operation = this.beginOperation(engine, '当前操作仍在进行。')
    const { signal } = operation.controller
    try {
      const task = input.taskId ? await loadTask(input.taskId) : null
      signal.throwIfAborted()
      await engine.connect(task ?? { id: this.inspectorId, bundleSaved: false }, signal)
      let descriptor = engine.status.tools.find((tool) => tool.name === input.name)
      if (!descriptor) throw new Error('当前 REA 没有该工具，请刷新工具目录。')
      const consequential = descriptor.effects.some((effect) =>
        ['mutatesTarget', 'executesForeignCode', 'changesUiState', 'mayDiscardData'].includes(
          effect
        )
      )
      if (consequential && !input.allowEffects)
        throw new Error('此工具会执行或修改目标，请先确认表单中的操作影响。')
      if (task && descriptor.reason === 'target_required' && input.name !== 'open_binary') {
        await engine.openTarget(task, signal)
        descriptor = engine.status.tools.find((tool) => tool.name === input.name)!
      }
      // 环境自检未完成时可用性未知，仍允许尝试，由 REA 返回真实诊断。
      if (!descriptor.available && !engine.status.warning)
        throw new Error(`${descriptor.reason}\n${descriptor.remediation || ''}`)
      const result = task
        ? await this.record(task, input.name, input.args, input.name, signal, engine)
        : await engine.call(input.name, input.args, signal)
      const metadata = engine.lastMetadata
      const saved = join(dataDirectory(), 'tool-runs', `${Date.now()}-${randomUUID()}.json`)
      await writeJson(saved, {
        tool: input.name,
        arguments: retainedToolArguments(input.args),
        result,
        metadata,
        taskId: task?.id ?? null,
        createdAt: new Date().toISOString()
      })
      let warning: string | undefined
      if (task) {
        try {
          await engine.export(task)
        } catch (error) {
          warning = `操作已完成并保存工具记录，但证据包更新失败：${error instanceof Error ? error.message : String(error)}`
        }
        await this.persist(task)
      }
      // 状态刷新交给界面单独查询，不能让刷新失败覆盖已成功保存的执行结果。
      return {
        ...result,
        desktop_saved_record: saved,
        ...(warning ? { desktop_warning: warning } : {})
      }
    } finally {
      this.finishOperation(engine, operation)
    }
  }

  async recover(id: string, procedure?: string): Promise<import('../shared/types').RecoveryResult> {
    const operation = this.beginOperation(this.rea, '请等待当前操作结束。')
    const { signal } = operation.controller
    try {
      const task = await loadTask(id)
      signal.throwIfAborted()
      await this.rea.connect(task, signal)
      if (task.target.family === 'native' && (!task.target.packaging || procedure))
        await this.rea.openTarget(task, signal)
      const previous = task.recovery
      const recovered = await recoverCode(
        task,
        (name, args, title, s) => this.record(task, name, args, title, s),
        signal,
        procedure
      )
      if (previous) {
        const root = join(taskDirectory(task.id), 'recovered')
        const prefix = (
          result: import('../shared/types').RecoveryResult
        ): import('../shared/types').RecoveredFile[] =>
          result.files.map((file) => ({
            ...file,
            path: join(relative(root, result.directory), file.path)
          }))
        task.recovery = {
          ...recovered,
          directory: root,
          files: [...prefix(previous), ...prefix(recovered)],
          limitations: [...new Set([...previous.limitations, ...recovered.limitations])]
        }
        await writeJson(join(root, 'recovery-manifest.json'), task.recovery)
      } else task.recovery = recovered
      await this.checkpoint(task)
      return task.recovery
    } finally {
      this.finishOperation(this.rea, operation)
    }
  }

  async readRecovery(id: string, path: string): Promise<import('../shared/types').EvidencePreview> {
    return readRecoveredFile(await loadTask(id), path)
  }
  async revealRecovery(id: string): Promise<void> {
    const task = await loadTask(id)
    if (task.recovery) await shell.openPath(task.recovery.directory)
  }
  async exportRecovery(id: string): Promise<string | null> {
    const task = await loadTask(id)
    if (!task.recovery) throw new Error('请先恢复或导出代码。')
    const choice = await dialog.showOpenDialog({
      title: '选择代码导出目录 / Choose export directory',
      properties: ['openDirectory', 'createDirectory']
    })
    if (choice.canceled || !choice.filePaths[0]) return null
    const target = join(
      choice.filePaths[0],
      `${task.target.name.replace(/[/\\:]/g, '-')}-recovered-${Date.now()}`
    )
    await cp(task.recovery.directory, target, { recursive: true, errorOnExist: true, force: false })
    return target
  }

  async modules(id: string, offset: number): Promise<ModulePage> {
    const operation = this.beginOperation(this.rea, '分析完成后即可浏览模块。')
    try {
      const task = await loadTask(id)
      const { signal } = operation.controller
      signal.throwIfAborted()
      await this.rea.connect(task, signal)
      if (!isJavaScriptTarget(task.target) || task.target.appleBundle) {
        let result = task.summary || {}
        if (task.analysisFamily === 'native') {
          await this.rea.openTarget(task, signal)
          result = await this.record(task, 'list_procedures', {}, '函数列表', signal)
        } else if (task.analysisFamily === 'managed') {
          result = await this.record(
            task,
            'inspect_managed_members',
            { path: task.target.inputPath, detail: 'summary' },
            '.NET 成员',
            signal
          )
          const parent = object(result.normalized_result).parent_evidence_id
          if (typeof parent === 'string')
            result = await this.record(
              task,
              'inspect_analysis_view',
              {
                source: { kind: 'retained-evidence', evidence_id: parent },
                view: { kind: 'managed-members', collection: 'types', offset, limit: 16 }
              },
              '.NET 类型列表',
              signal
            )
        }
        const all = rowsFrom(resultValue(result)).sort(
          (a, b) =>
            Number(object(a.procedure).external === true) -
            Number(object(b.procedure).external === true)
        )
        const paged = task.analysisFamily === 'managed' ? all : all.slice(offset, offset + 16)
        const items = paged.map((row) => ({
          ...row,
          path:
            row.path ??
            row.name ??
            row.value ??
            row.full_name ??
            row.address ??
            row.node_id ??
            JSON.stringify(row).slice(0, 100)
        }))
        const coverage = object(object(result.normalized_result).coverage)
        await this.checkpoint(task)
        return {
          items,
          total: Number(coverage.total_items ?? coverage.total ?? all.length),
          nextOffset:
            typeof coverage.next_offset === 'number'
              ? coverage.next_offset
              : offset + items.length < all.length
                ? offset + items.length
                : null,
          evidenceId: String(
            result.evidence_id ?? result.desktop_observation_id ?? task.parentEvidenceId
          ),
          limitations: task.analysisIssues || []
        }
      }
      const result = await this.execute(task, 'list_modules', { offset, limit: 16 }, signal)
      const normalized = object(result.normalized_result)
      const coverage = object(normalized.coverage)
      const items = Array.isArray(normalized.items) ? normalized.items.map(object) : []
      await this.checkpoint(task)
      return {
        items,
        nextOffset: typeof coverage.next_offset === 'number' ? coverage.next_offset : null,
        total: Number(coverage.total_items ?? coverage.total ?? items.length),
        evidenceId: String(result.evidence_id),
        limitations: Array.isArray(normalized.limitations) ? normalized.limitations.map(String) : []
      }
    } finally {
      this.finishOperation(this.rea, operation)
    }
  }

  async evidence(
    id: string,
    evidenceId: string,
    full = false
  ): Promise<Awaited<ReturnType<typeof loadEvidence>>> {
    const task = await this.get(id)
    if (!task.evidence.some((item) => item.id === evidenceId))
      throw new Error('当前任务不包含这条证据。')
    if (evidenceId === task.parentEvidenceId) {
      return {
        id: evidenceId,
        text: `当前分析范围内的摘要视图。完整记录请导出 JSON 证据包。\n\n${JSON.stringify({ summary: task.summary, analysisScope: task.analysisScope }, null, 2)}`,
        truncated: false
      }
    }
    return loadEvidence(id, evidenceId, full ? Infinity : 100_000)
  }

  async export(
    id: string,
    format: 'markdown' | 'json',
    language: Language = 'zh'
  ): Promise<string | null> {
    if (this.busy) throw new Error('任务完成或停止后即可导出。')
    const task = await loadTask(id)
    if (format === 'json' && !task.bundleSaved)
      throw new Error('该任务尚未保存完整证据包，请重新运行分析。')
    const selection = await dialog.showSaveDialog({
      title: translate('导出分析结果', language),
      defaultPath: `${task.target.name.replace(/[/\\:]/g, '-')}-analysis.${format === 'markdown' ? 'md' : 'json'}`,
      filters: [
        {
          name: translate(format === 'markdown' ? 'Markdown 报告' : 'REA 证据包', language),
          extensions: [format === 'markdown' ? 'md' : 'json']
        }
      ]
    })
    if (selection.canceled || !selection.filePath) return null
    await mkdir(dirname(selection.filePath), { recursive: true })
    if (format === 'json') {
      await copyFile(bundlePath(id), selection.filePath)
      await exportDesktopObservations(task, selection.filePath)
    } else {
      const conversation = task.messages
        .map((message) => {
          const content =
            message.role !== 'notice'
              ? message.content
              : message.content.startsWith('架构快速分析：') && task.analysisScope
                ? translate('已扫描 {total} 个文件，选取 {selected} 个架构入口分析。', language, {
                    total: task.analysisScope.totalFiles,
                    selected: task.analysisScope.selectedFiles
                  }) +
                  ' ' +
                  task.analysisScope.limitations
                    .map((item) => localizeSystemText(item, language))
                    .join(' ')
                : localizeSystemText(message.content, language)
          const title = translate(
            message.role === 'user' ? '问题' : message.role === 'assistant' ? '解释' : '记录',
            language
          )
          return `## ${title}\n\n${content.replace(/\]\(rea:\/\/evidence\/((?:ev|obs)_[a-f0-9]{64})\)/g, language === 'en' ? '] (Evidence ID: $1)' : ']（证据 ID：$1）')}`
        })
        .join('\n\n')
      const report = `# ${task.title}\n\n${translate('目标', language)}: ${task.target.path}\n\n${translate('时间', language)}: ${task.createdAt}\n\n${conversation}\n\n## ${translate('分析摘要', language)}\n\n\`\`\`json\n${JSON.stringify({ summary: task.summary, analysisScope: task.analysisScope }, null, 2)}\n\`\`\`\n\n## ${translate('证据索引', language)}\n\n${task.evidence.map((item) => `- ${localizeSystemText(item.title, language)}: \`${item.id}\``).join('\n')}\n\n${translate('完整证据请同时导出 REA JSON 证据包。', language)}\n`
      await writeFile(selection.filePath, report, 'utf8')
    }
    return selection.filePath
  }

  async close(): Promise<void> {
    this.closing = true
    await this.stopOperations(new Error('应用正在退出。'))
  }
}

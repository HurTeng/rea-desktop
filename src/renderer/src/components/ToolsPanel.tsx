import { useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  LoaderCircle,
  Play,
  RefreshCw,
  Search,
  Square,
  X
} from 'lucide-react'
import { CAPABILITY_GROUPS, capabilityGroup, TOOL_LABELS } from '../../../shared/capabilities'
import type {
  EngineStatus,
  EngineTool,
  JsonObject,
  Task,
  Target,
  ToolRunOverview
} from '../../../shared/types'
import { usePreferences } from '../preferences-context'
import { ToolResult } from './ToolResult'
import { SchemaForm } from './SchemaForm'
import { initialValue } from '../schema'
import { useDialog } from './useDialog'

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {}
}
function errorText(error: unknown): string {
  return String(error instanceof Error ? error.message : error).replace(
    /^Error invoking remote method '[^']+': (?:Error: )?/,
    ''
  )
}

export function ToolsPanel({
  task: providedTask,
  target,
  initialGroup,
  initialTool,
  onClose,
  onSettings
}: {
  task: Task | null
  target?: Target | null
  initialGroup?: string
  initialTool?: string
  onClose: () => void
  onSettings: () => void
}): React.JSX.Element {
  const { t, language } = usePreferences()
  const [linked, setLinked] = useState(Boolean(providedTask))
  const task = linked ? providedTask : null
  const [status, setStatus] = useState<EngineStatus | null>(null),
    [group, setGroup] = useState(initialGroup || ''),
    [selected, setSelected] = useState(initialTool || '')
  const [recent, setRecent] = useState<ToolRunOverview[]>([])
  const [showRecent, setShowRecent] = useState(false)
  const [search, setSearch] = useState(''),
    [args, setArgs] = useState<JsonObject>({}),
    [raw, setRaw] = useState(false),
    [json, setJson] = useState('{}')
  const [working, setWorking] = useState(false),
    [loading, setLoading] = useState(true),
    [checking, setChecking] = useState(false),
    [error, setError] = useState(''),
    [result, setResult] = useState<JsonObject | null>(null)
  const [allow, setAllow] = useState(false),
    [runs, setRuns] = useState<Array<{ tool: string; result: JsonObject }>>([]),
    [copy, setCopy] = useState(false)
  const dialog = useDialog(onClose, working)
  const request = useRef({ version: 0, pending: false })
  const tool = status?.tools.find((item) => item.name === selected)
  const title = (item: EngineTool): string =>
    language === 'zh'
      ? TOOL_LABELS[item.name] || item.name.replaceAll('_', ' ')
      : item.name.replaceAll('_', ' ')
  const choose = (item: EngineTool): void => {
    const input = object(initialValue(item.inputSchema, item.inputSchema))
    const properties = object(item.inputSchema.properties)
    const selectedTarget = task?.target ?? target
    if (selectedTarget) {
      for (const key of ['path', 'input_path', 'capture_path'])
        if (key in properties) input[key] = selectedTarget.inputPath
      const id = task?.parentEvidenceId?.startsWith('ev_') ? task.parentEvidenceId : undefined
      for (const key of ['source', 'application'])
        if (id && key in properties) input[key] = { kind: 'retained-evidence', evidence_id: id }
      if ('cdp_endpoint' in properties && selectedTarget.web)
        input.cdp_endpoint = selectedTarget.web.cdpEndpoint
      if ('target_id' in properties && selectedTarget.web)
        input.target_id = selectedTarget.web.targetId
    }
    if (item.name === 'inspect_pe_resources' && task?.target.bytes)
      input.max_file_bytes = Math.max(67108864, task.target.bytes)
    setSelected(item.name)
    setArgs(input)
    setJson(JSON.stringify(input, null, 2))
    setAllow(false)
    setError('')
    setResult(null)
    setRaw(false)
  }
  const refresh = async (taskId: string | undefined, reset = false): Promise<void> => {
    const current = ++request.current.version
    request.current.pending = true
    if (reset) setStatus(null)
    setLoading(reset || !status)
    setChecking(true)
    setError('')
    try {
      const catalog = await window.rea.getEngineCatalog(taskId)
      if (current !== request.current.version) return
      setStatus(catalog)
      setLoading(false)
      if (!status && initialTool) {
        const item = catalog.tools.find((tool) => tool.name === initialTool)
        if (item) choose(item)
      }
      const next = await window.rea.getEngineStatus(taskId)
      if (current === request.current.version) setStatus(next)
    } catch (error) {
      if (current !== request.current.version) return
      const message = errorText(error)
      setError(message)
      setStatus((previous) =>
        previous
          ? {
              ...previous,
              availabilityPending: false,
              warning: message,
              tools: previous.availabilityPending
                ? previous.tools.map((tool) => ({
                    ...tool,
                    effects: ['mutatesTarget', 'executesForeignCode', 'mayDiscardData']
                  }))
                : previous.tools
            }
          : previous
      )
    } finally {
      if (current === request.current.version) {
        request.current.pending = false
        setLoading(false)
        setChecking(false)
      }
    }
  }
  useEffect(() => {
    let mounted = true
    const state = request.current
    // StrictMode 会立即清理首轮 effect，避免启动随后立刻被取消的重复查询。
    void Promise.resolve().then(() => {
      if (mounted) void refresh(task?.id)
    })
    void window.rea
      .listToolRuns()
      .then((items) => {
        if (mounted) setRecent(items)
      })
      .catch((error) => {
        if (mounted) setError(errorText(error))
      })
    return () => {
      mounted = false
      state.version++
      if (state.pending) void window.rea.cancelEngineStatus().catch(() => {})
    }
    // Load once for this dialog; refresh is also an explicit user action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const execute = async (): Promise<void> => {
    if (!tool) return
    setWorking(true)
    setError('')
    setResult(null)
    try {
      const input = raw ? object(JSON.parse(json)) : args
      const value = await window.rea.runReaTool({
        taskId: task?.id,
        name: tool.name,
        args: input,
        allowEffects: allow
      })
      setResult(value)
      setRuns((items) => [...items, { tool: tool.name, result: value }])
      setAllow(false)
      // Availability changes after opening targets or starting runtime sessions.
      const [recentResult, statusResult] = await Promise.allSettled([
        window.rea.listToolRuns(),
        window.rea.getEngineStatus(task?.id)
      ])
      const warnings = typeof value.desktop_warning === 'string' ? [value.desktop_warning] : []
      if (recentResult.status === 'fulfilled') setRecent(recentResult.value)
      else warnings.push(errorText(recentResult.reason))
      if (statusResult.status === 'fulfilled') setStatus(statusResult.value)
      else warnings.push(errorText(statusResult.reason))
      if (warnings.length)
        setError(`${t('操作已完成并保存，后续更新未完成：')}${warnings.join('\n')}`)
    } catch (error) {
      setError(errorText(error))
    } finally {
      setWorking(false)
    }
  }
  const currentGroup = CAPABILITY_GROUPS.find((item) => item.id === group)
  const available = status?.tools.filter((item) => item.available).length || 0
  const consequential = tool?.effects.some((effect) =>
    ['mutatesTarget', 'executesForeignCode', 'changesUiState', 'mayDiscardData'].includes(effect)
  )
  const list =
    status?.tools.filter(
      (item) =>
        (!group || capabilityGroup(item.name) === group) &&
        `${title(item)} ${item.name} ${item.description}`
          .toLowerCase()
          .includes(search.toLowerCase())
    ) || []
  const ids = [
    ...new Set([
      ...(task?.evidence.map((item) => item.id) || []),
      ...runs.map((run) => String(run.result.evidence_id || '')).filter(Boolean)
    ])
  ].filter((id) => id.startsWith('ev_'))
  return (
    <div className="modal-backdrop">
      <section
        ref={dialog}
        className="capabilities-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="capabilities-title"
      >
        <header className="modal-heading">
          <div>
            <h2 id="capabilities-title">{t('REA 能力中心')}</h2>
            <p>
              {task ? `${t('当前目标')} · ${task.target.name}` : t('独立工具会话 · 结果保存在本机')}
              {status && ` · REA ${status.version} · ${status.tools.length} ${t('项能力')}`}
            </p>
            {status && (
              <small className="muted">
                {t(
                  status.buildType === 'source'
                    ? '源码运行时'
                    : status.buildType === 'custom'
                      ? '自定义服务'
                      : 'npm 兼容运行时'
                )}
              </small>
            )}
            {providedTask && (
              <button
                className="text-action"
                disabled={working || checking}
                onClick={() => {
                  const next = !linked
                  setLinked(next)
                  setSelected('')
                  setError('')
                  void refresh(next ? providedTask.id : undefined, true)
                }}
              >
                {t(linked ? '切换到独立工具会话' : '关联当前任务')}
              </button>
            )}
          </div>
          <button
            className="icon-button"
            disabled={working}
            onClick={onClose}
            aria-label={t('关闭')}
          >
            <X size={20} />
          </button>
        </header>
        <div className="capability-layout">
          <aside className="capability-sidebar">
            <button
              className={!group ? 'selected' : ''}
              onClick={() => {
                setGroup('')
                setSelected('')
                setSearch('')
              }}
            >
              {t('全部能力')} <small>{status?.tools.length || '…'}</small>
            </button>
            {CAPABILITY_GROUPS.map((item) => (
              <button
                key={item.id}
                className={group === item.id ? 'selected' : ''}
                onClick={() => {
                  setGroup(item.id)
                  setSelected('')
                  setSearch('')
                }}
              >
                <span>{language === 'zh' ? item.title : item.en}</span>
                <small>
                  {status
                    ? status.tools.filter((t) => capabilityGroup(t.name) === item.id).length
                    : '…'}
                </small>
              </button>
            ))}
            <button disabled={working || checking} onClick={() => void refresh(task?.id)}>
              <RefreshCw size={14} />
              {t('刷新状态')}
            </button>
            <button onClick={onSettings}>
              {t('配置依赖与引擎')}
              <ChevronRight size={14} />
            </button>
          </aside>
          <div className="capability-main">
            <details
              className="recent-tools"
              open={showRecent}
              onToggle={(event) => setShowRecent(event.currentTarget.open)}
            >
              <summary>
                {t('最近工具记录')} ({recent.length})
              </summary>
              <p className="small muted">
                {t('历史结果可查看和导出；跨会话引用证据前需导入对应 REA 证据包。')}
              </p>
              {recent.map((item) => (
                <button
                  className="text-action"
                  key={item.id}
                  onClick={() =>
                    void window.rea
                      .readToolRun(item.id)
                      .then((record) => {
                        setAllow(false)
                        setResult(object(record.result))
                        const tool = status?.tools.find((tool) => tool.name === item.tool)
                        if (tool) {
                          setSelected(tool.name)
                          setArgs(object(record.arguments))
                          setJson(JSON.stringify(record.arguments, null, 2))
                        }
                      })
                      .catch((error) => setError(errorText(error)))
                  }
                >
                  {item.tool} ·{' '}
                  {new Date(item.createdAt).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')}
                </button>
              ))}
            </details>
            {checking && (
              <div className="tool-loading">
                <LoaderCircle className="spin" size={19} />
                {t(
                  loading
                    ? '正在连接 REA 并读取工具目录（最多 15 秒）…'
                    : '工具目录已就绪，正在连接引擎并检查状态（最多 30 秒），可继续浏览…'
                )}
                <button
                  className="text-action"
                  onClick={() =>
                    void window.rea
                      .cancelEngineStatus()
                      .catch((error) => setError(errorText(error)))
                  }
                >
                  {t('停止')}
                </button>
              </div>
            )}
            {!tool && (
              <>
                <div className="capability-intro">
                  <h3>
                    {currentGroup
                      ? language === 'zh'
                        ? currentGroup.title
                        : currentGroup.en
                      : t('选择你要调查的内容')}
                  </h3>
                  <p>
                    {currentGroup
                      ? language === 'zh'
                        ? currentGroup.description
                        : currentGroup.en
                      : t('先选一种任务，再按推荐步骤操作。全部工具也可直接搜索。')}
                  </p>
                  <small>
                    {status && !status.availabilityPending
                      ? `${t('当前可调用')} ${available} / ${status.tools.length} · ${t('依赖和目标状态会随会话更新')}`
                      : t('工具可用性尚未检查；目录就绪后可浏览和填写参数。')}
                  </small>
                  {status?.warning && <div className="form-result failure">{status.warning}</div>}
                  {currentGroup && (
                    <button
                      className="text-action"
                      onClick={() =>
                        void window.rea.openExternal(
                          `https://github.com/morluto/rea/blob/main/docs/${currentGroup.doc}`
                        )
                      }
                    >
                      {t('操作指南')} ↗
                    </button>
                  )}
                </div>
                {!group && !search && (
                  <div className="capability-cards">
                    {CAPABILITY_GROUPS.map((item) => (
                      <button key={item.id} onClick={() => setGroup(item.id)}>
                        <strong>{language === 'zh' ? item.title : item.en}</strong>
                        <span>{language === 'zh' ? item.description : item.en}</span>
                        <ChevronRight size={15} />
                      </button>
                    ))}
                  </div>
                )}
                {currentGroup && (
                  <div className="workflow-steps">
                    <span>{t('推荐顺序')}</span>
                    {currentGroup.steps.map((name, index) => {
                      const item = status?.tools.find((t) => t.name === name)
                      return item ? (
                        <button key={name} onClick={() => choose(item)}>
                          <b>{index + 1}</b>
                          {title(item)}
                        </button>
                      ) : null
                    })}
                  </div>
                )}
                <label className="capability-search">
                  <Search size={16} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t('搜索工具、格式或操作…')}
                    aria-label={t('搜索 REA 工具')}
                  />
                </label>
                <div className="tool-catalog">
                  {list.map((item) => (
                    <button key={item.name} onClick={() => choose(item)}>
                      <span className={`status-dot ${item.available ? 'connected' : ''}`} />
                      <span>
                        <strong>{title(item)}</strong>
                        <code>{item.name}</code>
                        <small>{item.description.split('\n')[0]}</small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </div>
              </>
            )}
            {tool && (
              <>
                <button className="text-action" disabled={working} onClick={() => setSelected('')}>
                  <ArrowLeft size={14} />
                  {t('返回能力列表')}
                </button>
                <div className="tool-intro">
                  <h3>{title(tool)}</h3>
                  <code>{tool.name}</code>
                  <p>{tool.description}</p>
                </div>
                {!tool.available && !status?.availabilityPending && (
                  <div className="tool-diagnostic">
                    <strong>
                      {t(
                        status?.warning
                          ? '依赖状态尚未确认'
                          : tool.reason === 'target_required'
                            ? '需要打开分析目标'
                            : '当前依赖未就绪'
                      )}
                    </strong>
                    <p>{tool.reason}</p>
                    <p>{tool.remediation}</p>
                    <span>
                      {task && tool.reason === 'target_required'
                        ? t('执行时会自动打开当前目标。')
                        : t('可先执行 open_binary，或在设置中配置所需引擎后刷新。')}
                    </span>
                    <button className="text-action" onClick={onSettings}>
                      {t('配置依赖与引擎')}
                    </button>
                  </div>
                )}
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    void execute()
                  }}
                >
                  <fieldset disabled={working}>
                    <div className="tool-form-heading">
                      <h4>{t('操作参数')}</h4>
                      <label>
                        <input
                          type="checkbox"
                          checked={raw}
                          onChange={(event) => {
                            if (event.target.checked) setJson(JSON.stringify(args, null, 2))
                            else
                              try {
                                setArgs(object(JSON.parse(json)))
                              } catch {
                                return
                              }
                            setRaw(event.target.checked)
                          }}
                        />
                        {t('JSON 模式')}
                      </label>
                    </div>
                    {raw ? (
                      <textarea
                        className="tool-json"
                        rows={15}
                        value={json}
                        onChange={(event) => {
                          setJson(event.target.value)
                          try {
                            JSON.parse(event.target.value)
                            event.target.setCustomValidity('')
                          } catch {
                            event.target.setCustomValidity('Invalid JSON')
                          }
                        }}
                      />
                    ) : (
                      <SchemaForm
                        key={tool.name}
                        schema={tool.inputSchema}
                        value={args}
                        onChange={(value) => setArgs(object(value))}
                        evidenceIds={ids}
                      />
                    )}
                    {runs.length > 0 && (
                      <details className="tool-prior-results">
                        <summary>
                          {t('使用之前的结果')} ({runs.length})
                        </summary>
                        {runs.map((run, i) => (
                          <div key={i}>
                            <code>
                              {run.tool} ·{' '}
                              {String(
                                run.result.evidence_id ||
                                  object(run.result.normalized_result).parent_evidence_id ||
                                  ''
                              )}
                            </code>
                            <button
                              type="button"
                              className="text-action"
                              onClick={() => {
                                setResult(run.result)
                              }}
                            >
                              {t('查看结果')}
                            </button>
                            <button
                              type="button"
                              className="text-action"
                              onClick={() => {
                                void navigator.clipboard.writeText(
                                  JSON.stringify(run.result, null, 2)
                                )
                              }}
                            >
                              {t('复制完整结果')}
                            </button>
                          </div>
                        ))}
                      </details>
                    )}
                    {tool.effects.length > 0 && (
                      <p className="small muted">
                        {t('操作影响')} · {tool.effects.join(' · ')}
                      </p>
                    )}
                    {consequential && (
                      <label className="tool-confirm">
                        <input
                          type="checkbox"
                          checked={allow}
                          onChange={(event) => setAllow(event.target.checked)}
                        />
                        <span>
                          {t(
                            '我确认对上述参数执行此操作；它可能运行代码、修改目标或与设备/页面交互。'
                          )}
                        </span>
                      </label>
                    )}
                  </fieldset>
                  <div className="tool-run-row">
                    <button
                      type="submit"
                      className="button primary"
                      disabled={
                        working ||
                        checking ||
                        Boolean(consequential && !allow) ||
                        (!tool.available &&
                          !(task && tool.reason === 'target_required') &&
                          !status?.warning)
                      }
                    >
                      {working ? <LoaderCircle size={15} className="spin" /> : <Play size={15} />}{' '}
                      {t(working ? '执行中…' : '执行操作')}
                    </button>
                    {working && (
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() =>
                          void window.rea.cancelTask().catch((error) => setError(errorText(error)))
                        }
                      >
                        <Square size={14} />
                        {t('停止')}
                      </button>
                    )}
                  </div>
                </form>
                {result && (
                  <div className="tool-result">
                    <div className="section-heading">
                      <h4>{t('真实执行结果')}</h4>
                      <div>
                        <button
                          className="text-action"
                          onClick={() => void window.rea.saveToolResult(result)}
                        >
                          <ArrowDownToLine size={14} />
                          {t('导出 JSON')}
                        </button>
                        <button
                          className="text-action"
                          onClick={() => {
                            void navigator.clipboard.writeText(JSON.stringify(result, null, 2))
                            setCopy(true)
                            setTimeout(() => setCopy(false), 1500)
                          }}
                        >
                          {copy ? <Check size={14} /> : <Copy size={14} />}{' '}
                          {t(copy ? '已复制' : '复制')}
                        </button>
                      </div>
                    </div>
                    <p className="small muted">{String(result.desktop_saved_record || '')}</p>
                    <ToolResult result={result} />
                  </div>
                )}
              </>
            )}
            {error && (
              <div className="form-result failure" role="alert">
                {error}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  FileCode2,
  FolderOpen,
  Layers3,
  LoaderCircle,
  MessageSquare,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Square,
  Upload,
  Sun,
  Moon,
  Languages,
  ChevronRight,
  Play,
  RotateCcw,
  Trash2,
  X
} from 'lucide-react'
import type {
  EvidencePreview,
  ModelSettings,
  ModulePage,
  Progress,
  Target,
  Task,
  TaskOverview
} from '../../shared/types'
import { ToolsPanel } from './components/ToolsPanel'
import { RecoveryPanel } from './components/RecoveryPanel'
import { FORMAT_FAMILIES } from '../../shared/formats'
import { EvidencePanel } from './components/EvidencePanel'
import { Markdown } from './components/Markdown'
import { Settings } from './components/Settings'
import { usePreferences } from './preferences-context'
import { localizeSystemText } from '../../shared/locale'
import { useDialog } from './components/useDialog'

const EXAMPLES = [
  {
    title: '整体架构',
    description: '了解技术栈、主要模块和进程关系',
    icon: Layers3,
    question: '分析这个应用的整体架构，说明主要模块和 Electron 主进程、渲染进程之间的关系。'
  },
  {
    title: '功能实现',
    description: '从一个功能追踪到实现证据',
    icon: Search,
    question: '请分析这个应用的搜索功能，追踪涉及的模块和调用关系，并给出证据。'
  },
  {
    title: 'IPC 通信',
    description: '查看界面与主进程如何通信',
    icon: ArrowUpRight,
    question: '列出这个应用的重要 IPC 接口，说明它们如何连接界面与主进程，并提供证据。'
  }
]

const STATUS_LABELS: Record<Task['status'], string> = {
  analyzing: '分析中',
  answering: '生成报告中',
  completed: '已完成',
  cancelled: '已停止',
  error: '需要重试'
}

export default function App(): React.JSX.Element {
  const { theme, language, setTheme, setLanguage, t } = usePreferences()
  const systemText = (text: string): string => localizeSystemText(text, language)
  const errorText = useCallback(
    (error: unknown): string =>
      (error instanceof Error ? error.message : String(error)).replace(
        /^Error invoking remote method '[^']+': (?:Error: )?/,
        ''
      ),
    []
  )
  const [historySearch, setHistorySearch] = useState('')
  const [removing, setRemoving] = useState<TaskOverview | 'all' | null>(null)
  const [removingBusy, setRemovingBusy] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [intent, setIntent] = useState(0)
  const [tasks, setTasks] = useState<TaskOverview[]>([])
  const [task, setTask] = useState<Task | null>(null)
  const [target, setTarget] = useState<Target | null>(null)
  const [question, setQuestion] = useState('')
  const [analysisMode, setAnalysisMode] = useState<'architecture' | 'full'>('architecture')
  const [running, setRunning] = useState(false)
  const [loadingTask, setLoadingTask] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [settings, setSettings] = useState<ModelSettings>({
    id: '',
    name: '',
    protocol: 'chat-completions',
    profiles: [],
    baseUrl: 'https://api.openai.com/v1',
    model: '',
    hasApiKey: false
  })
  const [toolsPanel, setToolsPanel] = useState<{ group?: string; tool?: string } | null>(null)
  const [recoveryPanel, setRecoveryPanel] = useState<{ procedure?: string } | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [preview, setPreview] = useState<EvidencePreview | null>(null)
  const [loadingEvidence, setLoadingEvidence] = useState(false)
  const [modules, setModules] = useState<ModulePage | null>(null)
  const [loadingModules, setLoadingModules] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [toast, setToast] = useState<{ error: boolean; text: string } | null>(null)
  const conversationEnd = useRef<HTMLDivElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const knownParent = useRef<string | null>(null)
  const busy = running || Boolean(progress)
  const working = busy || loadingTask || loadingModules || exporting

  const refreshHistory = useCallback(async (): Promise<void> => {
    setTasks(await window.rea.listTasks())
  }, [])
  useEffect(() => {
    if (!window.rea) return
    void Promise.all([window.rea.listTasks(), window.rea.getSettings()])
      .then(([history, configuration]) => {
        setTasks(history)
        setSettings(configuration)
      })
      .catch((error) => setToast({ error: true, text: errorText(error) }))
    const stopUpdates = window.rea.onTaskUpdate((updated) => {
      setTask(updated)
      setTarget(updated.target)
      if (updated.parentEvidenceId && knownParent.current !== updated.parentEvidenceId) {
        knownParent.current = updated.parentEvidenceId
      }
      if (['completed', 'error', 'cancelled'].includes(updated.status))
        void refreshHistory().catch((error) => setToast({ error: true, text: errorText(error) }))
    })
    const stopProgress = window.rea.onProgress(setProgress)
    return () => {
      stopUpdates()
      stopProgress()
    }
  }, [refreshHistory, errorText])
  useEffect(() => {
    conversationEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [task?.messages.length, progress?.label])

  const resetView = (): void => {
    setPreview(null)
    setModules(null)
    setPanelOpen(false)
    knownParent.current = null
  }
  const chooseTarget = (selected: Target): void => {
    setTask(null)
    setTarget(selected)
    resetView()
    setToast(null)
    textarea.current?.focus()
  }
  const pick = async (kind: 'file' | 'directory'): Promise<void> => {
    try {
      const selected = await window.rea.pickTarget(kind, language)
      if (selected) chooseTarget(selected)
    } catch (error) {
      setToast({ error: true, text: errorText(error) })
    }
  }
  const pickCompanion = async (): Promise<void> => {
    try {
      const selected = await window.rea.pickTarget('directory', language)
      if (selected && target) setTarget({ ...target, companionPath: selected.inputPath })
    } catch (error) {
      setToast({ error: true, text: errorText(error) })
    }
  }
  const drop = async (event: React.DragEvent): Promise<void> => {
    event.preventDefault()
    setDragging(false)
    if (working) return
    const file = event.dataTransfer.files[0]
    if (!file) return
    try {
      chooseTarget(await window.rea.resolveTarget(window.rea.pathForFile(file)))
    } catch (error) {
      setToast({ error: true, text: errorText(error) })
    }
  }
  const openTask = async (id: string): Promise<void> => {
    setLoadingTask(true)
    setToast(null)
    resetView()
    try {
      const selected = await window.rea.getTask(id)
      setTask(selected)
      setTarget(selected.target)
      setQuestion('')
      setPanelOpen(
        Boolean(selected.summary) &&
          !selected.messages.some((message) => message.role === 'assistant')
      )
      knownParent.current = selected.parentEvidenceId
    } catch (error) {
      setToast({ error: true, text: errorText(error) })
    } finally {
      setLoadingTask(false)
    }
  }
  const run = async (suggestion?: string): Promise<void> => {
    if (
      !target ||
      working ||
      (task && !question.trim() && task.status !== 'error' && task.status !== 'cancelled')
    )
      return
    const currentQuestion =
      suggestion ??
      (task
        ? question
        : question.trim() ||
          (settings.model
            ? target.family === 'javascript'
              ? t(EXAMPLES[intent].question)
              : t(
                  intent === 1
                    ? '追踪这个应用的主要功能和调用关系，引用真实证据并说明覆盖限制。'
                    : intent === 2
                      ? '分析这个应用与系统、库和网络之间的交互，给出证据。'
                      : '分析这个应用的格式、技术栈、主要模块和架构。区分实际观察、推断和未知项。'
                )
            : ''))
    setRunning(true)
    setQuestion('')
    setToast(null)
    try {
      const result = await window.rea.runTask({
        ...(task ? { taskId: task.id, target } : { target, analysisMode }),
        question: currentQuestion,
        language
      })
      setTask(result)
      setTarget(result.target)
      if (!settings.model) setPanelOpen(true)
      await refreshHistory()
    } catch (error) {
      setQuestion(currentQuestion)
      setToast({ error: true, text: errorText(error) })
    } finally {
      setRunning(false)
    }
  }
  const cancel = async (): Promise<void> => {
    try {
      await window.rea.cancelTask()
    } catch (error) {
      setToast({ error: true, text: errorText(error) })
    }
  }
  const showEvidence = async (id: string): Promise<void> => {
    if (!task) return
    setPanelOpen(true)
    setLoadingEvidence(true)
    try {
      setPreview(await window.rea.getEvidence(task.id, id))
    } catch (error) {
      setToast({ error: true, text: errorText(error) })
    } finally {
      setLoadingEvidence(false)
    }
  }
  const loadModules = async (offset: number): Promise<void> => {
    if (!task || working) return
    setLoadingModules(true)
    try {
      setModules(await window.rea.listModules(task.id, offset))
    } catch (error) {
      setToast({ error: true, text: errorText(error) })
    } finally {
      setLoadingModules(false)
    }
  }
  const exportTask = async (format: 'markdown' | 'json'): Promise<void> => {
    if (!task) return
    setShowExport(false)
    setExporting(true)
    try {
      const path = await window.rea.exportTask(task.id, format, language)
      if (path) setToast({ error: false, text: t('已导出到 {path}', { path }) })
    } catch (error) {
      setToast({ error: true, text: errorText(error) })
    } finally {
      setExporting(false)
    }
  }
  const newTask = (): void => {
    setTask(null)
    setTarget(null)
    setQuestion('')
    setToast(null)
    resetView()
  }
  const removeHistory = async (): Promise<void> => {
    if (!removing) return
    setRemovingBusy(true)
    try {
      if (removing === 'all') {
        const count = await window.rea.clearTasks()
        newTask()
        setHistorySearch('')
        setToast({ error: false, text: t('已清理 {count} 条历史记录。', { count }) })
      } else {
        await window.rea.deleteTask(removing.id)
        if (task?.id === removing.id) newTask()
        setToast({ error: false, text: t('已删除该条历史记录。') })
      }
      setRemoving(null)
      await refreshHistory()
    } catch (error) {
      setToast({ error: true, text: errorText(error) })
    } finally {
      setRemovingBusy(false)
    }
  }

  const history = tasks.filter((item) =>
    `${item.title} ${item.targetName}`.toLowerCase().includes(historySearch.toLowerCase())
  )
  const retryable = task && ['error', 'cancelled'].includes(task.status)
  const dateLabel = (date: string): string =>
    new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(date))

  if (!window.rea)
    return (
      <main className="browser-note">
        <FileCode2 size={32} />
        <h1>REA Desktop</h1>
        <p>{t('请运行 npm run dev，在 Electron 桌面窗口中使用本地分析功能。')}</p>
      </main>
    )

  return (
    <div className="desktop-shell">
      <div className="window-bar">
        <span>REA Desktop</span>
        <span className="window-version">v0.1</span>
      </div>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">
              <FileCode2 size={21} />
            </div>
            <strong>
              REA<span>Desktop</span>
            </strong>
          </div>
          <button className="new-task" disabled={working} onClick={newTask}>
            <Plus size={17} />
            {t('新建分析')}
          </button>
          <button
            className="new-task capability-entry"
            disabled={working}
            onClick={() => setToolsPanel({})}
          >
            <Layers3 size={17} />
            {t('REA 能力中心')}
          </button>
          <div className="sidebar-heading">
            <span>{t('历史记录')}</span>
            <span className="sidebar-heading-actions">
              <span>{tasks.length}</span>
              {tasks.length > 0 && (
                <button
                  className="text-action"
                  disabled={working}
                  onClick={() => setRemoving('all')}
                >
                  {t('清理')}
                </button>
              )}
            </span>
          </div>
          {tasks.length > 0 && (
            <label className="history-search">
              <Search size={14} />
              <input
                aria-label={t('搜索历史记录')}
                placeholder={t('搜索应用或问题')}
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
              />
              {historySearch && (
                <button
                  className="icon-button"
                  aria-label={t('清空搜索')}
                  onClick={() => setHistorySearch('')}
                >
                  <X size={13} />
                </button>
              )}
            </label>
          )}
          <nav className="history-list" aria-label={t('历史记录')}>
            {history.map((item) => (
              <div className="history-row" key={item.id}>
                <button
                  className={`history-item ${task?.id === item.id ? 'active' : ''}`}
                  disabled={working}
                  onClick={() => void openTask(item.id)}
                  title={item.title}
                >
                  <span className={`history-status ${item.status}`}>
                    <FileCode2 size={16} />
                  </span>
                  <span>
                    <strong>{item.targetName}</strong>
                    <small>{item.title}</small>
                    <span className="history-meta">
                      {dateLabel(item.updatedAt)} · {t(STATUS_LABELS[item.status])}
                    </span>
                  </span>
                </button>
                <button
                  className="icon-button danger history-remove"
                  aria-label={t('删除记录')}
                  title={t('删除记录')}
                  disabled={working}
                  onClick={() => setRemoving(item)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {!history.length && (
              <div className="history-empty">
                <MessageSquare size={23} />
                <p>{t(tasks.length ? '没有匹配的记录' : '还没有分析记录')}</p>
                <small>
                  {t(
                    tasks.length
                      ? '试试其他应用名称或关键词。'
                      : '完成一次分析后，可以在这里继续查看和提问。'
                  )}
                </small>
              </div>
            )}
          </nav>
          <div className="sidebar-footer">
            <button className="model-status" onClick={() => setShowSettings(true)}>
              <span className={`status-dot ${settings.model ? 'connected' : ''}`} />
              <span>
                <strong>{settings.name || t('连接模型')}</strong>
                <small>{settings.model || t('可先体验本地分析')}</small>
              </span>
              <Settings2 size={16} />
            </button>
            <button className="sidebar-help" onClick={() => setShowHelp(true)}>
              <CircleHelp size={15} />
              {t('使用指南')}
              <ChevronRight size={14} />
            </button>
          </div>
        </aside>
        <main
          className={`main-workspace ${dragging ? 'dragging' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            if (!working) setDragging(true)
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
              setDragging(false)
          }}
          onDrop={(event) => void drop(event)}
        >
          <header className="workspace-header">
            <div className="breadcrumb">
              <span>{t('工作区')}</span>
              <ChevronRight size={13} />
              <strong>{task?.target.name || t('新建分析')}</strong>
            </div>
            <div className="header-actions">
              <div className="appearance-toggle" role="group" aria-label={t('主题')}>
                <button
                  className="icon-button"
                  aria-label={t('浅色主题')}
                  title={t('浅色主题')}
                  aria-pressed={theme === 'light'}
                  onClick={() => setTheme('light')}
                >
                  <Sun size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label={t('深色主题')}
                  title={t('深色主题')}
                  aria-pressed={theme === 'dark'}
                  onClick={() => setTheme('dark')}
                >
                  <Moon size={16} />
                </button>
              </div>
              <button
                className="language-toggle"
                aria-label={t('切换语言')}
                title={t('切换语言')}
                onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
              >
                <Languages size={15} />
                <span>{language === 'zh' ? 'EN' : '中文'}</span>
              </button>
              <button
                className="icon-button"
                onClick={() => setShowSettings(true)}
                aria-label={t('设置')}
                title={t('设置')}
              >
                <Settings2 size={17} />
              </button>
            </div>
          </header>
          {toast && (
            <div className={`toast ${toast.error ? 'error' : 'success'}`} role="status">
              {toast.error ? <CircleHelp size={16} /> : <Check size={16} />}
              <span>{systemText(toast.text)}</span>
              <button
                className="icon-button"
                aria-label={t('关闭提示')}
                onClick={() => setToast(null)}
              >
                <X size={15} />
              </button>
            </div>
          )}
          <div className="workspace-body">
            <div className="conversation-column">
              <div className="conversation-scroll">
                {!task && (
                  <div className="welcome">
                    <div className="welcome-label">
                      <span className="status-dot connected" />
                      {t('在本机，读懂应用')}
                    </div>
                    <h1>{t('从应用到架构，清楚每一步。')}</h1>
                    <p className="welcome-description">
                      {t('选择一个应用，REA 会整理它的结构和实现证据。无需启动目标应用。')}
                    </p>
                    <ol className="setup-steps" aria-label={t('分析步骤')}>
                      <li className={target ? 'done' : 'current'}>
                        <span>{target ? <Check size={13} /> : '1'}</span>
                        {t('选择应用')}
                      </li>
                      <li className={target ? 'current' : ''}>
                        <span>2</span>
                        {t('选择目标')}
                      </li>
                      <li>
                        <span>3</span>
                        {t('查看结果')}
                      </li>
                    </ol>
                    <section
                      className={`target-card ${target ? 'has-target' : ''}`}
                      aria-label={t('分析目标')}
                    >
                      <div className="target-icon">
                        {target ? <FileCode2 size={27} /> : <Upload size={27} />}
                      </div>
                      <div className="target-description">
                        <strong>{target?.name || t('选择或拖入一个应用')}</strong>
                        <span title={target?.inputPath}>
                          {target?.inputPath ||
                            t('支持 EXE、ASAR、APK、.NET、WASM、数据库和应用目录')}
                        </span>
                      </div>
                      <div className="target-actions">
                        <button
                          className={`button ${target ? 'secondary' : 'primary'}`}
                          disabled={working}
                          onClick={() => void pick('file')}
                        >
                          <FolderOpen size={16} />
                          {t(target ? '更换' : '选择应用')}
                        </button>
                        <button
                          className="text-action"
                          disabled={working}
                          onClick={() => void pick('directory')}
                        >
                          {t('选择目录')}
                        </button>
                        {target && (
                          <button
                            className="icon-button"
                            aria-label={t('移除应用')}
                            title={t('移除应用')}
                            onClick={() => {
                              setTarget(null)
                              setQuestion('')
                            }}
                          >
                            <X size={15} />
                          </button>
                        )}
                      </div>
                    </section>
                    {target && (
                      <p className="target-format">
                        <span className="tag">
                          {target.managed
                            ? '.NET / CIL'
                            : target.packaging
                              ? 'PyInstaller / Python'
                              : target.format.toUpperCase()}
                        </span>
                        <span>
                          {target.bytes ? `${(target.bytes / 1024 / 1024).toFixed(1)} MiB` : ''}
                        </span>
                        <button
                          className="text-action"
                          onClick={() => setToolsPanel({ group: target.family })}
                        >
                          {t('查看对应工具')}
                          <ChevronRight size={13} />
                        </button>
                      </p>
                    )}
                    <details className="format-support">
                      <summary>{t('支持的格式与完整功能')}</summary>
                      <div>
                        {FORMAT_FAMILIES.map((family) => (
                          <button
                            key={family.id}
                            onClick={() => setToolsPanel({ group: family.id })}
                          >
                            <strong>{t(family.title)}</strong>
                            <small>{family.extensions}</small>
                          </button>
                        ))}
                      </div>
                      <button className="text-action" onClick={() => setToolsPanel({})}>
                        {t('打开全部能力与推荐流程')}
                      </button>
                    </details>
                    <section className="intent-section">
                      <div className="section-heading">
                        <h2>{t('你想先了解什么？')}</h2>
                        <span className="small muted">{t('随时可以继续追问')}</span>
                      </div>
                      <div className="intent-grid">
                        {EXAMPLES.map((example, index) => (
                          <button
                            key={example.title}
                            className={`intent-card ${intent === index ? 'selected' : ''}`}
                            aria-pressed={intent === index}
                            onClick={() => {
                              setIntent(index)
                              setQuestion('')
                            }}
                          >
                            <example.icon size={20} />
                            <strong>
                              {t(
                                target?.family && target.family !== 'javascript' && index === 2
                                  ? '系统交互'
                                  : example.title
                              )}
                            </strong>
                            <span>
                              {t(
                                target?.family && target.family !== 'javascript'
                                  ? index === 0
                                    ? '格式、技术栈与主要模块'
                                    : index === 2
                                      ? '系统、库和网络的交互证据'
                                      : example.description
                                  : example.description
                              )}
                            </span>
                            {intent === index && <Check size={14} className="intent-check" />}
                          </button>
                        ))}
                      </div>
                    </section>
                    {intent === 1 && (
                      <p className="intent-note">
                        {t('默认以搜索功能为例；也可以在下方填写你想了解的功能。')}
                      </p>
                    )}
                    <label className="question-field">
                      <span>
                        {t('补充一个具体问题')} <small>{t('选填')}</small>
                      </span>
                      <textarea
                        ref={textarea}
                        rows={2}
                        maxLength={8000}
                        aria-label={t('分析问题')}
                        placeholder={t('例如：搜索功能是怎么实现的？留空会按上方目标分析。')}
                        value={question}
                        onChange={(event) => setQuestion(event.target.value)}
                        onKeyDown={(event) => {
                          if (
                            event.key === 'Enter' &&
                            !event.shiftKey &&
                            !event.nativeEvent.isComposing
                          ) {
                            event.preventDefault()
                            void run()
                          }
                        }}
                      />
                    </label>
                    {target?.format === 'asar' && (
                      <details className="advanced-options">
                        <summary>
                          <ChevronRight size={14} />
                          {t('进阶选项')}
                          <span>
                            {t(analysisMode === 'architecture' ? '快速架构分析' : '完整静态分析')}
                          </span>
                        </summary>
                        <div className="advanced-body">
                          <label className="form-field">
                            {t('分析范围')}
                            <select
                              value={analysisMode}
                              disabled={working}
                              onChange={(event) =>
                                setAnalysisMode(event.target.value as 'architecture' | 'full')
                              }
                            >
                              <option value="architecture">{t('快速架构分析（推荐）')}</option>
                              <option value="full">{t('完整静态分析（耗时较长）')}</option>
                            </select>
                          </label>
                          <p className="small muted">
                            {t(
                              '快速模式只解析关键入口并保留完整文件索引。完整模式会读取全部文件，可能需要较长时间。'
                            )}
                          </p>
                          <button className="button secondary" onClick={() => void pickCompanion()}>
                            {t('补充 unpacked 目录')}
                          </button>
                          {target.companionPath && (
                            <div className="companion-path">
                              <span>{target.companionPath}</span>
                              <button
                                className="icon-button"
                                aria-label={t('移除配套目录')}
                                onClick={() => setTarget({ ...target, companionPath: undefined })}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          )}
                          <p className="small muted">
                            {t(
                              '仅在 ASAR 缺少外置文件时需要。完整模式请直接选择完整 .app 或把 .unpacked 放在 ASAR 旁边。'
                            )}
                          </p>
                        </div>
                      </details>
                    )}
                    <div className="start-row">
                      <div>
                        <ShieldCheck size={17} />
                        <span>
                          {t(
                            settings.model
                              ? '文件在本机分析，选取的证据发送到模型。'
                              : '无需配置模型，也能查看应用结构与证据。'
                          )}
                        </span>
                      </div>
                      <button
                        className="button primary start-button"
                        disabled={!target || working}
                        onClick={() => void run()}
                      >
                        <Play size={15} />
                        {t('开始分析')}
                      </button>
                    </div>
                    {!settings.model && (
                      <div className="model-nudge">
                        <span>{t('想要易读的分析报告？连接模型即可获取解释。')}</span>
                        <button className="text-action" onClick={() => setShowSettings(true)}>
                          {t('连接模型')}
                          <ArrowUpRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {task && (
                  <div className="conversation">
                    <div className="task-toolbar">
                      <div className="task-title">
                        <FileCode2 size={22} />
                        <div>
                          <h1>{task.target.name}</h1>
                          <span>
                            {t(
                              task.analysisMode === 'full'
                                ? '完整静态分析'
                                : task.analysisScope
                                  ? '快速架构分析'
                                  : '静态分析'
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="task-actions">
                        <button
                          className="button secondary compact"
                          disabled={working}
                          onClick={() => setRecoveryPanel({})}
                        >
                          <FileCode2 size={15} />
                          {t('代码')}
                        </button>
                        <button
                          className="button secondary compact"
                          disabled={working}
                          onClick={() => setToolsPanel({})}
                        >
                          {t('工具')}
                        </button>
                        <span className={`task-state ${task.status}`}>
                          <span className="status-dot" />
                          {t(STATUS_LABELS[task.status])}
                        </span>
                        <button
                          className={`button secondary compact ${panelOpen ? 'selected' : ''}`}
                          aria-expanded={panelOpen}
                          onClick={() => setPanelOpen(!panelOpen)}
                        >
                          <Layers3 size={15} />
                          {t('证据')}
                          <span className="count-badge">{task.evidence.length}</span>
                        </button>
                        <div className="export-control">
                          <button
                            className="button secondary compact"
                            aria-expanded={showExport}
                            disabled={working}
                            onClick={() => setShowExport(!showExport)}
                          >
                            <ArrowDownToLine size={15} />
                            {t('导出')}
                            <ChevronDown size={13} />
                          </button>
                          {showExport && (
                            <>
                              <button
                                className="menu-dismiss"
                                aria-label={t('关闭导出菜单')}
                                onClick={() => setShowExport(false)}
                              />
                              <div className="export-menu">
                                <button onClick={() => void exportTask('markdown')}>
                                  {t('Markdown 报告')}
                                </button>
                                <button
                                  disabled={!task.bundleSaved}
                                  onClick={() => void exportTask('json')}
                                >
                                  {t('JSON 证据包')}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {task.messages.map((message) => (
                      <article key={message.id} className={`message ${message.role}`}>
                        {message.role === 'notice' ? (
                          <div className="notice-message">
                            <ShieldCheck size={16} />
                            <p>
                              {message.content.startsWith('架构快速分析：') && task.analysisScope
                                ? t('已扫描 {total} 个文件，选取 {selected} 个架构入口分析。', {
                                    total: task.analysisScope.totalFiles,
                                    selected: task.analysisScope.selectedFiles
                                  }) +
                                  ' ' +
                                  task.analysisScope.limitations.map(systemText).join(' ')
                                : systemText(message.content)}
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="message-avatar">
                              {message.role === 'user' ? t('你') : <FileCode2 size={16} />}
                            </div>
                            <div className="message-content">
                              <div className="message-author">
                                {message.role === 'user' ? t('你') : 'REA'}
                                <span>
                                  {message.incomplete && t(busy ? '生成中 · ' : '部分内容 · ')}
                                  {new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }).format(new Date(message.createdAt))}
                                </span>
                              </div>
                              {message.role === 'assistant' ? (
                                <Markdown
                                  content={message.content}
                                  onEvidence={(id) => void showEvidence(id)}
                                />
                              ) : (
                                <p className="user-message">{message.content}</p>
                              )}
                            </div>
                          </>
                        )}
                      </article>
                    ))}
                    {busy && (
                      <div className="running-message" role="status">
                        <LoaderCircle size={17} className="spin" />
                        <span>{systemText(progress?.label || '正在准备分析')}</span>
                        <button className="text-action" onClick={() => void cancel()}>
                          {t('停止')}
                        </button>
                      </div>
                    )}
                    {task.error && (
                      <div className="task-error" role="alert">
                        <strong>{t('本轮未完成，已有结果已保存')}</strong>
                        <p>{systemText(task.error)}</p>
                        <div>
                          <button
                            className="button secondary"
                            disabled={working}
                            onClick={() => void run('')}
                          >
                            <RotateCcw size={14} />
                            {t('重试本轮')}
                          </button>
                          <button className="text-action" onClick={() => setShowSettings(true)}>
                            {t('检查模型设置')}
                          </button>
                        </div>
                      </div>
                    )}
                    <div ref={conversationEnd} />
                  </div>
                )}
                {loadingTask && (
                  <div className="loading-overlay" role="status">
                    <LoaderCircle size={22} className="spin" />
                    {t('正在读取历史任务')}
                  </div>
                )}
              </div>
              {task && (
                <div className="composer-wrap">
                  <div className={`composer ${working ? 'working' : ''}`}>
                    <textarea
                      ref={textarea}
                      aria-label={t('继续提问')}
                      value={question}
                      maxLength={8000}
                      disabled={working}
                      rows={2}
                      placeholder={t('继续追问某个功能，或补充你想了解的细节…')}
                      onChange={(event) => setQuestion(event.target.value)}
                      onKeyDown={(event) => {
                        if (
                          event.key === 'Enter' &&
                          !event.shiftKey &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault()
                          void run()
                        }
                      }}
                    />
                    <div className="composer-bottom">
                      <span>
                        <FileCode2 size={13} />
                        {target?.name}
                      </span>
                      {busy ? (
                        <button className="button stop" onClick={() => void cancel()}>
                          <Square size={12} fill="currentColor" />
                          {t('停止')}
                        </button>
                      ) : (
                        <button
                          className="button primary"
                          disabled={working || (!question.trim() && !retryable)}
                          onClick={() => void run()}
                        >
                          {t(question.trim() ? '发送问题' : '继续任务')}
                          <ArrowUp size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="composer-note">
                    <span>{t('Enter 发送 · Shift + Enter 换行')}</span>
                    <button onClick={() => setShowSettings(true)}>
                      <span className={`status-dot ${settings.model ? 'connected' : ''}`} />
                      {settings.model || t('连接模型以获取解释')}
                    </button>
                  </div>
                </div>
              )}
            </div>
            {panelOpen && task && (
              <EvidencePanel
                task={task}
                preview={preview}
                loading={loadingEvidence}
                modules={modules}
                loadingModules={loadingModules}
                busy={busy}
                onClose={() => setPanelOpen(false)}
                onEvidence={(id) => void showEvidence(id)}
                onModules={(offset) => void loadModules(offset)}
                onProcedure={(procedure) => setRecoveryPanel({ procedure })}
              />
            )}
          </div>
          {dragging && (
            <div className="drop-overlay">
              <Upload size={34} />
              <strong>{t('松开以选择应用')}</strong>
              <span>EXE · ASAR · APK · .NET · WASM · HAR · SQLite</span>
            </div>
          )}
        </main>
      </div>
      {toolsPanel && (
        <ToolsPanel
          task={task}
          target={target}
          initialGroup={toolsPanel.group}
          initialTool={toolsPanel.tool}
          onClose={() => setToolsPanel(null)}
          onSettings={() => {
            setToolsPanel(null)
            setShowSettings(true)
          }}
        />
      )}
      {recoveryPanel && task && (
        <RecoveryPanel
          task={task}
          procedure={recoveryPanel.procedure}
          onClose={() => setRecoveryPanel(null)}
          onTools={() => {
            setRecoveryPanel(null)
            setToolsPanel({ group: 'recovery' })
          }}
        />
      )}
      {showSettings && (
        <Settings
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSaved={(saved) => setSettings(saved)}
        />
      )}
      {showHelp && (
        <Help
          onClose={() => setShowHelp(false)}
          onSettings={() => {
            setShowHelp(false)
            setShowSettings(true)
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={removing === 'all' ? t('清理全部历史记录？') : t('删除这条历史记录？')}
          message={
            removing === 'all'
              ? t('将删除本机保存的全部 {count} 条分析记录及其证据，删除后无法恢复。', {
                  count: tasks.length
                })
              : t('将删除“{name}”及其保存的证据，删除后无法恢复。', {
                  name: removing.title
                })
          }
          confirmLabel={removing === 'all' ? t('清理全部') : t('确认删除记录')}
          busy={removingBusy}
          onConfirm={() => void removeHistory()}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  )
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busy,
  onConfirm,
  onClose
}: {
  title: string
  message: string
  confirmLabel: string
  busy: boolean
  onConfirm: () => void
  onClose: () => void
}): React.JSX.Element {
  const { t } = usePreferences()
  const dialog = useDialog(onClose, busy)
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <section
        className="confirm-modal"
        ref={dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">{t('历史记录')}</span>
            <h2 id="confirm-title">{title}</h2>
          </div>
        </div>
        <p className="confirm-message">{message}</p>
        <div className="modal-actions">
          <button className="button secondary" disabled={busy} onClick={onClose}>
            {t('取消')}
          </button>
          <button className="button danger" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

function Help({
  onClose,
  onSettings
}: {
  onClose: () => void
  onSettings: () => void
}): React.JSX.Element {
  const { t } = usePreferences()
  const dialog = useDialog(onClose)
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="help-modal"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">REA DESKTOP</span>
            <h2 id="help-title">{t('三步开始分析')}</h2>
          </div>
          <button className="icon-button" aria-label={t('关闭指南')} onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <ol className="help-steps">
          <li>
            <strong>{t('选择一个完整应用')}</strong>
            <p>
              {t(
                '选择或拖入 EXE、ASAR、APK、.NET、WASM、数据库、网络捕获或应用目录，程序会识别格式并选择分析流程。'
              )}
            </p>
          </li>
          <li>
            <strong>{t('选目标，点击开始')}</strong>
            <p>{t('默认快速分析整体架构，不必填写问题。需要时再展开进阶选项。')}</p>
          </li>
          <li>
            <strong>{t('查看报告，继续追问')}</strong>
            <p>
              {t('报告里的证据链接可直接查看来源。结果自动保存到历史，也能导出 Markdown 或 JSON。')}
            </p>
          </li>
        </ol>
        <div className="help-note">
          <ShieldCheck size={19} />
          <p>
            {t(
              '目标应用不会被启动。文件在本机分析；使用云端模型时，问题和选取的证据会发送给模型服务。'
            )}
          </p>
        </div>
        <div className="modal-actions">
          <button className="button secondary" onClick={onSettings}>
            {t('连接模型')}
          </button>
          <button className="button primary" onClick={onClose}>
            {t('开始使用')}
          </button>
        </div>
      </section>
    </div>
  )
}

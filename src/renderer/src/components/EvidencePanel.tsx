import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, FileCode2, Layers3, LoaderCircle, X } from 'lucide-react'
import { usePreferences } from '../preferences-context'
import { localizeSystemText } from '../../../shared/locale'
import type { EvidencePreview, JsonObject, ModulePage, Task } from '../../../shared/types'

function record(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {}
}

export function EvidencePanel({
  task,
  preview,
  loading,
  modules,
  loadingModules,
  busy,
  onClose,
  onEvidence,
  onModules,
  onProcedure
}: {
  task: Task
  preview: EvidencePreview | null
  loading: boolean
  modules: ModulePage | null
  loadingModules: boolean
  busy: boolean
  onClose: () => void
  onEvidence: (id: string) => void
  onModules: (offset: number) => void
  onProcedure: (procedure: string) => void
}): React.JSX.Element {
  const { t, language } = usePreferences()
  const [copied, setCopied] = useState(false)
  const normalized = record(task.summary?.normalized_result)
  const summary = record(normalized.summary)
  const statistics = record(summary.statistics)
  const counts = Object.entries({
    归档文件: task.analysisScope?.totalFiles,
    解析文件: statistics.parsed_javascript_files,
    文件: statistics.relevant_files,
    IPC通道: record(record(summary.electron).ipc).literal_channels
  }).filter(([, value]) => typeof value === 'number')
  const limitations = [
    ...(task.analysisScope?.limitations ?? []),
    ...(task.analysisIssues ?? []),
    ...(Array.isArray(normalized.limitations) ? normalized.limitations.map(String) : []),
    ...(Array.isArray(normalized.unknowns) ? normalized.unknowns.map(String) : [])
  ]

  const copy = async (): Promise<void> => {
    if (preview) {
      await navigator.clipboard.writeText(preview.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <aside className="evidence-panel">
      <div className="panel-heading">
        <span>
          <Layers3 size={17} />
          {t('分析证据')}
        </span>
        <button className="icon-button" aria-label={t('收起证据')} onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      <div className="panel-scroll">
        <div className="panel-section">
          <span className="eyebrow">{t('应用信息')}</span>
          <h3>{task.target.name}</h3>
          <p className="path-label" title={task.target.inputPath}>
            {task.target.inputPath}
          </p>
          {task.analysisScope && (
            <p className="small muted">
              {t('架构快速分析 · 抽取 {count} 个入口文件', {
                count: task.analysisScope.selectedFiles
              })}
            </p>
          )}
          {counts.length > 0 && (
            <div className="summary-counts">
              {counts.map(([label, value]) => (
                <div key={label}>
                  <strong>{String(value)}</strong>
                  <span>{t(label)}</span>
                </div>
              ))}
            </div>
          )}
          {task.parentEvidenceId && (
            <button className="text-action" onClick={() => onEvidence(task.parentEvidenceId!)}>
              {t('查看应用概览')}
              <ChevronRight size={14} />
            </button>
          )}
        </div>
        <div className="panel-section">
          <div className="section-heading">
            <h4>{t(task.analysisFamily === 'native' ? '函数与符号' : '应用模块')}</h4>
            <button
              className="text-action"
              disabled={busy || loadingModules || !task.parentEvidenceId}
              onClick={() => onModules(0)}
            >
              {loadingModules ? (
                <LoaderCircle size={13} className="spin" />
              ) : (
                <FileCode2 size={13} />
              )}
              {t(modules ? '刷新' : '浏览')}
            </button>
          </div>
          {modules ? (
            <>
              <div className="module-list">
                {modules.items.map((item, index) => (
                  <button
                    onClick={() =>
                      task.analysisFamily === 'native' && !record(item.procedure).external
                        ? onProcedure(String(item.address ?? item.value))
                        : onEvidence(modules.evidenceId)
                    }
                    className="module-item"
                    key={String(item.node_id ?? index)}
                    title={String(item.path ?? item.node_id)}
                  >
                    <FileCode2 size={14} />
                    <span>{String(item.path ?? item.node_id)}</span>
                  </button>
                ))}
              </div>
              {modules.items.length === 0 && (
                <p className="small muted">{t('此页没有可展示的模块。')}</p>
              )}
              <div className="module-pages">
                <span className="small muted">
                  {t('当前页 {count} 项', { count: modules.items.length })}
                </span>
                <button className="text-action" onClick={() => onEvidence(modules.evidenceId)}>
                  {t('查看本页证据')}
                </button>
              </div>
              {modules.nextOffset !== null && (
                <button
                  className="button secondary full-width"
                  disabled={busy || loadingModules}
                  onClick={() => onModules(modules.nextOffset!)}
                >
                  {t('下一页')}
                  <ChevronRight size={13} />
                </button>
              )}
            </>
          ) : (
            <p className="small muted">{t('按需读取模块，完整分析保留在本机。')}</p>
          )}
        </div>
        <div className="panel-section">
          <div className="section-heading">
            <h4>{t('证据记录')}</h4>
            <span className="count-badge">{task.evidence.length}</span>
          </div>
          <div className="evidence-list">
            {task.evidence.map((item) => (
              <button
                key={item.id}
                className={`evidence-item ${preview?.id === item.id ? 'selected' : ''}`}
                onClick={() => onEvidence(item.id)}
              >
                <FileCode2 size={14} />
                <span>
                  <strong>{localizeSystemText(item.title, language)}</strong>
                  <small>{item.id.slice(0, 19)}…</small>
                </span>
                <ChevronRight size={13} />
              </button>
            ))}
          </div>
          {task.evidence.length === 0 && (
            <p className="small muted">{t('分析完成后，证据会显示在这里。')}</p>
          )}
        </div>
        {loading && (
          <div className="panel-section small muted">
            <LoaderCircle size={14} className="spin" />
            {t('正在读取证据…')}
          </div>
        )}
        {preview && !loading && (
          <div className="panel-section preview-section">
            <div className="section-heading">
              <h4>{t('证据详情')}</h4>
              <button
                className="text-action"
                onClick={() => {
                  void copy()
                }}
              >
                <Copy size={13} />
                {t(copied ? '已复制' : '复制')}
              </button>
            </div>
            <code className="evidence-id">{preview.id}</code>
            {preview.truncated && (
              <p className="small muted">{t('当前为部分预览，导出 JSON 证据包可查看完整内容。')}</p>
            )}
            <pre className="json-preview">{preview.text}</pre>
          </div>
        )}
        {limitations.length > 0 && (
          <div className="panel-section">
            <details className="limitations">
              <summary>
                <ChevronDown size={13} />
                {t('覆盖范围与未确认项')}
              </summary>
              <ul>
                {limitations.map((item, index) => (
                  <li key={index}>{localizeSystemText(item, language)}</li>
                ))}
              </ul>
            </details>
          </div>
        )}
      </div>
    </aside>
  )
}

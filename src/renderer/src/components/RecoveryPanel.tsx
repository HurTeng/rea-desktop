import { useState } from 'react'
import { ArrowDownToLine, FolderOpen, LoaderCircle, Play, Search, X } from 'lucide-react'
import type { EvidencePreview, RecoveryResult, Task } from '../../../shared/types'
import { usePreferences } from '../preferences-context'
import { useDialog } from './useDialog'
const REPRESENTATIONS: Record<string, string> = {
  'rea-evidence': 'REA 原始证据',
  'shipped-source': '随包源码/脚本',
  'embedded-source': '内嵌映射源码',
  'python-bytecode': 'Python 字节码',
  'python-bytecode-archive': 'Python 字节码归档',
  'archive-index': '归档索引',
  'native-pseudocode': '原生伪代码',
  'managed-cil-and-metadata': '.NET CIL 与元数据',
  'wasm-wat': 'WebAssembly 文本'
}
export function RecoveryPanel({
  task,
  procedure: initialProcedure,
  onClose,
  onTools
}: {
  task: Task
  procedure?: string
  onClose: () => void
  onTools: () => void
}): React.JSX.Element {
  const { t, language } = usePreferences(),
    [recovery, setRecovery] = useState<RecoveryResult | null>(task.recovery || null),
    [preview, setPreview] = useState<EvidencePreview | null>(null),
    [working, setWorking] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [query, setQuery] = useState(''),
    [procedure, setProcedure] = useState(initialProcedure || '')
  const dialog = useDialog(onClose, working)
  const run = async (): Promise<void> => {
    setWorking(true)
    setError('')
    setPreview(null)
    try {
      setRecovery(await window.rea.recoverCode(task.id, procedure || undefined))
    } catch (error) {
      setError(String(error))
    } finally {
      setWorking(false)
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        ref={dialog}
        className="recovery-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-title"
      >
        <header className="modal-heading">
          <div>
            <h2 id="recovery-title">{t('代码恢复与导出')}</h2>
            <p>
              {task.target.name} · {task.target.packaging?.kind || task.target.format}
            </p>
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
        <div className="recovery-body">
          <div className="recovery-intro">
            <p>
              {t(
                task.target.packaging
                  ? '已识别 PyInstaller：可提取 Python 字节码与 PYZ。指定函数时可反编译原生加载器。'
                  : task.target.family === 'native'
                    ? '输入函数名或地址，导出引擎生成的伪代码。可先在证据面板浏览函数。'
                    : '导出实际存在的脚本、内嵌源码、CIL 或 WAT；输出类型会逐文件标明。'
              )}
            </p>
            {task.target.family === 'native' && (
              <label className="form-field">
                {t('函数名或地址')}
                <input
                  value={procedure}
                  onChange={(event) => setProcedure(event.target.value)}
                  placeholder={
                    task.target.packaging
                      ? t('留空提取 Python 字节码')
                      : 'main / entry / 0x140001000'
                  }
                />
              </label>
            )}
            <div className="tool-run-row">
              <button
                className="button primary"
                disabled={
                  working ||
                  Boolean(
                    task.target.family === 'native' && !task.target.packaging && !procedure.trim()
                  )
                }
                onClick={() => void run()}
              >
                {working ? <LoaderCircle size={15} className="spin" /> : <Play size={15} />}{' '}
                {t(working ? '恢复中…' : '恢复 / 导出代码')}
              </button>
              <button className="text-action" onClick={onTools}>
                {t('更多恢复工具')}
              </button>
              {working && (
                <button className="text-action" onClick={() => void window.rea.cancelTask()}>
                  {t('停止')}
                </button>
              )}
            </div>
          </div>
          {error && <div className="form-result failure">{error}</div>}
          {notice && <div className="form-result success">{notice}</div>}
          {recovery && (
            <>
              <div className="section-heading">
                <span>
                  {recovery.files.length} {t('个文件')}
                </span>
                <div className="tool-run-row">
                  <button
                    className="text-action"
                    onClick={() => void window.rea.revealRecovery(task.id)}
                  >
                    <FolderOpen size={14} />
                    {t('打开输出目录')}
                  </button>
                  <button
                    className="text-action"
                    onClick={() =>
                      void window.rea
                        .exportRecoveredCode(task.id)
                        .then((path) => path && setNotice(`${t('已导出')} · ${path}`))
                        .catch((error) => setError(String(error)))
                    }
                  >
                    <ArrowDownToLine size={14} />
                    {t('导出文件夹')}
                  </button>
                </div>
              </div>
              <div className="recovery-files-layout">
                <div className="recovery-files">
                  <label className="capability-search">
                    <Search size={14} />
                    <input
                      placeholder={t('筛选文件…')}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </label>
                  {recovery.files
                    .filter((file) => file.path.toLowerCase().includes(query.toLowerCase()))
                    .map((file) => (
                      <button
                        key={file.path}
                        className={preview?.id === file.path ? 'selected' : ''}
                        onClick={() =>
                          void window.rea
                            .readRecoveredFile(task.id, file.path)
                            .then(setPreview)
                            .catch((error) => setError(String(error)))
                        }
                      >
                        <strong>{file.path.replace(/^[a-f0-9-]{36}[/\\]/, '')}</strong>
                        <small>
                          {language === 'zh'
                            ? REPRESENTATIONS[file.representation] || file.representation
                            : file.representation}{' '}
                          · {file.bytes.toLocaleString()} B
                        </small>
                      </button>
                    ))}
                </div>
                <div className="recovery-preview">
                  {preview ? (
                    <>
                      <code>{preview.id}</code>
                      <pre>{preview.text}</pre>
                      {preview.truncated && <p>{t('预览已截断，导出可查看完整结果。')}</p>}
                    </>
                  ) : (
                    <p className="muted">{t('选择文件查看实际恢复内容')}</p>
                  )}
                </div>
              </div>
              <ul className="recovery-limitations">
                {recovery.limitations.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

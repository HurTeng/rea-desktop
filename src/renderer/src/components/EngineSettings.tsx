import { useEffect, useState } from 'react'
import { CheckCircle2, FolderOpen, LoaderCircle, Plus, RefreshCw, X } from 'lucide-react'
import type { EngineSettings as Settings, EngineStatus, JsonObject } from '../../../shared/types'
import { usePreferences } from '../preferences-context'
const VARIABLES = [
  ['REA_KUNA_COMMAND', 'Kuna 启动程序（源码运行时）', 'file'],
  ['REA_KUNA_CACHE_DIR', 'Kuna 缓存目录', 'directory'],
  ['GHIDRA_INSTALL_DIR', 'Ghidra 12.1.x 安装目录', 'directory'],
  ['JAVA_HOME', '完整 JDK 安装目录', 'directory'],
  ['REA_GHIDRA_STARTUP_TIMEOUT_MS', 'Ghidra 启动等待（毫秒）', 'value'],
  ['HOPPER_LAUNCHER_PATH', 'Hopper 启动程序', 'file'],
  ['REA_IDA_MCP_CONFIG', 'IDA MCP 注册 JSON', 'file'],
  ['REA_JADX_MCP_JAR', 'JADX headless MCP JAR', 'file'],
  ['REA_JEB_MCP_URL', 'JEB 本机 MCP URL', 'value'],
  ['REA_ADB_COMMAND', 'ADB 可执行文件', 'file'],
  ['REA_APKTOOL_COMMAND', 'Apktool 启动程序', 'file'],
  ['REA_WABT_BIN_DIRECTORY', 'WABT 1.0.42 的 bin 目录', 'directory'],
  ['REA_TSHARK_COMMAND', 'TShark 可执行文件', 'file'],
  ['REA_CAPINFOS_COMMAND', 'capinfos 可执行文件', 'file'],
  ['REA_BINWALK_COMMAND', 'Binwalk（Linux）', 'file'],
  ['REA_UNBLOB_COMMAND', 'Unblob（Linux）', 'file'],
  ['REA_SIGROK_COMMAND', 'sigrok-cli（Linux）', 'file'],
  ['REA_OBJDUMP_COMMAND', 'GNU objdump', 'file'],
  ['REA_GDB_COMMAND', 'GDB', 'file'],
  ['REA_RIZIN_COMMAND', 'Rizin', 'file'],
  ['REA_WAKARU_COMMAND', 'Wakaru 启动程序（Linux）', 'file']
] as const
function obj(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {}
}
export function EngineSettings(): React.JSX.Element {
  const { t, language } = usePreferences(),
    [settings, setSettings] = useState<Settings>({ provider: 'auto', environment: {} }),
    [status, setStatus] = useState<EngineStatus | null>(null),
    [working, setWorking] = useState(false),
    [checking, setChecking] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false),
    [key, setKey] = useState('')
  useEffect(() => {
    void window.rea
      .getEngineSettings()
      .then(setSettings)
      .catch((error) => setError(String(error)))
  }, [])
  const update = (name: string, value: string): void => {
    setSettings((s) => ({ ...s, environment: { ...s.environment, [name]: value } }))
    setSaved(false)
  }
  const save = async (check = false): Promise<void> => {
    setWorking(true)
    setError('')
    try {
      await window.rea.saveEngineSettings({
        ...settings,
        environment: Object.fromEntries(
          Object.entries(settings.environment).filter(([, v]) => v.trim())
        )
      })
      setSaved(true)
      if (check) {
        setChecking(true)
        setStatus(await window.rea.getEngineStatus())
      }
    } catch (error) {
      setError(String(error))
    } finally {
      setChecking(false)
      setWorking(false)
    }
  }
  return (
    <div className="engine-settings">
      <div className="settings-intro">
        <h3>{t('配置本机分析工具')}</h3>
        <p>{t('REA 和 Node 已内置。按目标配置外部引擎，保存后会在下次操作生效。')}</p>
      </div>
      <label className="form-field">
        {t('原生分析引擎')}
        <select
          value={settings.provider}
          onChange={(event) => {
            setSettings({ ...settings, provider: event.target.value })
            setSaved(false)
          }}
        >
          {['auto', 'ghidra', 'hopper', 'ida', 'kuna'].map((id) => (
            <option key={id} value={id}>
              {id === 'auto' ? t('自动选择') : id}
            </option>
          ))}
        </select>
      </label>
      <div className="engine-environment">
        {VARIABLES.map(([name, label, kind]) => (
          <label key={name} className="form-field">
            <span>
              {language === 'zh' ? label : name}
              <code>{name}</code>
            </span>
            <div className="schema-input-row">
              <input
                value={settings.environment[name] || ''}
                onChange={(event) => update(name, event.target.value)}
                placeholder={
                  name === 'REA_JEB_MCP_URL'
                    ? 'http://127.0.0.1:8425/mcp'
                    : name === 'REA_GHIDRA_STARTUP_TIMEOUT_MS'
                      ? '600000'
                      : ''
                }
              />
              {kind !== 'value' && (
                <button
                  className="icon-button"
                  title={t('选择路径')}
                  onClick={() =>
                    void window.rea.pickPath(kind).then((path) => path && update(name, path))
                  }
                >
                  <FolderOpen size={16} />
                </button>
              )}
            </div>
          </label>
        ))}
      </div>
      <details>
        <summary>{t('自定义 REA 服务（可选）')}</summary>
        <p className="small muted">
          {t(
            '留空使用内置 REA。可连接源码构建的 MCP，或通过 ssh 连接 Linux 上的 REA，以使用受宿主限制的工具。路径按服务端解释。'
          )}
        </p>
        <label className="form-field">
          {t('启动命令')}
          <input
            placeholder="/usr/bin/ssh"
            value={settings.command || ''}
            onChange={(event) => {
              setSettings({ ...settings, command: event.target.value || undefined })
              setSaved(false)
            }}
          />
        </label>
        <label className="form-field">
          {t('启动参数（每行一项）')}
          <textarea
            rows={4}
            placeholder={'user@linux-host\nnode\n/opt/rea/scripts/rea.mjs\nmcp'}
            value={(settings.arguments || []).join('\n')}
            onChange={(event) => {
              setSettings({ ...settings, arguments: event.target.value.split('\n') })
              setSaved(false)
            }}
          />
        </label>
      </details>
      <details>
        <summary>{t('更多 REA 环境变量')}</summary>
        {Object.entries(settings.environment)
          .filter(([name]) => !VARIABLES.some(([key]) => key === name))
          .map(([name, value]) => (
            <label className="form-field" key={name}>
              {name}
              <div className="schema-input-row">
                <input value={value} onChange={(event) => update(name, event.target.value)} />
                <button
                  className="icon-button"
                  aria-label={t('移除')}
                  onClick={() => {
                    const environment = { ...settings.environment }
                    delete environment[name]
                    setSettings({ ...settings, environment })
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </label>
          ))}
        <div className="schema-input-row">
          <input
            aria-label="Environment variable name"
            placeholder="REA_…"
            value={key}
            onChange={(event) => setKey(event.target.value)}
          />
          <button
            className="button secondary"
            disabled={!/^[A-Z][A-Z0-9_]*$/.test(key)}
            onClick={() => {
              update(key, '')
              setKey('')
            }}
          >
            <Plus size={14} />
            {t('添加')}
          </button>
        </div>
      </details>
      <div className="tool-run-row">
        <button disabled={working} className="button primary" onClick={() => void save(true)}>
          {working ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}{' '}
          {t('保存并检查环境')}
        </button>
        <button disabled={working} className="button secondary" onClick={() => void save()}>
          {t('保存配置')}
        </button>
        {checking && (
          <button
            className="text-action"
            onClick={() =>
              void window.rea.cancelEngineStatus().catch((error) => setError(String(error)))
            }
          >
            {t('停止')}
          </button>
        )}
        {saved && (
          <span className="small muted">
            <CheckCircle2 size={14} />
            {t('已保存')}
          </span>
        )}
      </div>
      {error && <div className="form-result failure">{error}</div>}
      {status && (
        <div className="engine-diagnostics">
          <strong>
            REA {status.version} · {status.tools.length} {t('项能力')}
          </strong>
          <p className="path-label">{status.runtime}</p>
          <p className="path-label">{status.entrypoint}</p>
          {status.warning && <div className="form-result failure">{status.warning}</div>}
          {status.providers.map((item, i) => {
            const provider = obj(item.provider),
              availability = obj(item.availability)
            return (
              <details key={i} open>
                <summary>
                  {String(provider.name)} · {String(availability.status)}
                </summary>
                <p>{String(availability.reason || '')}</p>
                <pre>{JSON.stringify(availability.diagnostics, null, 2)}</pre>
              </details>
            )
          })}
          <p className="small muted">
            {t('工具依赖和宿主限制请在能力中心查看；有些操作需要先打开目标或连接设备。')}
          </p>
        </div>
      )}
    </div>
  )
}

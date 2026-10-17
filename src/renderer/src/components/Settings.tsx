import { useEffect, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  CircleHelp,
  Cpu,
  Download,
  LoaderCircle,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Trash2,
  X
} from 'lucide-react'
import type {
  CCSwitchCandidate,
  ModelProfile,
  ModelProtocol,
  ModelSettings,
  SettingsInput
} from '../../../shared/types'
import { modelEndpoint } from '../../../shared/model-endpoint'
import { MODEL_PROVIDERS, PROVIDER_GROUPS } from '../../../shared/model-providers'
import { localizeSystemText } from '../../../shared/locale'
import { usePreferences } from '../preferences-context'
import { EngineSettings } from './EngineSettings'
import { useDialog } from './useDialog'

type Tab = 'models' | 'cc' | 'engine'
export function Settings({
  settings,
  onClose,
  onSaved
}: {
  settings: ModelSettings
  onClose: () => void
  onSaved: (settings: ModelSettings) => void
}): React.JSX.Element {
  const { t, language } = usePreferences()
  const [tab, setTab] = useState<Tab>('models')
  const [configuration, setConfiguration] = useState(settings)
  const [id, setId] = useState(settings.id)
  const [name, setName] = useState(settings.name)
  const [protocol, setProtocol] = useState<ModelProtocol>(settings.protocol)
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl)
  const [model, setModel] = useState(settings.model)
  const [apiKey, setApiKey] = useState('')
  const [clearApiKey, setClearApiKey] = useState(false)
  const [modelPlaceholder, setModelPlaceholder] = useState('')
  const [working, setWorking] = useState<string | null>(null)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [candidates, setCandidates] = useState<CCSwitchCandidate[] | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const feedback = useRef<HTMLDivElement>(null)
  const dialog = useDialog(onClose, Boolean(working))
  const selected = configuration.profiles.find((item) => item.id === id)
  let endpoint = ''
  try {
    endpoint = modelEndpoint(baseUrl, protocol)
  } catch {
    /* 地址输入中。 */
  }
  useEffect(() => {
    if (result) feedback.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [result])

  const edit = (profile?: ModelProfile): void => {
    setId(profile?.id ?? '')
    setName(profile?.name ?? '')
    setProtocol(profile?.protocol ?? 'chat-completions')
    setBaseUrl(profile?.baseUrl ?? 'https://api.openai.com/v1')
    setModel(profile?.model ?? '')
    setApiKey('')
    setClearApiKey(false)
    setModelPlaceholder('')
    setResult(null)
    setConfirmDelete(false)
  }
  const perform = async (label: string, action: () => Promise<void>): Promise<void> => {
    setWorking(label)
    setResult(null)
    try {
      await action()
    } catch (error) {
      setResult({
        ok: false,
        message: (error instanceof Error ? error.message : String(error)).replace(
          /^Error invoking remote method '[^']+': (?:Error: )?/,
          ''
        )
      })
    } finally {
      setWorking(null)
    }
  }
  const input = (): SettingsInput => ({
    id: id || undefined,
    name,
    protocol,
    baseUrl,
    model,
    apiKey,
    clearApiKey
  })
  const update = (saved: ModelSettings): void => {
    setConfiguration(saved)
    edit(saved)
    onSaved(saved)
  }
  const selectTab = (value: Tab): void => {
    setTab(value)
    setResult(null)
    setConfirmDelete(false)
  }
  const applyProvider = (kind: string): void => {
    const provider = MODEL_PROVIDERS.find((item) => item.id === kind)
    if (!provider) return
    edit()
    setName(language === 'en' ? provider.nameEn : provider.name)
    setProtocol(provider.protocol)
    setBaseUrl(provider.baseUrl)
    if (provider.model) setModel(provider.model)
    if (provider.modelPlaceholder) setModelPlaceholder(provider.modelPlaceholder)
  }
  const tabs = [
    { id: 'models' as const, title: '模型配置', description: '添加和切换服务', icon: Settings2 },
    { id: 'cc' as const, title: 'CC Switch', description: '导入已有配置', icon: Download },
    { id: 'engine' as const, title: '分析引擎', description: '检查本机环境', icon: Cpu }
  ]
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !working) onClose()
      }}
    >
      <section
        ref={dialog}
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">REA DESKTOP</span>
            <h2 id="settings-title">{t('设置')}</h2>
          </div>
          <button
            className="icon-button"
            disabled={Boolean(working)}
            onClick={onClose}
            aria-label={t('关闭设置')}
          >
            <X size={20} />
          </button>
        </div>
        <div className="settings-layout">
          <nav
            className="settings-nav"
            role="tablist"
            onKeyDown={(event) => {
              if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
              event.preventDefault()
              const index = tabs.findIndex((item) => item.id === tab)
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? tabs.length - 1
                    : (index + (event.key === 'ArrowDown' ? 1 : -1) + tabs.length) % tabs.length
              selectTab(tabs[next].id)
              document.getElementById(`tab-${tabs[next].id}`)?.focus()
            }}
            aria-orientation="vertical"
            aria-label={t('设置分类')}
          >
            {tabs.map((item) => (
              <button
                key={item.id}
                role="tab"
                tabIndex={tab === item.id ? 0 : -1}
                id={`tab-${item.id}`}
                aria-controls={`panel-${item.id}`}
                aria-selected={tab === item.id}
                disabled={Boolean(working)}
                className={tab === item.id ? 'selected' : ''}
                onClick={() => selectTab(item.id)}
              >
                <item.icon size={18} />
                <span>
                  <strong>{t(item.title)}</strong>
                  <small>{t(item.description)}</small>
                </span>
              </button>
            ))}
            <div className="settings-nav-note">
              <ShieldCheck size={16} />
              <span>{t('密钥加密保存在本机')}</span>
            </div>
          </nav>
          <div
            className="settings-content"
            role="tabpanel"
            id={`panel-${tab}`}
            aria-labelledby={`tab-${tab}`}
          >
            {tab === 'models' && (
              <>
                <div className="settings-intro">
                  <h3>{t('连接你熟悉的模型')}</h3>
                  <p>{t('可保存多套配置，下一次提问使用当前启用的服务。')}</p>
                </div>
                {!configuration.profiles.length && (
                  <button className="import-shortcut" onClick={() => selectTab('cc')}>
                    <Download size={19} />
                    <span>
                      <strong>{t('已经在用 CC Switch？')}</strong>
                      <small>{t('直接导入，不用重新填写地址和密钥。')}</small>
                    </span>
                    <ArrowUpRight size={17} />
                  </button>
                )}
                <div className="profile-toolbar">
                  <label className="form-field">
                    {t('已保存配置')}
                    <select
                      value={id}
                      disabled={Boolean(working)}
                      onChange={(event) =>
                        edit(configuration.profiles.find((item) => item.id === event.target.value))
                      }
                    >
                      <option value="">{t('新建配置')}</option>
                      {configuration.profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.id === configuration.id ? '● ' : ''}
                          {profile.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="button secondary"
                    disabled={Boolean(working)}
                    onClick={() => edit()}
                  >
                    <Plus size={15} />
                    {t('新建')}
                  </button>
                  {id && (
                    <button
                      className="button secondary"
                      disabled={Boolean(working) || id === configuration.id}
                      onClick={() =>
                        void perform('activate', async () => {
                          update(await window.rea.activateModel(id))
                          setResult({ ok: true, message: '配置已启用。' })
                        })
                      }
                    >
                      {id === configuration.id ? <Check size={15} /> : null}
                      {t(id === configuration.id ? '已启用' : '启用')}
                    </button>
                  )}
                  {id && (
                    <button
                      className="icon-button danger"
                      aria-label={t('删除配置')}
                      title={t('删除配置')}
                      disabled={Boolean(working)}
                      onClick={() => setConfirmDelete(!confirmDelete)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                {confirmDelete && (
                  <div className="delete-confirm" role="alert">
                    <span>{t('删除此配置？已保存的分析不会受到影响。')}</span>
                    <button className="text-action" onClick={() => setConfirmDelete(false)}>
                      {t('取消')}
                    </button>
                    <button
                      className="button danger"
                      onClick={() =>
                        void perform('delete', async () => update(await window.rea.deleteModel(id)))
                      }
                    >
                      {t('确认删除')}
                    </button>
                  </div>
                )}
                <label className="form-field provider-picker">
                  {t('快速填写')}
                  <select
                    value=""
                    disabled={Boolean(working)}
                    onChange={(event) => applyProvider(event.target.value)}
                  >
                    <option value="">{t('选择服务商自动填写')}</option>
                    {PROVIDER_GROUPS.map((group) => (
                      <optgroup
                        key={group.id}
                        label={language === 'en' ? group.labelEn : group.label}
                      >
                        {MODEL_PROVIDERS.filter((item) => item.group === group.id).map((item) => (
                          <option key={item.id} value={item.id}>
                            {language === 'en' ? item.nameEn : item.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <form
                  id="model-form"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void perform('save', async () => {
                      update(await window.rea.saveSettings(input()))
                      setResult({ ok: true, message: '配置已保存并启用。' })
                    })
                  }}
                >
                  <fieldset disabled={Boolean(working)}>
                    <div className="form-grid">
                      <label className="form-field">
                        {t('配置名称')}
                        <input
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          placeholder={t('例如：我的 DeepSeek')}
                          maxLength={100}
                        />
                      </label>
                      <label className="form-field">
                        {t('接口协议')}
                        <select
                          value={protocol}
                          onChange={(event) => {
                            setProtocol(event.target.value as ModelProtocol)
                            setResult(null)
                          }}
                        >
                          <option value="chat-completions">OpenAI Chat Completions</option>
                          <option value="responses">OpenAI Responses</option>
                          <option value="anthropic">Anthropic Messages</option>
                        </select>
                      </label>
                    </div>
                    <label className="form-field">
                      {t('服务地址')}
                      <input
                        type="url"
                        required
                        value={baseUrl}
                        onChange={(event) => {
                          setBaseUrl(event.target.value)
                          setResult(null)
                        }}
                        placeholder="https://api.example.com/v1"
                      />
                      <span>
                        {t('使用服务商提供的地址；普通 API 和 Coding Plan 地址可能不同。')}
                      </span>
                    </label>
                    <label className="form-field">
                      {t('模型名称')}
                      <input
                        required
                        value={model}
                        onChange={(event) => {
                          setModel(event.target.value)
                          setResult(null)
                        }}
                        placeholder={modelPlaceholder || t('填写服务商提供的模型 ID')}
                      />
                      <span>{t('火山普通 API 可使用 Endpoint ID（ep-…）。')}</span>
                    </label>
                    <label className="form-field">
                      API Key <small>{t('本地服务可留空')}</small>
                      <input
                        type="password"
                        autoComplete="off"
                        value={apiKey}
                        onChange={(event) => {
                          setApiKey(event.target.value)
                          setClearApiKey(false)
                          setResult(null)
                        }}
                        placeholder={t(
                          selected?.hasApiKey && !clearApiKey
                            ? '已安全保存，留空保留此密钥'
                            : '输入 API Key'
                        )}
                      />
                    </label>
                    {selected?.hasApiKey && (
                      <label className="check-field">
                        <input
                          type="checkbox"
                          checked={clearApiKey}
                          onChange={(event) => {
                            setClearApiKey(event.target.checked)
                            setApiKey('')
                          }}
                        />
                        {t('移除此配置的密钥')}
                      </label>
                    )}
                  </fieldset>
                </form>
                <details className="connection-details">
                  <summary>
                    <CircleHelp size={14} />
                    {t('接口详情与隐私')}
                  </summary>
                  <code>{endpoint || t('请输入有效的服务地址')}</code>
                  <p>
                    {t(
                      '文件在本机分析。问题和选取的证据发送到模型服务，密钥不会传入界面。不同服务商建议使用独立配置。'
                    )}
                  </p>
                </details>
              </>
            )}
            {tab === 'cc' && (
              <>
                <div className="settings-intro">
                  <h3>{t('复用 CC Switch 配置')}</h3>
                  <p>{t('读取本机配置并导入到 REA，原有 CC Switch 设置保持不变。')}</p>
                </div>
                <div className="cc-toolbar">
                  <span className="small muted">
                    {t('支持 Claude、Codex、OpenCode 和 Pi 的 API Key 配置')}
                  </span>
                  <button
                    className="button secondary"
                    disabled={Boolean(working)}
                    onClick={() =>
                      void perform('scan', async () =>
                        setCandidates(await window.rea.listCCSwitch())
                      )
                    }
                  >
                    {working === 'scan' ? (
                      <LoaderCircle size={15} className="spin" />
                    ) : (
                      <RefreshCw size={15} />
                    )}
                    {t(candidates ? '重新读取' : '读取配置')}
                  </button>
                </div>
                {candidates === null ? (
                  <div className="settings-empty">
                    <Download size={34} />
                    <strong>{t('把已有模型带到 REA')}</strong>
                    <p>{t('点击“读取配置”，选择要导入的服务。密钥将加密保存，之后可独立切换。')}</p>
                  </div>
                ) : (
                  <div className="cc-candidates">
                    {!candidates.length && (
                      <p className="muted">{t('没有找到可识别的服务配置。')}</p>
                    )}
                    {candidates.map((item) => (
                      <div className="cc-candidate" key={item.id}>
                        <span className="provider-icon">
                          <Settings2 size={18} />
                        </span>
                        <div>
                          <strong>
                            {item.name}
                            {item.current && <span className="tag">{t('当前')}</span>}
                          </strong>
                          <small>
                            {item.model || t('未指定模型')} · {item.protocol}
                          </small>
                          <small>
                            {item.available
                              ? item.baseUrl
                              : localizeSystemText(item.reason || '无法导入此配置', language)}
                          </small>
                        </div>
                        <button
                          className="button secondary"
                          disabled={Boolean(working) || !item.available}
                          onClick={() =>
                            void perform('import', async () => {
                              update(await window.rea.importCCSwitch(item.id))
                              setResult({
                                ok: true,
                                message: '已导入并启用，可在模型配置中检查连接。'
                              })
                            })
                          }
                        >
                          {working === 'import' ? (
                            <LoaderCircle size={14} className="spin" />
                          ) : (
                            <Download size={14} />
                          )}
                          {t('导入')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="inline-note">
                  <CircleHelp size={17} />
                  <p>
                    {t(
                      '官方订阅登录（OAuth）无法作为 API Key 导入。CC Switch 配置更新后，重新导入即可同步。'
                    )}
                  </p>
                </div>
              </>
            )}
            {tab === 'engine' && <EngineSettings />}
            {working === 'check' && (
              <div className="form-result" role="status">
                <LoaderCircle size={16} className="spin" />
                {t('正在验证模型连接和工具调用，可能需要一点时间…')}
              </div>
            )}
            {result && (
              <div
                ref={feedback}
                className={`form-result ${result.ok ? 'success' : 'failure'}`}
                role="status"
              >
                {result.ok ? <CheckCircle2 size={18} /> : <CircleHelp size={18} />}
                <span>{localizeSystemText(result.message, language)}</span>
              </div>
            )}
          </div>
        </div>
        <div className="settings-footer">
          <span className="small muted">
            {configuration.name
              ? t('当前服务：{name}', { name: configuration.name })
              : t('未配置模型，也可先做本地分析')}
          </span>
          <div>
            {tab === 'models' ? (
              <>
                <button
                  className="button secondary"
                  disabled={Boolean(working) || !baseUrl.trim() || !model.trim()}
                  onClick={() =>
                    void perform('check', async () => {
                      const message = await window.rea.checkModel(input())
                      setResult({ ok: true, message })
                    })
                  }
                >
                  {working === 'check' && <LoaderCircle size={15} className="spin" />}
                  {t('检查连接')}
                </button>
                <button
                  type="submit"
                  form="model-form"
                  className="button primary"
                  disabled={Boolean(working)}
                >
                  {working === 'save' ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <Check size={15} />
                  )}
                  {t('保存并启用')}
                </button>
              </>
            ) : (
              <button className="button secondary" onClick={onClose} disabled={Boolean(working)}>
                {t('完成')}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

import { useState } from 'react'
import { Plus, X, FolderOpen } from 'lucide-react'
import type { JsonObject } from '../../../shared/types'
import { resolveSchema, variants, matches, initialValue, variantLabel } from '../schema'
import { usePreferences } from '../preferences-context'

function obj(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {}
}
const FIELD_LABELS: Record<string, string> = {
  path: '文件路径',
  input_path: '输入路径',
  capture_path: '捕获文件',
  procedure: '函数名或地址',
  provider_id: '分析引擎',
  detail: '返回详细程度',
  source: '分析来源',
  view: '查看内容',
  kind: '类型',
  evidence_id: '证据 ID',
  cdp_endpoint: '浏览器 CDP 地址',
  target_id: '页面 ID',
  class_name: '完整类名',
  method_name: '方法名',
  query: '查询内容',
  pattern: '搜索内容',
  offset: '起始位置',
  limit: '每页数量',
  output_directory: '输出目录',
  output_path: '输出路径',
  serial: '设备序列号',
  steps: '操作步骤',
  application: '应用分析来源',
  format: '文件格式',
  document: '引擎文档',
  seed: '追踪起点'
}

function RawValue({
  value,
  onChange
}: {
  value: unknown
  onChange: (value: unknown) => void
}): React.JSX.Element {
  const [text, setText] = useState(JSON.stringify(value ?? {}, null, 2)),
    [error, setError] = useState('')
  return (
    <div>
      <textarea
        className="schema-json"
        rows={5}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          try {
            onChange(JSON.parse(event.target.value))
            setError('')
            event.target.setCustomValidity('')
          } catch {
            setError('JSON 格式无效 / Invalid JSON')
            event.target.setCustomValidity('Invalid JSON')
          }
        }}
      />
      {error && <small className="error-text">{error}</small>}
    </div>
  )
}

export function SchemaForm({
  schema,
  root = schema,
  value,
  onChange,
  name = '',
  required = true,
  depth = 0,
  evidenceIds = []
}: {
  schema: JsonObject
  root?: JsonObject
  value: unknown
  onChange: (value: unknown) => void
  name?: string
  required?: boolean
  depth?: number
  evidenceIds?: string[]
}): React.JSX.Element {
  const { language, t } = usePreferences()
  const s = resolveSchema(schema, root),
    choices = variants(s, root)
  const index = Math.max(
    0,
    choices.findIndex((choice) => matches(choice, value, root))
  )
  const label =
    language === 'zh' ? FIELD_LABELS[name] || name.replaceAll('_', ' ') : name.replaceAll('_', ' ')
  if (depth > 14) return <RawValue value={value} onChange={onChange} />
  if (!required && value === undefined)
    return (
      <button type="button" className="schema-add" onClick={() => onChange(initialValue(s, root))}>
        <Plus size={13} />
        {label} <code>{name}</code>
      </button>
    )
  const content = choices.length ? (
    <div className="schema-union">
      <select
        aria-label={`${label} type`}
        value={index}
        onChange={(event) => onChange(initialValue(choices[Number(event.target.value)], root))}
      >
        {choices.map((choice, i) => (
          <option key={i} value={i}>
            {variantLabel(choice)}
          </option>
        ))}
      </select>
      <SchemaForm
        key={index}
        schema={choices[index]}
        root={root}
        value={value}
        onChange={onChange}
        depth={depth + 1}
        evidenceIds={evidenceIds}
      />
    </div>
  ) : 'const' in s ? (
    <code className="schema-constant">{String(s.const)}</code>
  ) : s.type === 'null' ? (
    <code>null</code>
  ) : s.type === 'object' || s.properties ? (
    <div className="schema-object">
      {Object.keys(obj(s.properties)).length ? (
        <>
          {Object.entries(obj(s.properties)).map(([key, child]) => (
            <SchemaForm
              key={key}
              schema={obj(child)}
              root={root}
              value={obj(value)[key]}
              onChange={(item) => {
                const next = { ...obj(value) }
                if (item === undefined) delete next[key]
                else next[key] = item
                onChange(next)
              }}
              name={key}
              required={Array.isArray(s.required) && s.required.includes(key)}
              depth={depth + 1}
              evidenceIds={evidenceIds}
            />
          ))}
          {s.additionalProperties !== false && (
            <details>
              <summary>{t('其他参数')}</summary>
              <RawValue value={value} onChange={onChange} />
            </details>
          )}
        </>
      ) : (
        <RawValue value={value} onChange={onChange} />
      )}
    </div>
  ) : s.type === 'array' || s.items || s.prefixItems ? (
    <div className="schema-array">
      {(Array.isArray(value) ? value : []).map((item, i) => (
        <div className="schema-array-item" key={i}>
          <span>{i + 1}</span>
          <SchemaForm
            schema={obj(Array.isArray(s.prefixItems) ? s.prefixItems[i] : s.items)}
            root={root}
            value={item}
            onChange={(next) => onChange((value as unknown[]).map((v, j) => (i === j ? next : v)))}
            depth={depth + 1}
            evidenceIds={evidenceIds}
          />
          <button
            type="button"
            aria-label={t('移除')}
            className="icon-button"
            onClick={() => onChange((value as unknown[]).filter((_, j) => i !== j))}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="schema-add"
        disabled={
          typeof s.maxItems === 'number' && Array.isArray(value) && value.length >= s.maxItems
        }
        onClick={() => {
          const items = Array.isArray(value) ? value : []
          onChange([
            ...items,
            initialValue(
              obj(Array.isArray(s.prefixItems) ? s.prefixItems[items.length] : s.items),
              root
            )
          ])
        }}
      >
        <Plus size={13} />
        {t('添加一项')}
      </button>
    </div>
  ) : Array.isArray(s.enum) ? (
    <select
      required={required}
      value={String(value ?? '')}
      onChange={(event) =>
        onChange(
          s.enum instanceof Array
            ? s.enum.find((item) => String(item) === event.target.value)
            : event.target.value
        )
      }
    >
      {value === undefined && <option value="">—</option>}
      {s.enum.map((item, i) => (
        <option key={i} value={String(item)}>
          {String(item)}
        </option>
      ))}
    </select>
  ) : s.type === 'boolean' ? (
    <input
      type="checkbox"
      checked={value === true}
      onChange={(event) => onChange(event.target.checked)}
    />
  ) : s.type === 'number' || s.type === 'integer' ? (
    <input
      type="number"
      required={required}
      step={s.type === 'integer' ? 1 : 'any'}
      min={typeof s.minimum === 'number' ? s.minimum : undefined}
      max={typeof s.maximum === 'number' ? s.maximum : undefined}
      value={typeof value === 'number' ? value : ''}
      onChange={(event) =>
        onChange(event.target.value === '' ? undefined : Number(event.target.value))
      }
    />
  ) : s.type === 'string' ? (
    <div className="schema-input-row">
      <input
        required={required}
        aria-label={name}
        value={String(value ?? '')}
        list={/evidence_id/.test(name) ? 'schema-evidence-ids' : undefined}
        minLength={typeof s.minLength === 'number' ? s.minLength : undefined}
        maxLength={typeof s.maxLength === 'number' ? s.maxLength : undefined}
        placeholder={typeof s.description === 'string' ? s.description : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {/path|directory|file$/.test(name) && !/logical|module|relative|selector/.test(name) && (
        <>
          <button
            type="button"
            className="icon-button"
            title={t('选择文件')}
            onClick={() => {
              void window.rea.pickPath('file').then((path) => path && onChange(path))
            }}
          >
            <FolderOpen size={15} />
          </button>
          <button
            type="button"
            className="text-action"
            onClick={() => {
              void window.rea.pickPath('directory').then((path) => path && onChange(path))
            }}
          >
            {t('目录')}
          </button>
          {/output|snapshot|destination/.test(name) && (
            <button
              type="button"
              className="text-action"
              onClick={() => {
                void window.rea.pickPath('save').then((path) => path && onChange(path))
              }}
            >
              {t('另存为')}
            </button>
          )}
        </>
      )}
    </div>
  ) : (
    <RawValue value={value} onChange={onChange} />
  )
  return (
    <div className={`schema-field ${name ? '' : 'schema-root'}`}>
      {name && (
        <div className="schema-label">
          <span>
            {label} {required && <b>*</b>}
            <code>{name}</code>
          </span>
          {!required && (
            <button
              type="button"
              className="icon-button"
              title={t('移除参数')}
              onClick={() => onChange(undefined)}
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}
      {content}
      {name && typeof s.description === 'string' && (
        <small className="schema-description">{s.description}</small>
      )}
      {depth === 0 && (
        <datalist id="schema-evidence-ids">
          {evidenceIds.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
      )}
    </div>
  )
}

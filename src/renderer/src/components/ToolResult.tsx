import { useState } from 'react'
import { FolderOpen, Image as ImageIcon } from 'lucide-react'
import type { JsonObject } from '../../../shared/types'
import { usePreferences } from '../preferences-context'
function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {}
}
function compact(value: unknown): string {
  if (value === null) return 'null'
  return typeof value === 'object' ? JSON.stringify(value).slice(0, 180) : String(value)
}
export function ToolResult({ result }: { result: JsonObject }): React.JSX.Element {
  const { t } = usePreferences(),
    [images, setImages] = useState<Record<string, string>>({}),
    [error, setError] = useState('')
  const normalized = result.normalized_result ?? result.result ?? result
  const rows = Array.isArray(normalized) ? normalized : undefined
  const facts = object(normalized)
  const paths = new Set<string>()
  const artifacts: JsonObject[] = []
  const visit = (value: unknown, key: string, depth = 0): void => {
    if (depth > 10 || paths.size > 16) return
    const artifact = object(value)
    if (
      typeof artifact.data_base64 === 'string' &&
      typeof artifact.media_type === 'string' &&
      artifacts.length < 12
    )
      artifacts.push(artifact)
    if (
      typeof value === 'string' &&
      /path|directory|file/.test(key) &&
      /^(?:\/|[A-Za-z]:[\\/])/.test(value)
    )
      paths.add(value)
    else if (Array.isArray(value)) value.slice(0, 30).forEach((v) => visit(v, key, depth + 1))
    else if (value && typeof value === 'object')
      Object.entries(value).forEach(([k, v]) => visit(v, k, depth + 1))
  }
  visit(normalized, '')
  const table = (items: unknown[]): React.JSX.Element => {
    const columns = [
      ...new Set(items.slice(0, 10).flatMap((item) => Object.keys(object(item))))
    ].slice(0, 5)
    return columns.length ? (
      <div className="tool-table">
        <table>
          <thead>
            <tr>
              {columns.map((key) => (
                <th key={key}>{key.replaceAll('_', ' ')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 30).map((item, i) => (
              <tr key={i}>
                {columns.map((key) => (
                  <td key={key}>{compact(object(item)[key] ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {items.length > 30 && <small>{t('仅预览前 30 项，完整结果可导出。')}</small>}
      </div>
    ) : (
      <pre>{items.slice(0, 30).map(compact).join('\n')}</pre>
    )
  }
  return (
    <div className="tool-result-view">
      {typeof normalized === 'string' ? (
        <pre>{normalized.slice(0, 150000)}</pre>
      ) : rows ? (
        table(rows)
      ) : (
        <>
          <div className="tool-facts">
            {Object.entries(facts)
              .filter(
                ([key, value]) =>
                  typeof value !== 'object' && !['desktop_saved_record'].includes(key)
              )
              .slice(0, 20)
              .map(([key, value]) => (
                <div key={key}>
                  <small>{key.replaceAll('_', ' ')}</small>
                  <strong>{compact(value)}</strong>
                </div>
              ))}
          </div>
          {Object.entries(facts)
            .filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value))
            .slice(0, 8)
            .map(([key, value]) => (
              <details key={key}>
                <summary>{key.replaceAll('_', ' ')}</summary>
                <pre>{JSON.stringify(value, null, 2).slice(0, 20000)}</pre>
              </details>
            ))}
          {Object.entries(facts)
            .filter(([, value]) => Array.isArray(value) && value.length)
            .slice(0, 8)
            .map(([key, value]) => (
              <details key={key} open={(value as unknown[]).length <= 6}>
                <summary>
                  {key.replaceAll('_', ' ')} · {(value as unknown[]).length}
                </summary>
                {table(value as unknown[])}
              </details>
            ))}
        </>
      )}
      {artifacts.map((artifact, index) => {
        const mime = String(artifact.media_type)
        const extension =
          (
            {
              'image/png': 'png',
              'image/jpeg': 'jpg',
              'image/webp': 'webp',
              'image/gif': 'gif',
              'text/javascript': 'js',
              'text/plain': 'txt'
            } as Record<string, string>
          )[mime] || 'bin'
        return (
          <div className="tool-embedded-artifact" key={index}>
            {/^image\/(png|jpeg|webp|gif)$/.test(mime) && (
              <img src={`data:${mime};base64,${artifact.data_base64}`} alt={t('捕获的图片')} />
            )}
            <span className="small muted">
              {mime} · {String(artifact.bytes ?? '')} B
            </span>
            <button
              className="button secondary"
              onClick={() =>
                void window.rea
                  .saveToolArtifact({
                    dataBase64: String(artifact.data_base64),
                    mediaType: mime,
                    name: `rea-artifact-${index + 1}.${extension}`
                  })
                  .catch((error) => setError(String(error)))
              }
            >
              {t('保存文件')}
            </button>
          </div>
        )
      })}
      {paths.size > 0 && (
        <div className="tool-output-files">
          <h5>{t('相关文件与输出')}</h5>
          {[...paths].map((path) => (
            <div key={path}>
              <code>{path}</code>
              <button
                className="text-action"
                onClick={() =>
                  void window.rea.revealPath(path).catch((error) => setError(String(error)))
                }
              >
                <FolderOpen size={13} />
                {t('定位文件')}
              </button>
              {/\.(png|jpe?g|webp|gif)$/i.test(path) && (
                <button
                  className="text-action"
                  onClick={() =>
                    void window.rea
                      .previewImage(path)
                      .then((url) => setImages({ ...images, [path]: url }))
                      .catch((error) => setError(String(error)))
                  }
                >
                  <ImageIcon size={13} />
                  {t('预览图片')}
                </button>
              )}
              {images[path] && <img src={images[path]} alt={path} />}
            </div>
          ))}
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
      <details className="tool-raw-result">
        <summary>{t('完整原始响应（JSON）')}</summary>
        <pre>{JSON.stringify(result, null, 2).slice(0, 150000)}</pre>
        {JSON.stringify(result).length > 150000 && <p>{t('预览已截断，导出可查看完整结果。')}</p>}
      </details>
    </div>
  )
}

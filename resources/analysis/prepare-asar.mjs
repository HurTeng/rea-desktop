/* eslint-disable @typescript-eslint/explicit-function-return-type */
// 在独立 Node 内读取归档，避免 Electron 的 ASAR 虚拟文件系统改变 fs 行为。
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
const [root, archive, output, companion] = process.argv.slice(2)
const asar = createRequire(path.join(root, 'package.json'))('@electron/asar')
const entries = asar.listPackage(archive).map((name) => {
  const relative = name.replace(/^[/\\]+/, '').replaceAll('\\', '/')
  if (relative.split('/').some((part) => part === '..') || path.isAbsolute(relative))
    throw new Error('归档内包含无效路径')
  const info = asar.statFile(archive, relative, false)
  return {
    path: relative,
    size: info.size || 0,
    directory: Boolean(info.files),
    link: Boolean(info.link),
    unpacked: Boolean(info.unpacked),
    sha256: info.integrity?.hash
  }
})
const files = entries.filter((entry) => !entry.directory && !entry.link)
const missing = []
const integrityMismatches = []
const selected = []
let totalBytes = 0
const source = path.join(output, 'source')
fs.rmSync(source, { recursive: true, force: true })
fs.mkdirSync(source, { recursive: true })
function read(entry) {
  if (!entry.unpacked) return asar.extractFile(archive, entry.path)
  const base = companion || `${archive}.unpacked`
  const filename = path.join(base, entry.path)
  const canonicalBase = fs.realpathSync(base)
  const canonical = fs.realpathSync(filename)
  if (!canonical.startsWith(canonicalBase + path.sep) || !fs.statSync(canonical).isFile())
    throw new Error('补充目录中存在无效文件路径')
  return fs.readFileSync(canonical)
}
// 只展开架构入口；完整的文件名、大小、unpacked 与哈希仍保存在 inventory.json。
const appFiles = files.filter((entry) => !entry.path.split('/').includes('node_modules'))
const candidates = appFiles.filter(
  (entry) =>
    entry.path === 'package.json' ||
    (/\.(?:html|json)$/.test(entry.path) && !/\/(?:static|assets|locales)\//.test(entry.path)) ||
    (/\.(?:c?js|mjs)$/.test(entry.path) &&
      (/\/(?:main|preload)\//.test(entry.path) || /(?:preload|(?:^|\/)index[.-])/.test(entry.path)))
)
function priority(entry) {
  if (entry.path === 'package.json') return 0
  if (
    /(?:preload|\/main\/(?:main|load-jsc|server\.local|agent\.manager|worker\.runner|WorkerThread|ExecutionProcess)\.)/.test(
      entry.path
    )
  )
    return 1
  if (/\/renderer\/index\.html$/.test(entry.path)) return 1.5
  if (/\.html$/.test(entry.path)) return 2
  return 3
}
candidates.sort(
  (a, b) => priority(a) - priority(b) || a.size - b.size || a.path.localeCompare(b.path)
)
for (const entry of files.filter((entry) => entry.unpacked)) {
  if (!fs.existsSync(path.join(companion || `${archive}.unpacked`, entry.path)))
    missing.push(entry.path)
}
for (const entry of candidates) {
  if (
    selected.length >= 24 ||
    entry.size > 100_000 ||
    totalBytes + entry.size > 350_000 ||
    missing.includes(entry.path)
  )
    continue
  const bytes = read(entry)
  const hash = crypto.createHash('sha256').update(bytes).digest('hex')
  if (entry.sha256 && entry.sha256 !== hash) {
    integrityMismatches.push(entry.path)
    continue
  }
  const destination = path.join(source, entry.path)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(destination, bytes, { mode: 0o600 })
  selected.push({ path: entry.path, sha256: hash, bytes: bytes.length })
  totalBytes += bytes.length
}
let packageInfo = null
const pkg = selected.find((entry) => entry.path === 'package.json')
if (pkg) {
  const value = JSON.parse(fs.readFileSync(path.join(source, pkg.path), 'utf8'))
  packageInfo = {
    name: value.name,
    version: value.version,
    main: value.main,
    dependencies: value.dependencies,
    devDependencies: value.devDependencies
  }
}
const scope = {
  mode: 'architecture',
  sourcePath: archive,
  companionPath: companion || null,
  totalFiles: files.length,
  selectedFiles: selected.length,
  selectedBytes: totalBytes,
  selected,
  missingUnpackedCount: missing.length,
  missingUnpacked: missing.slice(0, 24),
  integrityMismatches,
  bytecode: appFiles.filter((entry) => /\.jsc$/.test(entry.path)).map((entry) => entry.path),
  entryPoints: appFiles
    .filter((entry) => /\.html$/.test(entry.path) || /dist\/main\//.test(entry.path))
    .map((entry) => entry.path)
    .slice(0, 80),
  topDirectories: [
    ...new Set(appFiles.map((entry) => entry.path.split('/').slice(0, 2).join('/')))
  ],
  packageInfo,
  limitations: [
    '架构快速分析仅解析选定的小型入口、preload、HTML 和清单；未解析的第三方依赖、大型 bundle 及字节码不属于本次 REA 语义覆盖范围。',
    ...(missing.length
      ? [`缺少 ${missing.length} 个 unpacked 文件；需要原应用配套的 app.asar.unpacked 目录。`]
      : []),
    ...(integrityMismatches.length
      ? ['补充目录中存在哈希不匹配文件，已跳过，可能来自不同版本。']
      : []),
    ...(appFiles.some((entry) => /\.jsc$/.test(entry.path))
      ? ['发现 V8 .jsc 字节码，当前 JavaScript 静态分析不能还原其中的实现。']
      : [])
  ]
}
fs.writeFileSync(
  path.join(output, 'inventory.json'),
  JSON.stringify({ archive, entries, missingUnpacked: missing }, null, 2),
  { mode: 0o600 }
)
fs.writeFileSync(path.join(output, 'scope.json'), JSON.stringify(scope, null, 2), { mode: 0o600 })
if (!selected.length)
  throw new Error('归档没有可读取的架构入口，请补充 unpacked 目录或选择完整分析。')
process.stdout.write(JSON.stringify({ source, scope }))

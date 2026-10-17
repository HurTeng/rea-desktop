/* eslint-disable @typescript-eslint/explicit-function-return-type */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import zlib from 'node:zlib'
import { createRequire } from 'node:module'

const [root, mode, source, output, companion] = process.argv.slice(2)
const files = [],
  limitations = [],
  skipped = []
let total = 0
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const safeName = (name) =>
  name
    .replace(/^[a-z]+:\/\/[^/]*\/?/i, '')
    .replaceAll('\\', '/')
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .map((part) =>
      part
        .replace(/:/g, '_')
        .split('')
        .map((char) => (char.charCodeAt(0) < 32 ? '_' : char))
        .join('')
    )
    .join('/') || 'source'
function write(name, bytes, representation, origin) {
  const relative = safeName(name)
  if (total + bytes.length > 1024 * 1024 * 1024 || files.length >= 50000)
    throw new Error('恢复输出超过 1 GiB 或 50000 文件预算。')
  const target = path.join(output, relative)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, bytes, { flag: 'wx', mode: 0o600 })
  total += bytes.length
  files.push({ path: relative, bytes: bytes.length, sha256: hash(bytes), representation, origin })
}
function sourceMap(bytes, label, depth = 0) {
  if (depth > 8) throw new Error('Source map 嵌套过深。')
  const map = JSON.parse(bytes.toString('utf8'))
  if (Array.isArray(map.sections))
    for (const [index, section] of map.sections.entries())
      if (section.map)
        sourceMap(Buffer.from(JSON.stringify(section.map)), `${label}/section-${index}`, depth + 1)
  for (const [index, name] of (Array.isArray(map.sources) ? map.sources : []).entries()) {
    const content = map.sourcesContent?.[index]
    if (typeof content !== 'string') {
      skipped.push({
        source: `${label}:${name}`,
        reason: 'sourcesContent is absent; no network fetch or invented source'
      })
      continue
    }
    write(
      `embedded/${hash(Buffer.from(label)).slice(0, 8)}/${index}-${safeName(String(name))}`,
      Buffer.from(content),
      'embedded-source',
      { map: label, source: name, sourceRoot: map.sourceRoot || null }
    )
  }
}
function recoverEmbeddedMaps(bytes, label) {
  if (/\.map$/i.test(label)) return sourceMap(bytes, label)
  const match = [...bytes.toString('utf8').matchAll(/sourceMappingURL=([^\s*]+)/g)].at(-1)
  if (!match || !/^data:application\/json(?:;|,)/i.test(match[1])) return
  const uri = match[1],
    separator = uri.indexOf(','),
    encoded = uri.slice(separator + 1)
  sourceMap(
    /;base64,/i.test(uri)
      ? Buffer.from(encoded, 'base64')
      : Buffer.from(decodeURIComponent(encoded)),
    `${label}.inline.map`
  )
}
fs.mkdirSync(output, { mode: 0o700 })
try {
  if (mode === 'pyinstaller') {
    const bytes = fs.readFileSync(source)
    const magic = Buffer.from([77, 69, 73, 12, 11, 10, 11, 14])
    const position = bytes.lastIndexOf(magic)
    if (position < 0 || position + 24 > bytes.length)
      throw new Error('没有发现 PyInstaller CArchive 标记。')
    const packageBytes = bytes.readUInt32BE(position + 8),
      tocOffset = bytes.readUInt32BE(position + 12),
      tocBytes = bytes.readUInt32BE(position + 16),
      pythonVersion = bytes.readUInt32BE(position + 20)
    const normalizedVersion =
      pythonVersion >= 100
        ? pythonVersion
        : Math.floor(pythonVersion / 10) * 100 + (pythonVersion % 10)
    const pythonVersionString = `${Math.floor(normalizedVersion / 100)}.${normalizedVersion % 100}`
    const modern =
      position + 88 <= bytes.length &&
      /^python\d/i.test(
        bytes
          .subarray(position + 24, position + 88)
          .toString()
          .split('\0')[0]
      )
    const start = position + (modern ? 88 : 24) - packageBytes
    if (start < 0 || tocOffset + tocBytes > packageBytes)
      throw new Error('PyInstaller 目录范围无效。')
    const entries = []
    for (let cursor = start + tocOffset, end = cursor + tocBytes; cursor < end;) {
      const length = bytes.readUInt32BE(cursor)
      if (length < 18 || cursor + length > end) throw new Error('PyInstaller TOC 记录无效。')
      const entry = {
        name: bytes
          .subarray(cursor + 18, cursor + length)
          .toString()
          .split('\0')[0],
        offset: bytes.readUInt32BE(cursor + 4),
        compressed: bytes.readUInt32BE(cursor + 8),
        size: bytes.readUInt32BE(cursor + 12),
        compression: bytes[cursor + 16],
        type: String.fromCharCode(bytes[cursor + 17])
      }
      if (entry.offset + entry.compressed > packageBytes)
        throw new Error('PyInstaller 文件范围无效。')
      entries.push(entry)
      cursor += length
    }
    const read = (entry) => {
      if (entry.size > 134217728) throw new Error('单个字节码文件超过 128 MiB。')
      const data = bytes.subarray(start + entry.offset, start + entry.offset + entry.compressed)
      const value = entry.compression
        ? zlib.inflateSync(data, { maxOutputLength: 134217728 })
        : data
      if (value.length !== entry.size) throw new Error('PyInstaller 文件长度不匹配。')
      return value
    }
    let pycMagic = null
    for (const entry of entries.filter((item) => item.type === 'z')) {
      const data = read(entry)
      if (data.subarray(0, 4).toString() === 'PYZ\0') pycMagic = data.subarray(4, 8)
      write(
        `bytecode/${safeName(entry.name).replace(/\.pyz$/i, '')}.pyz`,
        data,
        'python-bytecode-archive',
        {
          archive: source,
          entry: entry.name
        }
      )
    }
    for (const entry of entries.filter((item) => ['s', 'm', 'M'].includes(item.type))) {
      const data = read(entry)
      const header = pycMagic
        ? Buffer.concat([
            pycMagic,
            Buffer.alloc(normalizedVersion >= 307 ? 12 : normalizedVersion >= 303 ? 8 : 4)
          ])
        : null
      write(
        `bytecode/${safeName(entry.name)}${header ? '.pyc' : '.marshal'}`,
        header ? Buffer.concat([header, data]) : data,
        'python-bytecode',
        { archive: source, entry: entry.name, reconstructedHeader: Boolean(header) }
      )
    }
    write(
      'pyinstaller-index.json',
      Buffer.from(
        JSON.stringify(
          {
            source,
            sha256: hash(bytes),
            pythonVersion,
            pythonVersionString,
            packageBytes,
            entries
          },
          null,
          2
        )
      ),
      'archive-index',
      { archive: source }
    )
    limitations.push(
      `PyInstaller Python ${pythonVersionString} 字节码与 PYZ 已提取；这不是原始 Python 源码，也没有执行反编译出来的代码。`,
      'CArchive 可以提取打包内容；REA 的原生反编译只能解释加载器，不能据此声称还原 Python 业务源码。'
    )
  } else if (mode === 'asar') {
    const asar = createRequire(path.join(root, 'package.json'))('@electron/asar')
    for (const listed of asar.listPackage(source)) {
      const name = listed.replace(/^[/\\]+/, '')
      const entry = asar.statFile(source, name, false)
      if (
        entry.files ||
        entry.link ||
        !/\.(?:[cm]?js|jsx|tsx?|map|json|css|html|vue|svelte|py|qml)$/i.test(name)
      )
        continue
      if (entry.size > 67108864) {
        skipped.push({ source: name, reason: 'file exceeds 64 MiB' })
        continue
      }
      let bytes
      if (entry.unpacked) {
        const base = companion || `${source}.unpacked`
        const target = path.join(base, safeName(name))
        if (!fs.existsSync(target)) {
          skipped.push({ source: name, reason: 'unpacked companion missing' })
          continue
        }
        const canonical = fs.realpathSync(target),
          canonicalBase = fs.realpathSync(base)
        if (!canonical.startsWith(canonicalBase + path.sep))
          throw new Error('配套目录中的文件越界。')
        bytes = fs.readFileSync(canonical)
      } else bytes = asar.extractFile(source, name)
      if (entry.integrity?.algorithm === 'SHA256' && entry.integrity.hash !== hash(bytes)) {
        skipped.push({ source: name, reason: 'declared integrity mismatch' })
        continue
      }
      write(`shipped/${name}`, bytes, 'shipped-source', { archive: source, entry: name })
      try {
        recoverEmbeddedMaps(bytes, name)
      } catch (error) {
        limitations.push(`${name}: ${error.message}`)
      }
    }
    limitations.push(
      '随包脚本保留其发布时的压缩、混淆与变量名；只有 source map 中实际携带的 sourcesContent 才作为内嵌源码提取。'
    )
  } else if (mode === 'directory') {
    const walk = (directory, prefix = '') => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) {
          skipped.push({
            source: path.join(prefix, entry.name),
            reason: 'symbolic link not followed'
          })
          continue
        }
        const relative = path.join(prefix, entry.name),
          full = path.join(directory, entry.name)
        if (entry.isDirectory()) {
          if (!['.git', 'node_modules'].includes(entry.name)) walk(full, relative)
          continue
        }
        if (!/\.(?:[cm]?js|jsx|tsx?|map|json|css|html|vue|svelte|py|qml)$/i.test(entry.name))
          continue
        if (fs.statSync(full).size > 67108864) {
          skipped.push({ source: relative, reason: 'file exceeds 64 MiB' })
          continue
        }
        const bytes = fs.readFileSync(full)
        write(`shipped/${relative}`, bytes, 'shipped-source', { path: full })
        try {
          recoverEmbeddedMaps(bytes, relative)
        } catch (error) {
          limitations.push(`${relative}: ${error.message}`)
        }
      }
    }
    walk(source)
    limitations.push(
      '复制实际存在的源码、脚本和 source map；跳过符号链接、.git 与 node_modules；不恢复缺失的原始工程。'
    )
  } else {
    const bytes = fs.readFileSync(source)
    if (bytes.length > 67108864) throw new Error('源码输入超过 64 MiB。')
    write(`shipped/${path.basename(source)}`, bytes, 'shipped-source', { path: source })
    if (mode === 'source-map') sourceMap(bytes, path.basename(source))
    else {
      const text = bytes.toString('utf8'),
        match = [...text.matchAll(/sourceMappingURL=([^\s*]+)/g)].at(-1)
      if (match && /^data:application\/json(?:;|,)/i.test(match[1])) {
        recoverEmbeddedMaps(bytes, path.basename(source))
      } else if (match && !/^[a-z]+:/i.test(match[1])) {
        const mapPath = path.resolve(path.dirname(source), decodeURIComponent(match[1]))
        const base = fs.realpathSync(path.dirname(source))
        if (
          fs.existsSync(mapPath) &&
          fs.realpathSync(mapPath).startsWith(base + path.sep) &&
          fs.statSync(mapPath).size <= 67108864
        )
          sourceMap(fs.readFileSync(mapPath), path.basename(mapPath))
        else limitations.push('相邻 source map 缺失、过大或位于目标目录之外，未读取。')
      }
    }
    limitations.push(
      '仅提取实际发布的脚本和内嵌 source map 内容；不补造缺失源码、依赖、注释或工程配置。'
    )
  }
  if (!files.length) throw new Error('该目标没有可导出的源码或字节码文件。')
  const result = {
    directory: output,
    files,
    limitations,
    skipped,
    createdAt: new Date().toISOString()
  }
  fs.writeFileSync(path.join(output, 'recovery-manifest.json'), JSON.stringify(result, null, 2), {
    mode: 0o600
  })
  process.stdout.write(JSON.stringify(result))
} catch (error) {
  fs.rmSync(output, { recursive: true, force: true })
  throw error
}

import { promises as filesystem } from 'original-fs'
import { basename, extname, isAbsolute, join } from 'node:path'
import type { Target } from '../shared/types'
import type { TargetFormat, TargetFamily } from '../shared/formats'

const { access, realpath, stat, open, readFile } = filesystem

export async function resolveTarget(path: string): Promise<Target> {
  if (!isAbsolute(path)) throw new Error('请选择本地应用或分析文件。')
  const canonical = await realpath(path)
  const info = await stat(canonical)
  if (info.isDirectory()) {
    if (canonical.toLowerCase().endsWith('.hop'))
      return {
        path: canonical,
        inputPath: canonical,
        name: basename(canonical),
        format: 'hopper',
        family: 'native'
      }
    if (canonical.toLowerCase().endsWith('.app')) {
      for (const entry of ['app.asar', 'app']) {
        const inputPath = join(canonical, 'Contents', 'Resources', entry)
        try {
          await access(inputPath)
          return {
            path: canonical,
            inputPath,
            name: basename(canonical, '.app'),
            format: entry === 'app.asar' ? 'asar' : 'directory',
            family: 'javascript'
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
      }
      const plist = await readFile(join(canonical, 'Contents', 'Info.plist')).catch(() => null)
      if (!plist) throw new Error('应用目录缺少 Contents/Info.plist。')
      return {
        path: canonical,
        inputPath: canonical,
        name: basename(canonical, '.app'),
        format: 'directory',
        family: 'package',
        appleBundle: true
      }
    }
    return {
      path: canonical,
      inputPath: canonical,
      name: basename(canonical),
      format: 'directory',
      family: 'javascript'
    }
  }
  if (!info.isFile()) throw new Error('请选择常规文件或应用目录。')
  const file = await open(canonical, 'r')
  const header = Buffer.alloc(4096)
  try {
    await file.read(header, 0, header.length, 0)
  } finally {
    await file.close()
  }
  const extension = extname(canonical).toLowerCase()
  let format: TargetFormat = 'file'
  let family: TargetFamily = 'package'
  let managed = false
  if (header.subarray(0, 2).toString() === 'MZ') {
    format = 'dos-mz'
    family = 'native'
    const offset = header.readUInt32LE(0x3c)
    if (offset <= info.size - 256) {
      const handle = await open(canonical, 'r')
      const pe = Buffer.alloc(264)
      try {
        await handle.read(pe, 0, pe.length, offset)
      } finally {
        await handle.close()
      }
      if (pe.subarray(0, 4).equals(Buffer.from([80, 69, 0, 0]))) {
        format = 'pe'
        const dataDirectory = pe.readUInt16LE(24) === 0x20b ? 24 + 112 : 24 + 96
        managed = pe.readUInt32LE(dataDirectory + 14 * 8) !== 0
        if (managed) family = 'managed'
      }
    }
  } else if (extension === '.class' || extension === '.dex' || extension === '.jdb2') {
    format = extension === '.class' ? 'class' : extension === '.dex' ? 'dex' : 'jeb-project'
    family = 'android'
  } else if (header.subarray(0, 4).equals(Buffer.from([0x7f, 69, 76, 70]))) {
    format = header[16] === 4 ? 'core' : 'elf'
    family = format === 'core' ? 'firmware' : 'native'
  } else if (
    [
      'feedface',
      'feedfacf',
      'cefaedfe',
      'cffaedfe',
      'cafebabe',
      'bebafeca',
      'cafebabf',
      'bfbafeca'
    ].includes(header.subarray(0, 4).toString('hex'))
  ) {
    format = ['cafebabe', 'bebafeca', 'cafebabf', 'bfbafeca'].includes(
      header.subarray(0, 4).toString('hex')
    )
      ? 'mach-o-universal'
      : 'mach-o'
    family = 'native'
  } else if (header.subarray(0, 4).equals(Buffer.from([0, 97, 115, 109]))) {
    format = 'wasm'
    family = 'data'
  } else if (header.subarray(0, 16).toString() === 'SQLite format 3\0') {
    format = 'sqlite'
    family = 'data'
  } else {
    const extensions: Record<string, TargetFormat> = {
      '.asar': 'asar',
      '.js': 'javascript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'javascript',
      '.tsx': 'javascript',
      '.map': 'source-map',
      '.zip': 'zip',
      '.ipa': 'ipa',
      '.apk': 'apk',
      '.aab': 'zip',
      '.jar': 'zip',
      '.hap': 'hap',
      '.hsp': 'hsp',
      '.app': 'app-pack',
      '.msixbundle': 'msix',
      '.appxbundle': 'appx',
      '.msix': 'msix',
      '.appx': 'appx',
      '.dmg': 'dmg',
      '.pkg': 'pkg',
      '.plist': 'plist',
      '.har': 'har',
      '.saz': 'saz',
      '.qlog': 'qlog',
      '.hop': 'hopper',
      '.img': 'firmware',
      '.rom': 'firmware',
      '.fw': 'firmware',
      '.squashfs': 'firmware',
      '.mitm': 'mitmproxy',
      '.flow': 'mitmproxy',
      '.pcap': 'pcap',
      '.pcapng': 'pcap',
      '.com': 'dos-com',
      '.bin': 'firmware',
      '.hex': 'evm',
      '.core': 'core',
      '.dmp': 'core',
      '.vcd': 'signal',
      '.sr': 'signal'
    }
    format = extensions[extension] ?? (header.subarray(0, 2).toString() === 'PK' ? 'zip' : 'file')
    if (['asar', 'javascript', 'source-map'].includes(format)) family = 'javascript'
    else if (format === 'apk') family = 'android'
    else if (['har', 'mitmproxy', 'saz', 'qlog', 'pcap', 'signal'].includes(format))
      family = 'network'
    else if (['firmware', 'evm', 'core'].includes(format)) family = 'firmware'
    else if (['dos-com', 'hopper'].includes(format)) family = 'native'
  }
  if (
    ['d4c3b2a1', 'a1b2c3d4', '4d3cb2a1', 'a1b23c4d', '0a0d0d0a'].includes(
      header.subarray(0, 4).toString('hex')
    )
  ) {
    format = 'pcap'
    family = 'network'
  }
  let packaging: Target['packaging']
  if (format === 'pe' || format === 'elf' || format === 'mach-o') {
    const tail = Buffer.alloc(Math.min(info.size, 65536))
    const handle = await open(canonical, 'r')
    try {
      await handle.read(tail, 0, tail.length, info.size - tail.length)
    } finally {
      await handle.close()
    }
    const cookie = tail.lastIndexOf(Buffer.from([77, 69, 73, 12, 11, 10, 11, 14]))
    if (cookie >= 0 && cookie + 24 <= tail.length)
      packaging = { kind: 'pyinstaller', pythonVersion: tail.readUInt32BE(cookie + 20) }
  }
  if (format === 'har' && header.subarray(0, 2).toString() === 'PK') {
    format = 'zip'
    family = 'package'
  }
  return {
    path: canonical,
    inputPath: canonical,
    name: basename(canonical),
    format,
    family,
    managed,
    packaging,
    bytes: info.size
  }
}

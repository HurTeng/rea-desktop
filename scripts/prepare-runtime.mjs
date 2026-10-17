import { copyFile, mkdir, chmod, writeFile, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [major, minor] = process.versions.node.split('.').map(Number)
if (!((major === 24 && minor >= 15) || major >= 26)) {
  throw new Error('桌面端完整分析需要 Node 24.15+ 或 26+，请使用 .nvmrc 中的版本。')
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const destination = join(root, 'resources/runtime')
await mkdir(destination, { recursive: true })
const binary = join(destination, process.platform === 'win32' ? 'node.exe' : 'node')
// macOS caches code signatures by inode. Never overwrite an executable that
// existing REA processes may still map; replace it with a fresh inode instead.
const staging = `${binary}.${process.pid}.tmp`
try {
  await copyFile(process.execPath, staging)
  await chmod(staging, 0o755)
  await rename(staging, binary)
} finally {
  await rm(staging, { force: true })
}
const nodeRoot =
  process.platform === 'win32' ? dirname(process.execPath) : join(dirname(process.execPath), '..')
await copyFile(join(nodeRoot, 'LICENSE'), join(destination, 'NODE-LICENSE'))
await writeFile(
  join(destination, 'manifest.json'),
  JSON.stringify(
    { node: process.versions.node, platform: process.platform, arch: process.arch },
    null,
    2
  ) + '\n'
)
console.log(`已准备 Node ${process.versions.node} (${process.platform}/${process.arch})`)

const { prepareRea } = await import('./prepare-rea.mjs')
await prepareRea()
const { prepareToolCatalog } = await import('./prepare-tool-catalog.mjs')
await prepareToolCatalog(root)

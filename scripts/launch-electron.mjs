import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const cli = join(dirname(require.resolve('electron-vite/package.json')), 'bin/electron-vite.js')
const environment = { ...process.env }
// 开发工具可能继承这个标志，桌面窗口应按 Electron 模式启动。
delete environment.ELECTRON_RUN_AS_NODE
const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: environment
})
child.on('error', (error) => {
  console.error(error)
  process.exitCode = 1
})
child.on('exit', (code) => {
  process.exitCode = code ?? 0
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))

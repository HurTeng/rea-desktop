import { app } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, relative, isAbsolute } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { EvidencePreview, JsonObject, RecoveryResult, Task } from '../shared/types'
import { taskDirectory, writeJson } from './storage'
import { runtimePaths, object } from './rea'
import type { RecordTool } from './format-analysis'

export async function recoverCode(
  task: Task,
  record: RecordTool,
  signal: AbortSignal,
  procedure?: string
): Promise<RecoveryResult> {
  const directory = join(taskDirectory(task.id), 'recovered', randomUUID())
  const mode = task.target.packaging?.kind ?? task.target.format
  if (
    ['pyinstaller', 'asar', 'javascript', 'source-map', 'directory'].includes(mode) &&
    !task.target.appleBundle &&
    !procedure
  ) {
    const root = app.isPackaged
      ? join(process.resourcesPath, 'app.asar.unpacked')
      : app.getAppPath()
    const script = app.isPackaged
      ? join(process.resourcesPath, 'analysis', 'recover-artifact.mjs')
      : join(root, 'resources/analysis/recover-artifact.mjs')
    await mkdir(join(taskDirectory(task.id), 'recovered'), { recursive: true })
    const { stdout } = await promisify(execFile)(
      runtimePaths().command,
      [script, root, mode, task.target.inputPath, directory, task.target.companionPath || ''],
      { signal, maxBuffer: 32 * 1024 * 1024, timeout: 300_000 }
    )
    return JSON.parse(stdout) as RecoveryResult
  }
  let name: string, args: JsonObject, representation: string, limitations: string[]
  if (task.target.family === 'managed') {
    name = 'inspect_managed_members'
    args = { path: task.target.inputPath, detail: 'complete' }
    representation = 'managed-cil-and-metadata'
    limitations = [
      '导出的是实际 CIL 与元数据。C# 重构文件需由外部反编译器产生，再通过 REA 导入验证。'
    ]
  } else if (task.target.format === 'wasm') {
    name = 'inspect_wasm_artifact'
    args = { path: task.target.inputPath, detail: 'complete' }
    representation = 'wasm-wat'
    limitations = ['WAT 是 WebAssembly 文本表示，不是原始 C/C++/Rust 工程。']
  } else if (task.target.family === 'native') {
    if (!procedure) throw new Error('请先在函数列表选择函数，或输入函数名/地址。')
    name = 'procedure_pseudo_code'
    args = { procedure }
    representation = 'native-pseudocode'
    limitations = [
      '反编译伪代码由当前分析引擎生成，类型、变量名和控制流需要人工核实；不是原始源码。'
    ]
  } else
    throw new Error(
      '请在能力中心选择对应操作：Android 方法反编译、JEB 反编译、Wakaru 源码恢复、网页脚本导出或安装包提取；各操作会显示专用参数与输出路径。'
    )
  const result = await record(name, args, name, signal)
  await mkdir(directory, { recursive: true })
  const files: RecoveryResult['files'] = []
  const save = async (path: string, text: string, kind: string): Promise<void> => {
    await writeFile(join(directory, path), text, { mode: 0o600 })
    files.push({ path, bytes: Buffer.byteLength(text), representation: kind })
  }
  await save('rea-result.json', JSON.stringify(result, null, 2), 'rea-evidence')
  const value = result.normalized_result
  const code =
    representation === 'wasm-wat'
      ? object(object(value).wat).text
      : representation === 'native-pseudocode'
        ? typeof value === 'string'
          ? value
          : (object(value).pseudocode ?? object(value).code ?? object(value).value)
        : null
  if (typeof code === 'string' && code.trim()) {
    const filename = `${basename(procedure || task.target.name).replace(/[^\w.-]/g, '_')}.${representation === 'wasm-wat' ? 'wat' : 'c'}`
    await save(filename, code, representation)
  } else if (representation !== 'managed-cil-and-metadata') {
    limitations.push('该引擎未返回可用代码正文，只保留原始 REA 证据。')
  }
  const recovery: RecoveryResult = {
    directory,
    files,
    limitations,
    createdAt: new Date().toISOString()
  }
  await writeJson(join(directory, 'recovery-manifest.json'), recovery)
  return recovery
}

export async function readRecoveredFile(task: Task, path: string): Promise<EvidencePreview> {
  if (!task.recovery || !task.recovery.files.some((file) => file.path === path))
    throw new Error('恢复记录中没有这个文件。')
  const full = join(task.recovery.directory, path),
    local = relative(task.recovery.directory, full)
  if (isAbsolute(local) || local.startsWith('..')) throw new Error('文件路径无效。')
  if (/\.(?:pyc|pyz|marshal)$/i.test(path)) {
    const bytes = await readFile(full)
    return {
      id: path,
      text: `Python bytecode · ${bytes.length} bytes\n\n${bytes
        .subarray(0, 4096)
        .toString('hex')
        .match(/.{1,64}/g)
        ?.join('\n')}`,
      truncated: bytes.length > 4096
    }
  }
  const text = await readFile(full, 'utf8')
  return { id: path, text: text.slice(0, 200000), truncated: text.length > 200000 }
}

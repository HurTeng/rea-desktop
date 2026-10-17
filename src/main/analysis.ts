import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { basename, join } from 'node:path'
import { mkdir, copyFile } from 'node:fs/promises'
import { app } from 'electron'
import { runtimePaths } from './rea'
import { taskDirectory } from './storage'
import type { AnalysisScope, Task } from '../shared/types'

export async function prepareAnalysis(
  task: Task,
  signal: AbortSignal
): Promise<{ input_path: string; format: 'asar' | 'directory' }> {
  if (
    task.analysisMode === 'full' &&
    task.target.companionPath &&
    task.target.companionPath !== `${task.target.inputPath}.unpacked`
  )
    throw new Error(
      '完整分析需要 ASAR 相邻的 .unpacked 目录；请直接选择完整 .app，或使用架构快速分析来指定补充目录。'
    )
  if (task.target.format === 'javascript') {
    const source = join(taskDirectory(task.id), 'artifact', 'source')
    await mkdir(source, { recursive: true })
    await copyFile(task.target.inputPath, join(source, basename(task.target.inputPath)))
    return { input_path: source, format: 'directory' }
  }
  if (!['asar', 'directory'].includes(task.target.format))
    throw new Error('该目标需要使用对应格式的分析流程。')
  if (task.target.format !== 'asar' || task.analysisMode === 'full')
    return { input_path: task.target.inputPath, format: task.target.format as 'asar' | 'directory' }
  const root = app.isPackaged ? join(process.resourcesPath, 'app.asar.unpacked') : app.getAppPath()
  const script = app.isPackaged
    ? join(process.resourcesPath, 'analysis', 'prepare-asar.mjs')
    : join(root, 'resources', 'analysis', 'prepare-asar.mjs')
  const output = join(taskDirectory(task.id), 'artifact')
  const { stdout } = await promisify(execFile)(
    runtimePaths().command,
    [script, root, task.target.inputPath, output, task.target.companionPath || ''],
    { signal, maxBuffer: 4 * 1024 * 1024, timeout: 60_000 }
  )
  const prepared = JSON.parse(stdout) as { source: string; scope: AnalysisScope }
  task.analysisScope = prepared.scope
  return { input_path: prepared.source, format: 'directory' }
}

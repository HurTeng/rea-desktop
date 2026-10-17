import { readFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { app } from 'electron'
import { dataDirectory, writeJson } from './storage'
import type { EngineSettings } from '../shared/types'

export async function getEngineSettings(): Promise<EngineSettings> {
  try {
    return JSON.parse(
      await readFile(join(dataDirectory(), 'engines.json'), 'utf8')
    ) as EngineSettings
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const environment: Record<string, string> = {}
  const ghidra = join(app.getPath('userData'), 'tools', 'ghidra_12.1.4_PUBLIC')
  try {
    await access(
      join(
        ghidra,
        'support',
        process.platform === 'win32' ? 'analyzeHeadless.bat' : 'analyzeHeadless'
      )
    )
    environment.GHIDRA_INSTALL_DIR = ghidra
  } catch {
    /* 可手动配置已有安装。 */
  }
  if (process.platform === 'darwin' && !process.env.JAVA_HOME) {
    try {
      const { stdout } = await promisify(execFile)('/usr/libexec/java_home', ['-v', '21'])
      environment.JAVA_HOME = stdout.trim()
    } catch {
      /* 诊断会提示配置已有 JDK。 */
    }
  }
  return { provider: 'auto', environment }
}

export async function saveEngineSettings(input: EngineSettings): Promise<void> {
  for (const key of Object.keys(input.environment)) {
    if (
      !/^[A-Z][A-Z0-9_]*$/.test(key) ||
      ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE', 'NODE_EXTRA_CA_CERTS'].includes(key)
    )
      throw new Error('引擎环境变量名称无效。')
  }
  await writeJson(join(dataDirectory(), 'engines.json'), input)
}

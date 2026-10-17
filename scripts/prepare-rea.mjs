/* eslint-disable @typescript-eslint/explicit-function-return-type -- This build script runs directly in Node. */
// Build the user-provided REA checkout without editing its source or npm package.
// The generated runtime lives under the installed package so its dependencies and
// import.meta-based bridge paths work identically in development and app.asar.unpacked.
import { access, readFile, readdir, mkdir, cp, rm, rename, writeFile } from 'node:fs/promises'
import { join, resolve, relative } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
export async function prepareRea() {
  const source = resolve(process.env.REA_SOURCE_DIR || 'dist/rea')
  const installed = resolve('node_modules/rea-agents')
  const output = join(installed, 'desktop-source')
  let metadata
  try {
    metadata = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    if (process.env.REA_SOURCE_DIR) throw new Error(`指定的 REA 源码不存在：${source}`)
    let cached
    try {
      cached = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    console.log(
      cached
        ? `使用已构建的 REA 源码运行时：${cached.version} / ${cached.digest.slice(0, 12)}`
        : '未提供 REA 源码，使用已锁定的 npm 运行时。'
    )
    return
  }
  if (metadata.name !== 'rea-agents') throw new Error('REA_SOURCE_DIR 不是 REA 源码目录。')
  const walk = async (directory) => {
    const files = []
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) files.push(...(await walk(path)))
      else if (entry.isFile()) files.push(path)
    }
    return files
  }
  const files = (await walk(join(source, 'src'))).sort()
  const hash = createHash('sha256').update(await readFile(new URL(import.meta.url)))
  for (const file of files) hash.update(relative(source, file)).update(await readFile(file))
  for (const directory of ['bridge', 'scripts', 'third_party']) {
    for (const file of (await walk(join(source, directory))).sort())
      hash.update(relative(source, file)).update(await readFile(file))
  }
  const digest = hash.update(JSON.stringify(metadata)).digest('hex')
  try {
    const previous = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'))
    if (previous.digest === digest) {
      console.log(`REA 源码运行时已就绪：${metadata.version} / ${digest.slice(0, 12)}`)
      return
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const staging = join(installed, `desktop-source-${process.pid}.tmp`)
  await rm(staging, { recursive: true, force: true })
  try {
    await mkdir(staging, { recursive: true })
    // Preserve generated support assets from the release, then use the checkout's
    // complete production modules, bridge resources and entrypoint.
    for (const name of [
      'dist',
      'bridge',
      'third_party',
      'scripts',
      'native',
      'LICENSE',
      'THIRD_PARTY_NOTICES.md',
      'DISCLAIMER.md'
    ]) {
      try {
        await access(join(installed, name))
        await cp(join(installed, name), join(staging, name), { recursive: true })
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
    for (const name of [
      'bridge',
      'third_party',
      'scripts',
      'LICENSE',
      'THIRD_PARTY_NOTICES.md',
      'DISCLAIMER.md'
    ]) {
      try {
        await access(join(source, name))
        await cp(join(source, name), join(staging, name), { recursive: true })
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
    await writeFile(join(staging, 'package.json'), JSON.stringify(metadata, null, 2))
    await build({
      entryPoints: files.filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts')),
      outbase: join(source, 'src'),
      outdir: join(staging, 'dist'),
      bundle: false,
      platform: 'node',
      format: 'esm',
      target: 'node24',
      logLevel: 'silent'
    })
    for (const file of files.filter((file) => !file.endsWith('.ts'))) {
      const path = join(staging, 'dist', relative(join(source, 'src'), file))
      await mkdir(resolve(path, '..'), { recursive: true })
      await cp(file, path)
    }
    await mkdir(join(staging, 'dist/mcp'), { recursive: true })
    await writeFile(
      join(staging, 'dist/mcp/main.js'),
      "export { runEntrypoint } from '../main.js'\n"
    )
    await writeFile(
      join(staging, 'manifest.json'),
      JSON.stringify(
        {
          version: metadata.version,
          digest,
          builtAt: new Date().toISOString(),
          modules: files.length,
          source: 'user-provided REA checkout'
        },
        null,
        2
      )
    )
    await rm(output, { recursive: true, force: true })
    await rename(staging, output)
    console.log(
      `已构建 REA 源码运行时：${metadata.version} / ${files.length} modules / ${digest.slice(0, 12)}`
    )
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await prepareRea()

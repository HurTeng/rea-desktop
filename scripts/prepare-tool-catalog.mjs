/* eslint-disable @typescript-eslint/explicit-function-return-type -- This build script runs directly in Node. */
// Generate browsing metadata from the bundled runtime contracts without starting providers.
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export async function prepareToolCatalog(root) {
  const installed = join(root, 'node_modules', 'rea-agents')
  for (const buildType of ['release', 'source']) {
    const base = buildType === 'source' ? join(installed, 'desktop-source') : installed
    const metadata = join(base, buildType === 'source' ? 'manifest.json' : 'package.json')
    if (!existsSync(metadata)) continue
    const { version } = JSON.parse(await readFile(metadata, 'utf8'))
    const { TOOL_CONTRACTS } = await import(
      pathToFileURL(join(base, 'dist', 'contracts', 'toolContracts.js')).href
    )
    const { advertisedInputJsonSchema } = await import(
      pathToFileURL(join(base, 'dist', 'contracts', 'toolSchemaMetadata.js')).href
    )
    const tools = TOOL_CONTRACTS.map((contract) => ({
      name: contract.name,
      description: contract.description,
      inputSchema: advertisedInputJsonSchema(contract),
      effects: Object.entries(contract.effects)
        .filter(([, value]) => value === true)
        .map(([key]) => key),
      available: false,
      reason: 'availability_unknown',
      remediation: null
    }))
    await writeFile(
      join(root, 'resources', 'runtime', `${buildType}-catalog.json`),
      JSON.stringify({
        version,
        buildType,
        tools,
        providers: [],
        runtime: '',
        availabilityPending: true
      })
    )
    console.log(`已准备 ${buildType} 工具目录：${tools.length} 项`)
  }
}

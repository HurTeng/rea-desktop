// Read the real MCP catalog and render every parameter form without executing targets.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
const temporary = await mkdtemp(join(tmpdir(), 'rea-capabilities-'))
const client = new Client({ name: 'rea-desktop-coverage', version: '1' })
let entry = resolve('node_modules/rea-agents/scripts/rea.mjs')
try {
  await access(resolve('node_modules/rea-agents/desktop-source/manifest.json'))
  entry = resolve('node_modules/rea-agents/desktop-source/scripts/rea.mjs')
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
try {
  await client.connect(
    new StdioClientTransport({
      command: resolve('resources/runtime', process.platform === 'win32' ? 'node.exe' : 'node'),
      args: [entry, 'mcp'],
      stderr: 'pipe'
    })
  )
  const tools = []
  let cursor
  do {
    const page = await client.listTools(cursor ? { cursor } : {})
    tools.push(...page.tools)
    cursor = page.nextCursor
  } while (cursor)
  const output = join(temporary, 'render.cjs')
  await build({
    stdin: {
      contents: `import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {SchemaForm} from './src/renderer/src/components/SchemaForm';import {initialValue} from './src/renderer/src/schema';import {PreferencesContext} from './src/renderer/src/preferences-context';import {CAPABILITY_GROUPS,capabilityGroup} from './src/shared/capabilities';import {formatModelTools} from './src/main/format-tools';export function check(tools){let bytes=0;const groups={};for(const t of tools){const group=capabilityGroup(t.name);if(!CAPABILITY_GROUPS.some(g=>g.id===group))throw Error(t.name);groups[group]=(groups[group]||0)+1;const html=renderToStaticMarkup(React.createElement(PreferencesContext.Provider,{value:{language:'zh',theme:'light',t:v=>v}},React.createElement(SchemaForm,{schema:t.inputSchema,value:initialValue(t.inputSchema,t.inputSchema),onChange:()=>{}})));bytes+=html.length;}const available=new Set(tools.map(t=>t.name));const agent={};for(const family of ['native','managed','android','data','network','firmware','package'])agent[family]=JSON.stringify(formatModelTools({target:{format:'file',family},analysisFamily:family},tools,available)).length;return {forms:tools.length,renderedBytes:bytes,groups,agentSchemaBytes:agent}}`,
      resolveDir: process.cwd(),
      loader: 'tsx'
    },
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    logLevel: 'silent',
    external: ['electron']
  })
  const result = createRequire(import.meta.url)(output).check(tools)
  assert.equal(new Set(tools.map((t) => t.name)).size, tools.length)
  const source = resolve(process.argv[2] || 'dist/rea/src/contracts/toolContracts.ts')
  try {
    await readFile(source)
    const contractFile = join(temporary, 'contracts.cjs')
    await build({
      entryPoints: [source],
      outfile: contractFile,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      logLevel: 'silent'
    })
    const expected = createRequire(import.meta.url)(contractFile)
      .TOOL_CONTRACTS.map((t) => t.name)
      .sort()
    assert.deepEqual(tools.map((t) => t.name).sort(), expected)
    result.sourceTools = expected.length
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    result.sourceTools = 'source checkout not present'
  }
  console.log(JSON.stringify(result, null, 2))
} finally {
  await client.close()
  await rm(temporary, { recursive: true, force: true })
}

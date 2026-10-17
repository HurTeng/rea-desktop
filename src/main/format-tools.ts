import { isJavaScriptTarget } from '../shared/formats'
import type { JsonObject, Task } from '../shared/types'
import type { ReaTool } from './rea'
import { object } from '../shared/json'

const common = ['inspect_analysis_view']
const byFamily: Record<string, string[]> = {
  native: [
    'binary_overview',
    'search_procedures',
    'search_strings',
    'analyze_function',
    'procedure_pseudo_code',
    'procedure_assembly',
    'procedure_callers',
    'procedure_callees',
    'trace_call_path',
    'inspect_native_data_type',
    'inspect_native_instruction',
    'inspect_native_api',
    'inspect_pe_resources',
    'inspect_go_binary',
    'inspect_rust_binary',
    'inspect_macho',
    'list_segments'
  ],
  managed: [
    'inspect_managed_artifact',
    'inspect_managed_members',
    'inspect_managed_native_boundaries'
  ],
  android: [
    'inspect_android_package',
    'search_android_classes',
    'inspect_android_class',
    'inspect_android_method',
    'trace_android_references',
    'identify_flutter_build',
    'inspect_dart_aot'
  ],
  package: [
    'inspect_artifact',
    'inspect_plist',
    'inspect_keyed_archive',
    'inspect_asset_catalog',
    'decode_interface_builder'
  ],
  data: [
    'inspect_sqlite_database',
    'inspect_wasm_artifact',
    'inspect_go_binary',
    'inspect_rust_binary'
  ],
  network: [
    'inspect_web_network_capture',
    'inspect_pcap_capture',
    'inspect_packet_capture',
    'inspect_packet_fields'
  ],
  firmware: ['inspect_firmware_regions', 'inspect_evm_interface', 'inspect_recorded_crash'],
  web: [
    'inspect_web_page',
    'analyze_web_bundle',
    'inspect_web_event_listeners',
    'inspect_web_network_capture'
  ]
}
export function formatReadNames(task: Task): string[] {
  if (isJavaScriptTarget(task.target) && !task.target.appleBundle) return []
  return [...common, ...(byFamily[task.analysisFamily || task.target.family || 'package'] || [])]
}

// The desktop exposes the complete contract; the agent only needs same-session,
// retained evidence views for this target family. Inline Evidence schemas dominate
// tokens and are unnecessary because the host already retains every observation.
function modelViewSchema(task: Task, schema: JsonObject): JsonObject {
  const allowed: Record<string, string[]> = {
    native: ['summary', 'native', 'macho', 'page'],
    managed: ['summary', 'managed', 'managed-members'],
    android: ['summary', 'android', 'dart-aot'],
    data: ['summary', 'wasm'],
    package: ['summary', 'inventory', 'interface-builder', 'page'],
    network: ['summary', 'capture', 'api-surface', 'pcap', 'qlog'],
    firmware: ['summary', 'evm'],
    web: ['summary', 'capture', 'api-surface']
  }
  const flatten = (value: unknown): JsonObject[] => {
    const node = object(value),
      choices = node.oneOf ?? node.anyOf
    return Array.isArray(choices) ? choices.flatMap(flatten) : [node]
  }
  const views = flatten(object(schema.properties).view).filter((view) =>
    (allowed[task.analysisFamily || task.target.family || 'package'] || ['summary']).includes(
      String(object(object(view.properties).kind).const)
    )
  )
  return {
    type: 'object',
    properties: {
      source: {
        type: 'object',
        properties: {
          kind: { type: 'string', const: 'retained-evidence' },
          evidence_id: { type: 'string', pattern: '^ev_[a-f0-9]{64}$' }
        },
        required: ['kind', 'evidence_id'],
        additionalProperties: false
      },
      view: { oneOf: views }
    },
    required: ['source', 'view'],
    additionalProperties: false
  }
}

export function formatModelTools(
  task: Task,
  catalog: ReaTool[],
  available: Set<string>
): { type: 'function'; function: { name: string; description: string; parameters: JsonObject } }[] {
  return formatReadNames(task)
    .filter((name) => available.has(name))
    .flatMap((name) => {
      const tool = catalog.find((item) => item.name === name)
      if (!tool) return []
      const schema =
        name === 'inspect_analysis_view'
          ? modelViewSchema(task, object(tool.inputSchema))
          : { ...tool.inputSchema }
      const properties = { ...object(schema.properties) }
      const injected = ['path', 'capture_path', 'cdp_endpoint', 'target_id']
      for (const key of injected) delete properties[key]
      return [
        {
          type: 'function' as const,
          function: {
            name,
            description: (tool.description || name).slice(0, 900),
            parameters: {
              ...schema,
              properties,
              required: (Array.isArray(schema.required) ? schema.required.map(String) : []).filter(
                (key) => !injected.includes(key)
              )
            }
          }
        }
      ]
    })
}

export function bindReadArguments(
  task: Task,
  name: string,
  args: JsonObject,
  catalog: ReaTool[]
): JsonObject {
  if (!formatReadNames(task).includes(name)) throw new Error('该工具不属于当前目标的静态查询工具。')
  const properties = object(catalog.find((tool) => tool.name === name)?.inputSchema.properties)
  const input = { ...args }
  if (properties.path) input.path = task.target.inputPath
  if (properties.capture_path) input.capture_path = task.target.inputPath
  if (properties.cdp_endpoint) input.cdp_endpoint = task.target.web?.cdpEndpoint
  if (properties.target_id) input.target_id = task.target.web?.targetId
  if (name === 'inspect_pe_resources')
    input.max_file_bytes = Math.min(536870912, Math.max(task.target.bytes || 0, 67108864))
  if (name === 'inspect_web_network_capture') input.format = task.target.format
  return input
}

export function rowsFrom(value: unknown): JsonObject[] {
  if (Array.isArray(value))
    return value.map((item) => (typeof item === 'string' ? { path: item } : object(item)))
  const record = object(value)
  for (const key of [
    'items',
    'rows',
    'procedures',
    'functions',
    'types',
    'tables',
    'files',
    'entries',
    'nodes',
    'records'
  ]) {
    if (Array.isArray(record[key])) return rowsFrom(record[key])
  }
  for (const key of ['normalized_result', 'result', 'page', 'inventory', 'graph', 'overview']) {
    if (record[key]) {
      const rows = rowsFrom(record[key])
      if (rows.length) return rows
    }
  }
  return []
}

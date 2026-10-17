import type { JsonObject } from './types'
export function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {}
}

// REA uses this declaration to redact payload values; the declaration itself
// must not be copied into the desktop's argument journal.
export function retainedToolArguments(args: JsonObject): JsonObject {
  return Object.fromEntries(Object.entries(args).filter(([key]) => key !== 'sensitive_values'))
}

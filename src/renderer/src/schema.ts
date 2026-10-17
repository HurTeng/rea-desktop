import type { JsonObject } from '../../shared/types'
type Schema = JsonObject
function obj(value: unknown): Schema {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Schema) : {}
}
export function resolveSchema(schema: Schema, root: Schema, seen: string[] = []): Schema {
  if (typeof schema.$ref !== 'string' || seen.includes(schema.$ref)) return schema
  const ref = schema.$ref
  const referenced = ref
    .split('/')
    .slice(1)
    .reduce<unknown>(
      (value, part) => obj(value)[part.replaceAll('~1', '/').replaceAll('~0', '~')],
      root
    )
  return {
    ...resolveSchema(obj(referenced), root, [...seen, ref]),
    ...Object.fromEntries(Object.entries(schema).filter(([key]) => key !== '$ref'))
  }
}
export function variants(schema: Schema, root: Schema): Schema[] {
  const value = schema.oneOf ?? schema.anyOf
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const s = resolveSchema(obj(item), root)
        return s.oneOf || s.anyOf ? variants(s, root) : [s]
      })
    : []
}
export function matches(schema: Schema, value: unknown, root: Schema): boolean {
  const s = resolveSchema(schema, root)
  if ('const' in s) return value === s.const
  if (Array.isArray(s.enum)) return s.enum.includes(value)
  if (s.type === 'object')
    return (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.entries(obj(s.properties)).every(
        ([key, child]) =>
          !('const' in resolveSchema(obj(child), root)) ||
          obj(value)[key] === resolveSchema(obj(child), root).const
      )
    )
  if (s.type === 'null') return value === null
  if (s.type === 'array') return Array.isArray(value)
  return s.type === typeof value || (s.type === 'integer' && typeof value === 'number')
}
export function initialValue(schema: Schema, root: Schema, depth = 0): unknown {
  const s = resolveSchema(schema, root)
  if ('default' in s) return s.default
  if ('const' in s) return s.const
  if (depth > 12) return undefined
  const choices = variants(s, root)
  if (choices.length) return initialValue(choices[0], root, depth + 1)
  if (s.type === 'object' || s.properties)
    return Object.fromEntries(
      (Array.isArray(s.required) ? s.required : [])
        .map(String)
        .map((key) => [key, initialValue(obj(obj(s.properties)[key]), root, depth + 1)])
    )
  if (s.type === 'array') return []
  if (s.type === 'boolean') return false
  if (s.type === 'null') return null
  if (s.type === 'integer' || s.type === 'number')
    return (
      s.minimum ?? (typeof s.exclusiveMinimum === 'number' ? s.exclusiveMinimum + 1 : undefined)
    )
  return Array.isArray(s.enum) ? s.enum[0] : ''
}
export function variantLabel(schema: Schema): string {
  const properties = obj(schema.properties)
  const discriminants = Object.entries(properties).flatMap(([name, child]) =>
    'const' in obj(child) ? [`${name}: ${String(obj(child).const)}`] : []
  )
  return (
    discriminants.join(' · ') ||
    String(
      schema.title ||
        (Array.isArray(schema.enum) ? schema.enum.join(' / ') : schema.type || 'Value')
    )
  )
}

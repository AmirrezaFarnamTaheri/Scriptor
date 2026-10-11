export type CellValue = string | number | boolean | null
export const DATABASE_ROW_LIMIT = 200
export const CALCULATION_OPERATORS = ['add','subtract','multiply','divide','concat','lower','upper','length','days-between'] as const
export type CalculationOperator = typeof CALCULATION_OPERATORS[number]
export interface DatabaseFormula { op: CalculationOperator; fields: string[] }
export interface DatabaseColumn { key: string; label: string; formula?: DatabaseFormula }
export interface DatabaseView {
  schemaVersion: 1; id: string; label: string; mode: 'table' | 'list' | 'gallery'
  combine: 'all' | 'any'; filters: Array<{ field: 'title' | 'tag' | 'path' | 'days' | 'metadata'; key?: string; value: string }>
  columns: DatabaseColumn[]
}
const FIELD = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a database view object.')
  return value as Record<string, unknown>
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('Invalid database view text.')
  return value.trim()
}
export function validateFormula(value: unknown): DatabaseFormula {
  const item = record(value)
  if (!CALCULATION_OPERATORS.includes(item.op as CalculationOperator) || !Array.isArray(item.fields)) throw new Error('Unsupported calculated column operator.')
  const op = item.op as CalculationOperator
  const count = ['lower','upper','length'].includes(op) ? 1 : 2
  if (item.fields.length !== count || item.fields.some((field) => typeof field !== 'string' || !FIELD.test(field))) throw new Error('Calculated column requires valid field names.')
  return { op, fields: item.fields as string[] }
}
export function validateDatabaseView(value: unknown): DatabaseView {
  const view = record(value)
  if (view.schemaVersion !== 1 || !['table','list','gallery'].includes(String(view.mode)) || !['all','any'].includes(String(view.combine))) throw new Error('Unsupported database view version or layout.')
  if (!Array.isArray(view.filters) || view.filters.length > 10 || !Array.isArray(view.columns) || view.columns.length > 12) throw new Error('Views allow at most 10 filters and 12 columns.')
  const filters = view.filters.map((raw) => {
    const filter = record(raw)
    if (!['title','tag','path','days','metadata'].includes(String(filter.field))) throw new Error('Unsupported filter field.')
    const value = text(filter.value, 256)
    if (filter.field === 'days' && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 36500)) throw new Error('Days must be between 1 and 36500.')
    const key=filter.field==='metadata'?text(filter.key,64):undefined
    if(key&&(!FIELD.test(key)||['constructor','prototype','__proto__'].includes(key)))throw new Error('Invalid metadata filter field.')
    return { field: filter.field as DatabaseView['filters'][number]['field'], value, ...(key?{key}:{}) }
  })
  const columns = view.columns.map((raw) => {
    const column = record(raw); const key = text(column.key, 64)
    if (!FIELD.test(key) || ['__proto__','constructor','prototype'].includes(key)) throw new Error('Invalid column field.')
    return { key, label: text(column.label, 64), ...(column.formula ? { formula: validateFormula(column.formula) } : {}) }
  })
  if (new Set(columns.map((column) => column.key)).size !== columns.length) throw new Error('Column fields must be unique.')
  return { schemaVersion: 1, id: text(view.id, 128), label: text(view.label, 128), mode: view.mode as DatabaseView['mode'], combine: view.combine as DatabaseView['combine'], filters, columns }
}
export function defaultDatabaseView(): DatabaseView {
  return { schemaVersion: 1, id: 'default', label: 'All notes', mode: 'table', combine: 'all', filters: [], columns: [{key:'status',label:'Status'}, {key:'score',label:'Score'}] }
}
export function databaseFilterJson(view: DatabaseView): string {
  const operators = {title:'title contains',tag:'tag has',path:'path matches',days:'modified within days'}
  const conditions = view.combine==='any'&&view.filters.some(filter=>filter.field==='metadata')?[]:view.filters.filter(filter=>filter.field!=='metadata').map((filter) => ({ op: operators[filter.field as keyof typeof operators], value: filter.field === 'path' ? filter.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : filter.value }))
  return JSON.stringify(conditions.length ? { [view.combine]: conditions } : {all:[{op:'title contains',value:''}]})
}
export function isMissingDatabasePreset(error: unknown): boolean { return (error instanceof Error?error.message:String(error))==='note not found: .scriptor/presets/database-studio.md' }
export function matchesMetadataFilters(view:DatabaseView,values:Record<string,CellValue>,note:{title:string;tags:string[];path:string;modifiedDays:number}):boolean {
  if(!view.filters.some(filter=>filter.field==='metadata'))return true
  const matches=view.filters.map(filter=>filter.field==='metadata'?values[filter.key??'']!==undefined&&String(values[filter.key??''])===filter.value:filter.field==='title'?note.title.toLowerCase().includes(filter.value.toLowerCase()):filter.field==='tag'?note.tags.includes(filter.value):filter.field==='path'?note.path.includes(filter.value):note.modifiedDays<=Number(filter.value))
  return view.combine==='all'?matches.every(Boolean):matches.some(Boolean)
}

/** Read-only scalar projection; ambiguous or complex YAML stays in the source editor. */
export function scalarFields(markdown: string): Record<string, CellValue> {
  const result: Record<string, CellValue> = {}; const seen = new Set<string>()
  const match = markdown.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match || match[1].length > 65536) return result
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z][A-Za-z0-9_-]{0,63}):\s*(.*?)\s*$/)
    if (!field) continue
    const [, key, raw] = field
    if (seen.has(key)) { delete result[key]; continue }
    seen.add(key)
    if (['constructor','prototype','__proto__'].includes(key) || !raw || /^[[\]{}&*!|>]/.test(raw)) continue
    if (raw.startsWith('"')) { try { const value: unknown = JSON.parse(raw); if (typeof value === 'string') result[key] = value } catch { /* preserve authored complex YAML in editor */ } }
    else if (/^'.*'$/.test(raw)) result[key] = raw.slice(1,-1).replace(/''/g, "'")
    else if (/^(true|false)$/i.test(raw)) result[key] = raw.toLowerCase() === 'true'
    else if (/^(null|~)$/i.test(raw)) result[key] = null
    else if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(raw) && Number.isFinite(Number(raw))) result[key] = Number(raw)
    else result[key] = raw.replace(/\s+#.*$/, '')
  }
  return result
}
export function calculateValue(raw: DatabaseFormula, fields: Record<string, CellValue>): CellValue {
  const formula = validateFormula(raw)
  const values = formula.fields.map((key) => fields[key])
  if (values.some((value) => value === undefined || value === null)) return null
  const [a,b] = values
  if (formula.op === 'concat') return `${a}${b}`.slice(0,4096)
  if (formula.op === 'upper') return String(a).toUpperCase().slice(0,4096)
  if (formula.op === 'lower') return String(a).toLowerCase().slice(0,4096)
  if (formula.op === 'length') return String(a).length
  if (formula.op === 'days-between') {
    if (![a,b].every((value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))) return null
    const dates=[String(a),String(b)].map(value=>new Date(value))
    if(dates.some((date,index)=>!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==String(values[index])))return null
    const days = (dates[1].getTime()-dates[0].getTime()) / 86400000
    return Number.isFinite(days) ? days : null
  }
  if (typeof a !== 'number' || typeof b !== 'number') return null
  const value = formula.op === 'add' ? a+b : formula.op === 'subtract' ? a-b : formula.op === 'multiply' ? a*b : b === 0 ? NaN : a/b
  return Number.isFinite(value) ? value : null
}
export function aggregateColumn(values: CellValue[]) {
  const numeric = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const count = numeric.length; const sum = numeric.reduce((total,value) => total+value,0)
  return { count, sum: Number.isFinite(sum) ? sum : null, average: count && Number.isFinite(sum) ? sum/count : null, min: count ? Math.min(...numeric) : null, max: count ? Math.max(...numeric) : null }
}

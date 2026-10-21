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
  // `path matches` is a regular expression at the native boundary
  // (`crates/vault/src/views.rs`): existing saved views rely on that
  // (`^projects/`, `daily/.*`). The pattern is therefore passed through
  // unchanged. Escaping it here made a regex filter match its own literal
  // text, so a view using `^projects/` silently returned no rows while the
  // same filter in Saved Views worked. A pattern that is not a valid regular
  // expression falls back to glob and then substring semantics natively, so
  // no escaping is required for safety.
  const conditions = view.combine==='any'&&view.filters.some(filter=>filter.field==='metadata')?[]:view.filters.filter(filter=>filter.field!=='metadata').map((filter) => ({ op: operators[filter.field as keyof typeof operators], value: filter.value }))
  return JSON.stringify(conditions.length ? { [view.combine]: conditions } : {all:[{op:'title contains',value:''}]})
}
export function isMissingDatabasePreset(error: unknown): boolean { return (error instanceof Error?error.message:String(error))==='note not found: .scriptor/presets/database-studio.md' }

/**
 * Fold ASCII `A-Z` only.
 *
 * The native evaluator compares tags with `str::eq_ignore_ascii_case`, and
 * the SQL prefilter uses SQLite's `COLLATE NOCASE`. Both fold ASCII only, so
 * a Unicode-aware fold here would keep notes the native query had already
 * dropped.
 */
function asciiLower(value: string): string {
  let result = ''
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    result += code >= 0x41 && code <= 0x5a ? String.fromCharCode(code + 0x20) : character
  }
  return result
}

/**
 * Mirror the native `tag has` operator exactly: a leading `#` is optional and
 * the comparison is case-insensitive.
 *
 * The native evaluator (`crates/vault/src/views.rs`) and its SQL prefilter
 * both compare tags case-insensitively. A case-sensitive comparison here
 * silently dropped notes the native query had already accepted, so a view that
 * combined a metadata filter with a tag filter returned fewer rows than the
 * same tag filter reported on its own.
 */
export function matchesTag(tags: string[], value: string): boolean {
  const expected = asciiLower(value.replace(/^#+/, ''))
  return tags.some((tag) => asciiLower(tag) === expected)
}

/**
 * Upper bound on a compiled view pattern, in bytes.
 *
 * The native evaluator applies the same bound (`VIEW_REGEX_SIZE_LIMIT` in
 * `crates/vault/src/views.rs`) because view filters come from vault JSON that
 * a shared or cloned vault controls.
 */
const VIEW_REGEX_SIZE_LIMIT = 1 << 20

/**
 * Constructs the native regex engine rejects but JavaScript compiles.
 *
 * The native evaluator falls back to glob and then substring semantics for a
 * pattern that does not compile. JavaScript compiles look-around, atomic
 * groups, possessive quantifiers and backreferences, so a pattern using one
 * of them would match here and never match natively. Treating them as
 * non-compiling keeps the client mirror on the native result.
 *
 * A quantifier only counts when it is not escaped, so `a\*+` stays an
 * ordinary repetition while `a++` is a possessive quantifier.
 */
const NATIVE_REJECTED_PATTERN = /\(\?(?:[=!]|<[=!]|>)|(?:^|[^\\])(?:[*+?}]|\{\d+(?:,\d*)?\})\+|\(\?P=|\\[1-9]|\\k</

/**
 * Whether the runtime supports scoped inline flags (`(?i:...)`).
 *
 * The native engine applies `(?i)` to the remainder of the enclosing group.
 * A scoped flag reproduces that exactly; the global `i` flag would make the
 * whole pattern case-insensitive instead.
 */
const SCOPED_FLAGS_SUPPORTED = (() => {
  try {
    return new RegExp('(?i:a)').test('A')
  } catch {
    return false
  }
})()

/**
 * Index just past the character class that starts at `open`.
 *
 * A `]` immediately after `[` or `[^` is a literal, not the end of the
 * class.
 */
function findCharacterClassEnd(source: string, open: number): number {
  let index = open + 1
  if (source[index] === '^') index += 1
  if (source[index] === ']') index += 1
  while (index < source.length && source[index] !== ']') {
    if (source[index] === '\\') index += 1
    index += 1
  }
  return Math.min(index + 1, source.length)
}

/**
 * Index of the `)` that closes the group that starts at `open`.
 */
function findGroupEnd(source: string, open: number): number {
  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    const character = source[index]
    if (character === '\\') { index += 1; continue }
    if (character === '[') { index = findCharacterClassEnd(source, index) - 1; continue }
    if (character === '(') { depth += 1; continue }
    if (character === ')') {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

/**
 * Rewrite the native `(?i)` directive into a scoped JavaScript group.
 *
 * The native engine applies `(?i)` to the remainder of the enclosing group.
 * JavaScript has no unscoped inline flag, so the directive is rewritten to
 * `(?i:...)` covering exactly that remainder. A directive inside a nested
 * group is handled by the recursion, because each group body is the scope
 * of the directive it contains.
 */
function applyInlineCaseInsensitive(body: string): string {
  let result = ''
  let index = 0
  while (index < body.length) {
    const character = body[index]
    if (character === '\\') { result += body.slice(index, index + 2); index += 2; continue }
    if (character === '[') {
      const end = findCharacterClassEnd(body, index)
      result += body.slice(index, end)
      index = end
      continue
    }
    if (character === '(') {
      if (body.startsWith('(?i)', index)) {
        // The directive covers the rest of this scope.
        return `${result}(?i:${applyInlineCaseInsensitive(body.slice(index + 4))})`
      }
      if (body.startsWith('(?:', index)) {
        const end = findGroupEnd(body, index)
        if (end < 0) break
        result += `(?:${applyInlineCaseInsensitive(body.slice(index + 3, end))})`
        index = end + 1
        continue
      }
      const named = /^\(\?P?<[A-Za-z_][A-Za-z0-9_]*>/.exec(body.slice(index))
      if (named) {
        const end = findGroupEnd(body, index)
        if (end < 0) break
        result += `${named[0]}${applyInlineCaseInsensitive(body.slice(index + named[0].length, end))})`
        index = end + 1
        continue
      }
      const end = findGroupEnd(body, index)
      if (end < 0) break
      result += `(${applyInlineCaseInsensitive(body.slice(index + 1, end))})`
      index = end + 1
      continue
    }
    result += character
    index += 1
  }
  return result
}

/**
 * Compile a pattern the way the native evaluator does, or return `null` when
 * the pattern does not compile.
 */
function compileViewPattern(pattern: string): RegExp | null {
  if (pattern.length > VIEW_REGEX_SIZE_LIMIT) return null
  if (NATIVE_REJECTED_PATTERN.test(pattern)) return null
  // The native engine spells a named group `(?P<name>...)`; JavaScript
  // spells the same group `(?<name>...)`.
  const source = pattern.replaceAll('(?P<', '(?<')
  try {
    if (!source.includes('(?i)')) return new RegExp(source)
    if (!SCOPED_FLAGS_SUPPORTED) return null
    return new RegExp(applyInlineCaseInsensitive(source))
  } catch {
    return null
  }
}

/**
 * Mirror the native `path matches` operator: the pattern is a regular
 * expression, a pattern that is not a valid regular expression falls back to
 * glob semantics, and a pattern without wildcards falls back to a substring
 * test.
 *
 * The native evaluator remains authoritative for the indexed query. This
 * mirror keeps the client-side check that runs alongside a metadata filter
 * from dropping notes the native query had already accepted.
 */
export function pathMatches(path: string, pattern: string): boolean {
  const expression = compileViewPattern(pattern)
  if (expression) return expression.test(path)
  if (pattern.includes('*') || pattern.includes('?')) {
    const glob = `^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`
    try {
      return new RegExp(glob).test(path)
    } catch {
      return false
    }
  }
  return path.includes(pattern)
}

/** One metadata condition: the field must be present and hold the exact text. */
function matchesMetadataCondition(filter: DatabaseView['filters'][number], values: Record<string, CellValue>): boolean {
  const value = values[filter.key ?? '']
  return value !== undefined && String(value) === filter.value
}

/**
 * Apply the conditions the native evaluator cannot express on its own.
 *
 * The native query evaluates every condition except `metadata`. Re-checking
 * those conditions here could only ever drop notes the native query had
 * already accepted, which is why a pattern that is valid natively but not in
 * the browser used to shrink the result set. The native conditions are
 * therefore only re-checked where the client is the sole evaluator.
 *
 * An `any` group that contains a metadata condition is the one case the
 * native query cannot express: `databaseFilterJson` drops the whole
 * disjunction, so the native query returns every note and the client
 * evaluates the complete group here.
 */
export function matchesMetadataFilters(view:DatabaseView,values:Record<string,CellValue>,note:{title:string;tags:string[];path:string;modifiedDays:number}):boolean {
  const metadataFilters=view.filters.filter(filter=>filter.field==='metadata')
  if(!metadataFilters.length)return true
  if(view.combine==='any'){
    // The native query returned every note, so the whole disjunction is
    // evaluated here against the native semantics of each operator.
    const matches=view.filters.map(filter=>filter.field==='metadata'?matchesMetadataCondition(filter,values):filter.field==='title'?note.title.toLowerCase().includes(filter.value.toLowerCase()):filter.field==='tag'?matchesTag(note.tags,filter.value):filter.field==='path'?pathMatches(note.path,filter.value):note.modifiedDays<=Number(filter.value))
    return matches.some(Boolean)
  }
  // In an `all` group the native query applied every non-metadata condition
  // already, so only the metadata conditions remain.
  return metadataFilters.every(filter=>matchesMetadataCondition(filter,values))
}

/**
 * Match a YAML number, including the exponent form.
 *
 * YAML 1.2 accepts `1e3`, `1E3` and `1.0e+3` as numbers, so the reader
 * accepts them too. A reader that rejected the exponent form would read a
 * written number back as text and change the type of the cell.
 */
const YAML_NUMBER = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/

/**
 * Read one YAML scalar exactly the way the table reads it, so an edited cell
 * and a displayed cell mean the same thing.
 */
export function parseScalarCell(raw: string): CellValue {
  const value = raw.trim()
  if (!value) return ''
  if (value.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(value)
      if (typeof parsed === 'string') return parsed
    } catch {
      // A malformed quoted value stays plain text rather than silently
      // becoming a different type.
      return value
    }
  }
  if (/^'.*'$/.test(value)) return value.slice(1,-1).replace(/''/g, "'")
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true'
  if (/^(null|~)$/i.test(value)) return null
  if (YAML_NUMBER.test(value) && Number.isFinite(Number(value))) return Number(value)
  return value.replace(/\s+#.*$/, '')
}

/**
 * Render a cell as the YAML text that reads back as the same value.
 *
 * Text that would otherwise be re-read as a number, boolean or null is
 * quoted, so a cell holding the string `2026` keeps its type when the user
 * saves it instead of turning into the number 2026.
 */
export function formatScalarCell(value: CellValue): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null'
  // Plain text is only safe when it cannot be re-read as another type and
  // cannot be truncated by the reader (trailing `#` comments, edge spaces).
  if (value.length === 0) return '""'
  if (value !== value.trim()) return JSON.stringify(value)
  if (/^(?:true|false|null|~)$/i.test(value)) return JSON.stringify(value)
  if (!/^[A-Za-z][A-Za-z0-9 _./-]*$/.test(value)) return JSON.stringify(value)
  return value
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
    else if (YAML_NUMBER.test(raw) && Number.isFinite(Number(raw))) result[key] = Number(raw)
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

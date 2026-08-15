/**
 * @scriptor/template-engine — Parse (W2-1)
 *
 * Grammar produces a flat array of `TemplateNode`s from a template string.
 * Supported syntax:
 *   - `{{expr}}` — interpolation (expression or variable)
 *   - `<% if cond %>` … `<% end %>` — conditional block
 *   - `<% for var in expr %>` … `<% end %>` — iteration block
 *   - `<% end %>` — closes the innermost open block
 *
 * Pipe syntax: `{{value | filter1 | filter2:arg}}` — `|` separates filters;
 * `:arg` passes a string argument to the filter.
 *
 * Design invariants (I-6):
 *   - No `eval`, no `new Function`. The parser builds a typed AST; the
 *     evaluator dispatches on it via a lookup table.
 *   - An unknown filter name is a **typed error** (`ParseError`), not a
 *     silent passthrough.
 */

// ── Token types ───────────────────────────────────────────────────────────────

export type Literal = { kind: 'literal'; text: string }

export type PipeCall = {
  kind: 'pipe'
  name: string
  arg: string | undefined
}

/** `{{expr | filter1 | filter2:arg}}` */
export type Interpolation = {
  kind: 'interpolation'
  expr: string
  pipes: PipeCall[]
}

/** `<% if cond %>` */
export type IfOpen = { kind: 'if'; cond: string }

/** `<% for var in expr %>` */
export type ForOpen = { kind: 'for'; binding: string; expr: string }

/** `<% end %>` — closes the most recent `if` or `for` */
export type BlockEnd = { kind: 'end' }

export type TemplateNode =
  | Literal
  | Interpolation
  | IfOpen
  | ForOpen
  | BlockEnd

// ── Parse errors ──────────────────────────────────────────────────────────────

export class ParseError extends Error {
  readonly offset: number
  readonly source: string

  constructor(
    message: string,
    offset: number,
    source: string,
  ) {
    super(message)
    this.name = 'ParseError'
    this.offset = offset
    this.source = source
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a template string into a flat array of `TemplateNode`s.
 *
 * @param source  The raw template text.
 * @param knownFilters  Set of valid filter names. An unknown filter name
 *                      throws `ParseError`.
 * @throws {ParseError}  On syntax errors or unknown filter names.
 */
export function parse(source: string, knownFilters: ReadonlySet<string>): TemplateNode[] {
  const nodes: TemplateNode[] = []
  let pos = 0

  while (pos < source.length) {
    const interpStart = source.indexOf('{{', pos)
    const tagStart    = source.indexOf('<%', pos)

    // No more delimiters: everything remaining is literal.
    if (interpStart === -1 && tagStart === -1) {
      nodes.push({ kind: 'literal', text: source.slice(pos) })
      break
    }

    // Pick the earliest delimiter.
    const next =
      interpStart === -1  ? tagStart  :
      tagStart    === -1  ? interpStart :
      Math.min(interpStart, tagStart)

    // Emit literal text before the delimiter.
    if (next > pos) {
      nodes.push({ kind: 'literal', text: source.slice(pos, next) })
    }

    if (next === interpStart) {
      // Interpolation: `{{…}}`
      const end = source.indexOf('}}', next + 2)
      if (end === -1) {
        throw new ParseError('Unclosed interpolation `{{`', next, source)
      }
      const inner = source.slice(next + 2, end).trim()
      nodes.push(parseInterpolation(inner, next, source, knownFilters))
      pos = end + 2
    } else {
      // Tag block: `<% … %>`
      const end = source.indexOf('%>', next + 2)
      if (end === -1) {
        throw new ParseError('Unclosed tag `<%`', next, source)
      }
      const inner = source.slice(next + 2, end).trim()
      nodes.push(parseTag(inner, next, source))
      pos = end + 2
    }
  }

  validateBlockStructure(nodes, source)
  return nodes
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Parse `expr | filter1 | filter2:arg` into an `Interpolation` node. */
function parseInterpolation(
  inner: string,
  offset: number,
  source: string,
  knownFilters: ReadonlySet<string>,
): Interpolation {
  const segments = inner.split('|').map(s => s.trim())
  const expr = segments[0] ?? ''
  const pipes: PipeCall[] = []

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i]
    if (!seg) continue
    const colonIdx = seg.indexOf(':')
    const name = colonIdx === -1 ? seg : seg.slice(0, colonIdx).trimEnd()
    const arg  = colonIdx === -1 ? undefined : seg.slice(colonIdx + 1).trimStart()

    if (!knownFilters.has(name)) {
      throw new ParseError(
        `Unknown filter "${name}". Known filters: ${[...knownFilters].sort().join(', ')}`,
        offset,
        source,
      )
    }
    pipes.push({ kind: 'pipe', name, arg })
  }

  return { kind: 'interpolation', expr, pipes }
}

/** Parse a `<% … %>` tag body into an `IfOpen`, `ForOpen`, or `BlockEnd`. */
function parseTag(inner: string, offset: number, source: string): IfOpen | ForOpen | BlockEnd {
  if (inner === 'end') {
    return { kind: 'end' }
  }

  if (inner.startsWith('if ')) {
    const cond = inner.slice(3).trim()
    if (!cond) {
      throw new ParseError('Empty `if` condition', offset, source)
    }
    return { kind: 'if', cond }
  }

  if (inner.startsWith('for ')) {
    // `for <binding> in <expr>`
    const rest = inner.slice(4).trim()
    const inIdx = rest.indexOf(' in ')
    if (inIdx === -1) {
      throw new ParseError(
        '`for` tag must be `for <var> in <expr>`',
        offset,
        source,
      )
    }
    const binding = rest.slice(0, inIdx).trim()
    const expr    = rest.slice(inIdx + 4).trim()
    if (!binding || !expr) {
      throw new ParseError(
        '`for` tag has an empty binding or expression',
        offset,
        source,
      )
    }
    return { kind: 'for', binding, expr }
  }

  throw new ParseError(`Unknown tag keyword in \`<% ${inner} %>\``, offset, source)
}

/**
 * Validate that every `if`/`for` opener has a matching `end`, and that no
 * `end` is orphaned.
 */
function validateBlockStructure(nodes: TemplateNode[], source: string): void {
  const stack: Array<'if' | 'for'> = []
  for (const node of nodes) {
    if (node.kind === 'if' || node.kind === 'for') {
      stack.push(node.kind)
    } else if (node.kind === 'end') {
      if (stack.length === 0) {
        throw new ParseError('`<% end %>` without a matching `if` or `for`', 0, source)
      }
      stack.pop()
    }
  }
  if (stack.length > 0) {
    throw new ParseError(
      `Unclosed block: ${stack.map(k => `<% ${k} %>`).join(', ')}`,
      source.length,
      source,
    )
  }
}

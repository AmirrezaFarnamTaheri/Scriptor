/**
 * @scriptor/template-engine — Evaluator (W2-2)
 *
 * Walks the parsed AST produced by `parse()` and renders it against a context
 * object. The result is a `Promise<TemplateResult>` so that namespace
 * functions can be async (e.g. date lookups, file reads) without blocking the
 * main thread.
 *
 * # No `eval`, no `new Function` (I-6)
 * Expressions are strings that name a key in `context` or traverse a
 * dot-separated path (`file.name`, `date.today`). Namespace calls are
 * dispatched through `EvalOptions.namespaces`, a caller-supplied lookup table.
 * There is no dynamic code execution.
 *
 * # Namespace calls
 * An expression of the form `ns.fn` where `ns` is a key in
 * `options.namespaces` is dispatched as `namespaces[ns][fn]()`. The return
 * value may be a `Promise`; all promises are awaited before rendering.
 */

import { BUILTIN_FILTERS, BUILTIN_FILTER_NAMES, type FilterFn } from './filters.ts'
import { parse, type TemplateNode } from './parse.ts'

// ── Types ─────────────────────────────────────────────────────────────────────

/** The result of a successful template evaluation. */
export interface TemplateResult {
  /** The rendered string. */
  text: string
  /**
   * Names of variables accessed during evaluation. Useful for cache
   * invalidation: if any of these change, the template output may change.
   */
  accessed: ReadonlySet<string>
}

/**
 * A namespace is an object whose values are zero-argument functions returning
 * a value or `Promise<unknown>`. e.g. `{ date: { today: () => '2026-08-10' } }`.
 */
export type NamespaceMap = Record<string, Record<string, () => unknown | Promise<unknown>>>

/** Options controlling the evaluator's behaviour. */
export interface EvalOptions {
  /**
   * Context variables visible to `{{expr}}` interpolations. Supports
   * dot-access up to one level deep (`file.name` → `context.file.name`).
   */
  context?: Record<string, unknown>
  /**
   * Namespace functions dispatched by `{{ns.fn}}` expressions.
   * Values may return `Promise<unknown>`.
   */
  namespaces?: NamespaceMap
  /**
   * Additional filters beyond the built-ins. A caller-supplied filter with
   * the same name as a built-in **overrides** the built-in.
   */
  extraFilters?: ReadonlyMap<string, FilterFn>
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Render a template string against the given options.
 *
 * @param source   Raw template text.
 * @param options  Context, namespaces, and extra filters.
 * @returns        `Promise<TemplateResult>` with the rendered text and
 *                 the set of variable names that were read.
 * @throws {ParseError}  If the template has syntax or unknown-filter errors.
 * @throws {EvalError}   If a namespace function throws at runtime.
 */
export async function evaluate(
  source: string,
  options: EvalOptions = {},
): Promise<TemplateResult> {
  const filters = buildFilterMap(options.extraFilters)
  // Extend known filter names with any extras for the parser guard.
  const knownFilters = new Set([...BUILTIN_FILTER_NAMES, ...(options.extraFilters?.keys() ?? [])])
  const nodes = parse(source, knownFilters)

  const accessed = new Set<string>()
  const text = await renderNodes(nodes, options, filters, accessed)
  return { text, accessed }
}

// ── Internal ──────────────────────────────────────────────────────────────────

function buildFilterMap(extras?: ReadonlyMap<string, FilterFn>): Map<string, FilterFn> {
  const m = new Map<string, FilterFn>(BUILTIN_FILTERS)
  if (extras) {
    for (const [k, v] of extras) m.set(k, v)
  }
  return m
}

/** Render a list of nodes into a string, respecting if/for scoping. */
async function renderNodes(
  nodes: TemplateNode[],
  options: EvalOptions,
  filters: Map<string, FilterFn>,
  accessed: Set<string>,
  localContext: Record<string, unknown> = {},
): Promise<string> {
  const ctx = { ...(options.context ?? {}), ...localContext }
  const parts: string[] = []
  let i = 0

  while (i < nodes.length) {
    const node = nodes[i]!

    if (node.kind === 'literal') {
      parts.push(node.text)
      i++
      continue
    }

    if (node.kind === 'interpolation') {
      const raw = await resolveExpr(node.expr, ctx, options.namespaces, accessed)
      let value = raw === undefined || raw === null ? '' : String(raw)
      for (const pipe of node.pipes) {
        const fn = filters.get(pipe.name)!
        // Unknown filters are caught at parse time; fn is always defined here.
        value = fn(value, pipe.arg)
      }
      parts.push(value)
      i++
      continue
    }

    if (node.kind === 'if') {
      // Collect the body up to the matching `end`.
      const [body, skip] = collectBlock(nodes, i + 1)
      const condVal = await resolveExpr(node.cond, ctx, options.namespaces, accessed)
      if (isTruthy(condVal)) {
        const inner = await renderNodes(body, options, filters, accessed, localContext)
        parts.push(inner)
      }
      i = skip + 1 // advance past `end`
      continue
    }

    if (node.kind === 'for') {
      const [body, skip] = collectBlock(nodes, i + 1)
      const iterable = await resolveExpr(node.expr, ctx, options.namespaces, accessed)
      const items = toArray(iterable)
      for (const item of items) {
        const loopCtx = { ...localContext, [node.binding]: item }
        const inner = await renderNodes(body, options, filters, accessed, loopCtx)
        parts.push(inner)
      }
      i = skip + 1
      continue
    }

    // `end` nodes are consumed by the if/for handlers above; reaching one
    // directly means a structural mismatch that the parser should have caught.
    i++
  }

  return parts.join('')
}

/**
 * Resolve an expression string against the context.
 * Supports:
 *   - Simple key: `name` → `ctx['name']`
 *   - Dot path:   `file.name` → `ctx.file?.name`
 *   - Namespace:  `date.today` → `namespaces.date.today()`
 */
async function resolveExpr(
  expr: string,
  ctx: Record<string, unknown>,
  namespaces: NamespaceMap | undefined,
  accessed: Set<string>,
): Promise<unknown> {
  const dotIdx = expr.indexOf('.')
  if (dotIdx !== -1) {
    const ns = expr.slice(0, dotIdx)
    const fn = expr.slice(dotIdx + 1)

    // Namespace dispatch takes priority over context dot-access.
    if (namespaces && ns in namespaces && fn in namespaces[ns]!) {
      accessed.add(expr)
      const result = await (namespaces[ns]![fn]!())
      return result
    }

    // Context dot-access.
    const parent = ctx[ns]
    accessed.add(ns)
    if (parent !== null && parent !== undefined && typeof parent === 'object') {
      return (parent as Record<string, unknown>)[fn]
    }
    return undefined
  }

  accessed.add(expr)
  return ctx[expr]
}

/**
 * Collect the body nodes between an opener and its matching `end`.
 * Returns `[body, endIndex]` where `endIndex` is the position of the `end` node.
 * Assumes the parser already validated block structure.
 */
function collectBlock(nodes: TemplateNode[], from: number): [TemplateNode[], number] {
  const body: TemplateNode[] = []
  let depth = 0
  let i = from
  while (i < nodes.length) {
    const node = nodes[i]!
    if (node.kind === 'if' || node.kind === 'for') {
      depth++
      body.push(node)
    } else if (node.kind === 'end') {
      if (depth === 0) return [body, i]
      depth--
      body.push(node)
    } else {
      body.push(node)
    }
    i++
  }
  // Parser guarantees matching structure; this is unreachable.
  return [body, i]
}

function isTruthy(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0
  return Boolean(v)
}

function toArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v
  if (v === null || v === undefined) return []
  return [v]
}

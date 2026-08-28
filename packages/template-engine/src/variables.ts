/**
 * @scriptor/template-engine — Variable resolver (W2-3)
 *
 * Single canonical resolver for all template variables used in Scriptor.
 * Both the snippet engine (`packages/editor/src/snippets.ts`) and the
 * template evaluator (`eval.ts`) call this module so that `{{date}}`,
 * `{{title}}`, and companions always produce the same string regardless of
 * the surface that invoked them.
 *
 * ## Why this module exists (D1 collapse)
 * Before Wave 2 there were six `{{var}}` snippets in the editor and twenty
 * `${VAR}` tokens in various template helpers, all with subtly different
 * date formatting or capitalisation rules. The collision register (D1)
 * requires exactly one resolver. This file IS that resolver.
 *
 * ## Adding a new variable
 * 1. Add a `ResolverFn` entry to `BUILTIN_VARIABLE_RESOLVERS`.
 * 2. Export its name as part of `BUILTIN_VARIABLE_NAMES`.
 * 3. Add a fixture test in `__tests__/variables.test.ts`.
 *
 * No other file should mint or cache template variable strings.
 */

import { formatLocalDate } from '@scriptor/core/date'

/** A synchronous or async function that returns the variable's value. */
export type ResolverFn = (ctx: VariableContext) => string | Promise<string>

/** Context passed to every resolver. */
export interface VariableContext {
  /** ISO-8601 date string for "today" (YYYY-MM-DD). */
  today: string
  /** Display title of the active note, or empty string. */
  title: string
  /** Vault-relative path of the active note, or empty string. */
  filePath: string
  /** File name without extension, or empty string. */
  fileName: string
  /** Folder path (parent of filePath), or empty string. */
  folder: string
  /** Hostname of the current machine. */
  hostname: string
  /** Custom extension variables — keys are variable names, values are strings. */
  extra: Record<string, string>
}

/** Build a `VariableContext` with sensible defaults for optional fields. */
export function makeVariableContext(partial: Partial<VariableContext>): VariableContext {
  return {
    today:    partial.today    ?? formatLocalDate(),
    title:    partial.title    ?? '',
    filePath: partial.filePath ?? '',
    fileName: partial.fileName ?? '',
    folder:   partial.folder   ?? '',
    hostname: partial.hostname  ?? '',
    extra:    partial.extra    ?? {},
  }
}

// ── Built-in resolvers ────────────────────────────────────────────────────────

export const BUILTIN_VARIABLE_RESOLVERS: ReadonlyMap<string, ResolverFn> = new Map([
  // Date / time
  ['date',      (ctx: VariableContext) => ctx.today],
  ['date.today', (ctx: VariableContext) => ctx.today],
  ['time',      () => new Date().toTimeString().slice(0, 8)],   // HH:MM:SS
  ['datetime',  (ctx: VariableContext) => `${ctx.today}T${new Date().toTimeString().slice(0, 8)}`],

  // File
  ['title',     (ctx: VariableContext) => ctx.title],
  ['file.name', (ctx: VariableContext) => ctx.fileName],
  ['file.path', (ctx: VariableContext) => ctx.filePath],
  ['folder',    (ctx: VariableContext) => ctx.folder],

  // System
  ['hostname',  (ctx: VariableContext) => ctx.hostname],
])

/** All built-in variable names. Pass to template parser or snippet resolver. */
export const BUILTIN_VARIABLE_NAMES: ReadonlySet<string> = new Set(
  BUILTIN_VARIABLE_RESOLVERS.keys(),
)

// ── Resolver ──────────────────────────────────────────────────────────────────

/**
 * Resolve a single variable name to its string value.
 *
 * Look-up order:
 * 1. `ctx.extra[name]` — caller-supplied extension values.
 * 2. Built-in resolvers in `BUILTIN_VARIABLE_RESOLVERS`.
 * 3. Empty string (never throws — unknown variables silently produce `""`).
 */
export async function resolveVariable(
  name: string,
  ctx: VariableContext,
): Promise<string> {
  if (name in ctx.extra) {
    return ctx.extra[name] ?? ''
  }
  const fn = BUILTIN_VARIABLE_RESOLVERS.get(name)
  if (fn) return fn(ctx)
  return ''
}

/**
 * Resolve every known variable name and return a flat `Record<string, string>`
 * suitable for use as the `context` parameter of `evaluate()`.
 */
export async function resolveAllVariables(
  ctx: VariableContext,
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    [...BUILTIN_VARIABLE_RESOLVERS.entries()].map(async ([name, fn]) => [
      name,
      await fn(ctx),
    ] as const),
  )
  const extra = Object.entries(ctx.extra)
  return Object.fromEntries([...entries, ...extra])
}

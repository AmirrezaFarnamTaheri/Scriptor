/**
 * @scriptor/editor — Lint types (W2-5)
 *
 * Every lint rule declares its identity and capabilities through these types.
 * The runner (`run.ts`) and registry (`registry.ts`) operate on these interfaces
 * only — no rule ever calls `editor.dispatch()` directly.
 *
 * # Design invariants
 * - A rule **cannot** mutate inside frontmatter or fenced code blocks (I-8).
 *   The `run.ts` runner enforces this by filtering the `ranges` passed to each
 *   rule so that fenced/frontmatter regions are always excluded.
 * - `fix` is idempotent: `fix(fix(text)) === fix(text)`.
 * - `severity` is declared by the rule; the runner never promotes it.
 */

// ── Severity ──────────────────────────────────────────────────────────────────

export type LintSeverity = 'error' | 'warning' | 'info'

// ── Diagnostic ────────────────────────────────────────────────────────────────

/** A single problem reported by a lint rule for a text range. */
export interface LintDiagnostic {
  /** Stable rule identifier, e.g. `scriptor/no-bare-url`. */
  ruleId: string
  severity: LintSeverity
  /** Human-readable description, shown in the gutter popover. */
  message: string
  /** Inclusive start offset in the document text. */
  from: number
  /** Exclusive end offset. */
  to: number
  /** If present, applying this fix resolves the issue. */
  fix?: LintFix
}

/** A text replacement that fixes a diagnostic. */
export interface LintFix {
  /** Inclusive start of the replacement range. */
  from: number
  /** Exclusive end. */
  to: number
  /** Text to insert (may be empty for a deletion). */
  insert: string
}

// ── Rule ──────────────────────────────────────────────────────────────────────

/**
 * A lint rule. Rules are pure: they receive text and return diagnostics;
 * they never touch the editor state directly.
 */
export interface LintRule {
  /** Stable, namespaced identifier, e.g. `scriptor/missing-heading`. */
  readonly id: string
  readonly severity: LintSeverity
  /** Whether this rule can produce a `LintFix`. */
  readonly fixable: boolean
  /**
   * The description shown in the settings panel.
   * Keep it to one sentence; detail goes in the rule's fixture comment.
   */
  readonly description: string
  /**
   * Analyse `text` over `ranges` and return diagnostics.
   *
   * `ranges` is already filtered to exclude frontmatter and fenced blocks
   * (I-8). Rules must not check outside the provided ranges.
   *
   * @param text    Full document text.
   * @param ranges  Permitted scanning ranges `[from, to]`.
   */
  check(text: string, ranges: ReadonlyArray<readonly [number, number]>): LintDiagnostic[]
}

// ── Utility ───────────────────────────────────────────────────────────────────

/** Apply all fixes from a set of diagnostics to `text` in a single pass. */
export function applyFixes(text: string, diagnostics: LintDiagnostic[]): string {
  const fixes = diagnostics
    .filter(d => d.fix !== undefined)
    .map(d => d.fix!)
    // Apply in reverse order so offsets stay valid.
    .sort((a, b) => b.from - a.from)

  let result = text
  for (const fix of fixes) {
    result = result.slice(0, fix.from) + fix.insert + result.slice(fix.to)
  }
  return result
}

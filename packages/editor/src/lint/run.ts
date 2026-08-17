/**
 * @scriptor/editor — Lint runner (W2-5)
 *
 * Runs registered lint rules over a document text, enforcing invariant I-8:
 * **rules never see inside frontmatter or fenced code blocks**.
 *
 * The runner:
 * 1. Parses frontmatter and fenced-block regions out of the document.
 * 2. Computes the complement: the permitted scanning ranges.
 * 3. Calls each rule's `check(text, ranges)`.
 * 4. Filters out any diagnostic whose `[from, to]` overlaps a protected region
 *    (belt-and-suspenders — rules that ignore `ranges` won't corrupt protected content).
 */

import { getAllRules } from './registry.ts'
import type { LintDiagnostic } from './types.ts'

/** A closed interval `[from, to)` of offsets in the document. */
export type Range = readonly [from: number, to: number]

// ── Public API ────────────────────────────────────────────────────────────────

export interface RunLintOptions {
  /**
   * Override the rule set. Defaults to `getAllRules()`. Useful for tests that
   * register a subset of rules.
   */
  rules?: ReturnType<typeof getAllRules>
}

/**
 * Run all registered lint rules over `text` and return a flat array of
 * diagnostics, sorted by `from` offset.
 *
 * Diagnostics that overlap frontmatter or fenced-block regions are silently
 * dropped (I-8).
 */
export function runLint(text: string, options: RunLintOptions = {}): LintDiagnostic[] {
  const protected_ = protectedRegions(text)
  const permitted   = complement(text.length, protected_)
  const rules = options.rules ?? getAllRules()

  const all: LintDiagnostic[] = []
  for (const rule of rules) {
    const diags = rule.check(text, permitted)
    for (const d of diags) {
      if (!overlapsAny(d.from, d.to, protected_)) {
        all.push(d)
      }
    }
  }
  return all.sort((a, b) => a.from - b.from)
}

// ── Protected-region extraction ───────────────────────────────────────────────

/**
 * Return the set of character ranges that must not be linted:
 * - YAML/TOML frontmatter (`---` … `---` at the start of the file)
 * - Fenced code blocks (` ``` ` … ` ``` ` or `~~~` … `~~~`)
 */
export function protectedRegions(text: string): Range[] {
  const regions: Range[] = []

  // Frontmatter: starts at offset 0 with `---` followed by a newline.
  const fmMatch = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(text)
  if (fmMatch) {
    regions.push([0, fmMatch[0].length])
  }

  // Fenced blocks: ```lang … ``` or ~~~ … ~~~
  const fenceRe = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*(?:\r?\n|$)/gm
  let m: RegExpExecArray | null
  while ((m = fenceRe.exec(text)) !== null) {
    regions.push([m.index, m.index + m[0].length])
  }

  return regions
}

// ── Complement ────────────────────────────────────────────────────────────────

/**
 * Compute the permitted scanning ranges as the complement of `protected_`
 * within `[0, length)`.
 */
function complement(length: number, protected_: Range[]): Range[] {
  const sorted = [...protected_].sort((a, b) => a[0] - b[0])
  const result: Range[] = []
  let cursor = 0
  for (const [from, to] of sorted) {
    if (cursor < from) result.push([cursor, from])
    cursor = Math.max(cursor, to)
  }
  if (cursor < length) result.push([cursor, length])
  return result
}

function overlapsAny(from: number, to: number, regions: Range[]): boolean {
  return regions.some(([rf, rt]) => from < rt && to > rf)
}

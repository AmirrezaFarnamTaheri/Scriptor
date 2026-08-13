/**
 * scriptor/trailing-spaces (W2-6)
 *
 * Trailing whitespace on non-continuation lines (lines that do not end with
 * two spaces — the CommonMark hard line-break) is noise in version control
 * diffs. Fixable: strip trailing spaces from each affected line.
 *
 * Two-space continuation lines (`text  \n`) are explicitly excluded because
 * they carry semantic meaning in CommonMark.
 */

import type { LintRule, LintDiagnostic } from '../types.ts'
import type { Range } from '../run.ts'

// Matches trailing whitespace that is NOT exactly two spaces before `\n`.
// The negative lookbehind `(?<! {2})` excludes CommonMark hard-break sequences.
const TRAILING_RE = /(?<! {2})[ \t]+(?=\r?\n|$)/gm

export const trailingSpaces: LintRule = {
  id: 'scriptor/trailing-spaces',
  severity: 'info',
  fixable: true,
  description: 'Lines should not have trailing whitespace (except two-space hard-breaks).',

  check(text: string, ranges: ReadonlyArray<Range>): LintDiagnostic[] {
    const diags: LintDiagnostic[] = []
    for (const [from, to] of ranges) {
      const slice = text.slice(from, to)
      TRAILING_RE.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = TRAILING_RE.exec(slice)) !== null) {
        const start = from + m.index
        const end   = start + m[0].length
        diags.push({
          ruleId: this.id,
          severity: this.severity,
          message: 'Trailing whitespace.',
          from: start,
          to: end,
          fix: { from: start, to: end, insert: '' },
        })
      }
    }
    return diags
  },
}

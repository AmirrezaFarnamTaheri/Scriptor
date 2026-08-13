/**
 * scriptor/no-double-blank (W2-6)
 *
 * Two or more consecutive blank lines in the body add visual noise without
 * semantic value. Fixable: collapse to a single blank line.
 *
 * Idempotency: `fix(fix(text)) === fix(text)` because after the fix there
 * are no double-blanks remaining.
 */

import type { LintRule, LintDiagnostic } from '../types.ts'
import type { Range } from '../run.ts'

const DOUBLE_BLANK_RE = /\n{3,}/g

export const noDoubleBlank: LintRule = {
  id: 'scriptor/no-double-blank',
  severity: 'info',
  fixable: true,
  description: 'Multiple consecutive blank lines should be collapsed to one.',

  check(text: string, ranges: ReadonlyArray<Range>): LintDiagnostic[] {
    const diags: LintDiagnostic[] = []
    for (const [from, to] of ranges) {
      const slice = text.slice(from, to)
      DOUBLE_BLANK_RE.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = DOUBLE_BLANK_RE.exec(slice)) !== null) {
        const start = from + m.index
        const end   = start + m[0].length
        diags.push({
          ruleId: this.id,
          severity: this.severity,
          message: 'Multiple consecutive blank lines.',
          from: start,
          to: end,
          // Replace N newlines with exactly 2 (one blank line).
          fix: { from: start, to: end, insert: '\n\n' },
        })
      }
    }
    return diags
  },
}

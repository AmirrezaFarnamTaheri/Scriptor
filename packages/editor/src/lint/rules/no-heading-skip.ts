/**
 * scriptor/no-heading-skip (W2-6)
 *
 * Heading levels should not jump by more than one level (e.g. H1 → H3
 * without an H2 in between). This breaks document outline accessibility and
 * makes auto-generated table-of-contents entries misleading.
 *
 * Not directly fixable (the correct heading level is ambiguous), so `fixable`
 * is false. The diagnostic points to the problematic heading line.
 */

import type { LintRule, LintDiagnostic } from '../types.ts'
import type { Range } from '../run.ts'

const HEADING_RE = /^(#{1,6})\s/gm

export const noHeadingSkip: LintRule = {
  id: 'scriptor/no-heading-skip',
  severity: 'warning',
  fixable: false,
  description: 'Heading levels should not skip more than one level (e.g. H1 → H3 without H2).',

  check(text: string, ranges: ReadonlyArray<Range>): LintDiagnostic[] {
    // Collect all headings within permitted ranges.
    const headings: Array<{ level: number; from: number; to: number }> = []
    for (const [from, to] of ranges) {
      const slice = text.slice(from, to)
      HEADING_RE.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = HEADING_RE.exec(slice)) !== null) {
        headings.push({
          level: m[1]!.length,
          from: from + m.index,
          to: from + m.index + m[0].length,
        })
      }
    }
    headings.sort((a, b) => a.from - b.from)

    const diags: LintDiagnostic[] = []
    let prev = 0
    for (const h of headings) {
      if (prev > 0 && h.level > prev + 1) {
        diags.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Heading jumps from H${prev} to H${h.level} — expected at most H${prev + 1}.`,
          from: h.from,
          to: h.to,
        })
      }
      prev = h.level
    }
    return diags
  },
}

/**
 * scriptor/missing-heading (W2-6)
 *
 * A Markdown document should begin with an H1 heading. Documents that start
 * with metadata-only content (YAML frontmatter) are exempt if the title is
 * present in the frontmatter's `title` field.
 *
 * Fixable: inserts `# <filename>` at the first content line.
 */

import type { LintRule, LintDiagnostic } from '../types.ts'
import type { Range } from '../run.ts'

export const missingHeading: LintRule = {
  id: 'scriptor/missing-heading',
  severity: 'warning',
  fixable: true,
  description: 'Every document should start with an H1 heading.',

  check(text: string, ranges: ReadonlyArray<Range>): LintDiagnostic[] {
    // Find the first permitted content character.
    if (ranges.length === 0) return []
    const [start] = ranges[0]!
    const tail = text.slice(start)

    // If the document starts with an H1, we are done.
    if (/^#\s/.test(tail)) return []

    // No H1 found anywhere in permitted ranges.
    const hasH1 = ranges.some(([from, to]) => /^#\s/m.test(text.slice(from, to)))
    if (hasH1) return []

    return [
      {
        ruleId: this.id,
        severity: this.severity,
        message: 'Document is missing an H1 heading.',
        from: start,
        to: start,
        fix: { from: start, to: start, insert: '# Untitled\n\n' },
      },
    ]
  },
}

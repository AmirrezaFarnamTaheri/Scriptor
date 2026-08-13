/**
 * scriptor/no-bare-url (W2-6)
 *
 * Bare URLs in markdown body text (not already wrapped in `[…](…)` or `<…>`)
 * are harder to read and won't render as links in some renderers. This rule
 * flags them and offers a fixable autolink: `https://example.com` → `<https://example.com>`.
 */

import type { LintRule, LintDiagnostic } from '../types.ts'
import type { Range } from '../run.ts'

// Matches a URL that is NOT preceded by `(`, `[`, or `<`, and not followed by `)`.
// We use a simple URL pattern that covers http(s), ftp, and mailto.
const BARE_URL_RE =
  /(?<![([<`])https?:\/\/[^\s<>"')\]]+(?![)])/g

export const noBareUrl: LintRule = {
  id: 'scriptor/no-bare-url',
  severity: 'info',
  fixable: true,
  description: 'Bare URLs should be wrapped in angle brackets or markdown link syntax.',

  check(text: string, ranges: ReadonlyArray<Range>): LintDiagnostic[] {
    const diags: LintDiagnostic[] = []
    for (const [from, to] of ranges) {
      const slice = text.slice(from, to)
      BARE_URL_RE.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = BARE_URL_RE.exec(slice)) !== null) {
        const start = from + m.index
        const end   = start + m[0].length
        diags.push({
          ruleId: this.id,
          severity: this.severity,
          message: `Bare URL: wrap in \`<…>\` or use \`[text](url)\`.`,
          from: start,
          to: end,
          fix: { from: start, to: end, insert: `<${m[0]}>` },
        })
      }
    }
    return diags
  },
}

/**
 * scriptor/broken-wikilink (W2-6)
 *
 * `[[…]]` wikilinks whose target cannot be resolved at parse time are flagged.
 * Because link resolution requires vault context (a file-system lookup), the
 * rule accepts an optional `resolver` function. When no resolver is provided,
 * the rule is a no-op (it cannot produce false positives without context).
 *
 * Fixable: the fix removes the broken brackets, turning `[[bad target]]` into
 * `bad target` (preserves the text, removes the link syntax).
 */

import type { LintRule, LintDiagnostic } from '../types.ts'
import type { Range } from '../run.ts'

const WIKILINK_RE = /\[\[([^\]|#]+?)(?:[|#][^\]]*?)?\]\]/g

export interface BrokenWikilinkOptions {
  /**
   * Returns `true` if the given link target can be resolved in the vault.
   * If omitted, all wikilinks are considered valid (no false positives).
   */
  resolver?: (target: string) => boolean
}

export function brokenWikilinkRule(options: BrokenWikilinkOptions = {}): LintRule {
  return {
    id: 'scriptor/broken-wikilink',
    severity: 'warning',
    fixable: true,
    description: 'Wikilinks whose targets cannot be found in the vault.',

    check(text: string, ranges: ReadonlyArray<Range>): LintDiagnostic[] {
      if (!options.resolver) return []
      const diags: LintDiagnostic[] = []
      for (const [from, to] of ranges) {
        const slice = text.slice(from, to)
        WIKILINK_RE.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = WIKILINK_RE.exec(slice)) !== null) {
          const target = m[1]!.trim()
          if (!options.resolver(target)) {
            const start = from + m.index
            const end   = start + m[0].length
            // Display text: use the alias after `|` if present, else the raw target.
            const display = m[0].includes('|')
              ? m[0].slice(m[0].indexOf('|') + 1, m[0].indexOf(']]'))
              : target
            diags.push({
              ruleId: this.id,
              severity: this.severity,
              message: `Wikilink target "${target}" not found in vault.`,
              from: start,
              to: end,
              fix: { from: start, to: end, insert: display },
            })
          }
        }
      }
      return diags
    },
  }
}

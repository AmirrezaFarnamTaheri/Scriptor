import type { Extension } from '@codemirror/state'
import { linter, type Diagnostic } from '@codemirror/lint'

import { lintMarkdownDocument } from './remark-lint.ts'

/** Remark-lint + Foam link-reference rules for the Problems dock and inline markers. */
export function markdownLintExtension(): Extension {
  return linter((view) => {
    const markdown = view.state.doc.toString()
    const messages = lintMarkdownDocument(markdown)
    return messages.map((message) => {
      const line = view.state.doc.line(message.line)
      const from = line.from + Math.max(0, message.column - 1)
      const to =
        message.endLine != null
          ? view.state.doc.line(message.endLine).to
          : Math.min(line.to, from + 1)
      const severity: Diagnostic['severity'] =
        message.severity === 'error' ? 'error' : message.severity === 'warning' ? 'warning' : 'info'
      return {
        from,
        to: Math.max(from + 1, to),
        severity,
        message: `${message.ruleId}: ${message.message}`,
      }
    })
  })
}

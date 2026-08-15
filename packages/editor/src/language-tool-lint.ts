import { linter, type Diagnostic } from '@codemirror/lint'
import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

import { checkLanguageTool } from './language-tool.ts'
import { languageToolSettings } from './language-tool-config.ts'

export { configureLanguageTool } from './language-tool-config.ts'

async function languageToolDiagnostics(view: EditorView): Promise<Diagnostic[]> {
  const { enabled, endpoint, language } = languageToolSettings()
  if (!enabled) return []
  const text = view.state.doc.toString()
  if (!text.trim()) return []
  try {
    const matches = await checkLanguageTool(text, endpoint, language)
    return matches.map((match) => ({
      from: match.offset,
      to: match.offset + match.length,
      severity: 'warning' as const,
      message: match.message,
      source: `LanguageTool (${match.ruleId})`,
    }))
  } catch {
    return []
  }
}

export function languageToolLintExtension(): Extension {
  return linter(languageToolDiagnostics, { delay: 1200 })
}

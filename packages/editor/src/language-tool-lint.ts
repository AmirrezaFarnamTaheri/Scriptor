import { linter, type Diagnostic } from '@codemirror/lint'
import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

import { checkLanguageTool } from './language-tool.ts'

let endpoint = 'https://api.languagetool.org/v2/check'
let language = 'en-US'
let enabled = false

export function configureLanguageTool(options: {
  enabled?: boolean
  endpoint?: string
  language?: string
}): void {
  if (options.enabled != null) enabled = options.enabled
  if (options.endpoint) endpoint = options.endpoint
  if (options.language) language = options.language
}

async function languageToolDiagnostics(view: EditorView): Promise<Diagnostic[]> {
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

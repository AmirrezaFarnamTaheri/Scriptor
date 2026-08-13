import { useEffect, useMemo, useState } from 'react'

import { lintMarkdownDocument, type EditorLintMessage } from '@scriptor/editor/pure'

interface LintState {
  markdown: string
  messages: EditorLintMessage[]
}

export function useEditorLintProblems(markdown: string, enabled = true): EditorLintMessage[] {
  const [lintState, setLintState] = useState<LintState | null>(null)

  useEffect(() => {
    if (!enabled || !markdown) return
    const requestedMarkdown = markdown
    const timer = window.setTimeout(() => {
      setLintState({
        markdown: requestedMarkdown,
        messages: lintMarkdownDocument(requestedMarkdown),
      })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [enabled, markdown])

  return useMemo(
    () => (enabled && markdown && lintState?.markdown === markdown ? lintState.messages : []),
    [enabled, lintState, markdown],
  )
}

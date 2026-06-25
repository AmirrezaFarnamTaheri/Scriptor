import { useEffect, useMemo, useState } from 'react'

import { lintMarkdownDocument, type EditorLintMessage } from '@scriptor/editor'

export function useEditorLintProblems(markdown: string, enabled = true): EditorLintMessage[] {
  const [messages, setMessages] = useState<EditorLintMessage[]>([])

  useEffect(() => {
    if (!enabled || !markdown) {
      setMessages([])
      return
    }
    const timer = window.setTimeout(() => {
      setMessages(lintMarkdownDocument(markdown))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [enabled, markdown])

  return useMemo(() => messages, [messages])
}

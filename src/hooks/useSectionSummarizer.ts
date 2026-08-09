/**
 * Section Summarizer — AI-powered section summary (opt-in).
 *
 * Extracts the text of the heading that contains `cursorLine`, sends it to
 * the configured AI provider, and returns a Markdown blockquote summary
 * ready for insertion.
 *
 * Nothing is inserted automatically; the caller controls acceptance.
 *
 * The AI call is injected via `proposeDraft` to keep this hook decoupled from
 * the bridge; callers pass in the bound function from `useAiProvider`:
 *   const { proposeDraftFromPrompt } = useAiProvider(...)
 *   useSectionSummarizer(content, toc, cursor, proposeDraftFromPrompt)
 */

import { useState, useCallback } from 'react'
import type { TocEntry } from '@scriptor/editor'

export type SummarizeState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; summary: string }
  | { status: 'error'; message: string }

function extractSectionText(content: string, entry: TocEntry, nextEntry?: TocEntry): string {
  const lines = content.split('\n')
  const start = entry.line - 1
  const end = nextEntry ? nextEntry.line - 2 : lines.length - 1
  return lines.slice(start, end + 1).join('\n').trim()
}

function buildSummarizePrompt(section: string): string {
  return (
    'Summarize the following section in 2-4 concise sentences. ' +
    'Return only the summary text, no preamble.\n\n' +
    '---\n' +
    section
  )
}

/**
 * Hook for summarizing the section under the cursor using the AI provider.
 *
 * @param content        Raw Markdown content of the active note.
 * @param toc            Parsed TOC entries.
 * @param cursorLine     Current editor cursor line (1-indexed).
 * @param proposeDraft   AI call delegate — pass `proposeDraftFromPrompt` from `useAiProvider`.
 *                       Signature: `(prompt: string, currentMarkdown?: string) => Promise<string>`.
 *                       If omitted the hook reports an error rather than throwing.
 */
export function useSectionSummarizer(
  content: string,
  toc: TocEntry[],
  cursorLine: number,
  proposeDraft?: (prompt: string, currentMarkdown: string) => Promise<string>,
) {
  const [state, setState] = useState<SummarizeState>({ status: 'idle' })

  const summarize = useCallback(async () => {
    if (!proposeDraft) {
      setState({ status: 'error', message: 'No AI provider is configured.' })
      return
    }

    // Find the heading that contains cursorLine
    let activeEntry: TocEntry | undefined
    for (const entry of toc) {
      if (entry.line <= cursorLine) activeEntry = entry
      else break
    }
    if (!activeEntry) {
      setState({ status: 'error', message: 'No heading found at cursor position.' })
      return
    }
    const nextEntry = toc[toc.indexOf(activeEntry) + 1]
    const sectionText = extractSectionText(content, activeEntry, nextEntry)

    if (sectionText.split(/\s+/).length < 10) {
      setState({ status: 'error', message: 'Section is too short to summarize.' })
      return
    }

    setState({ status: 'loading' })
    try {
      const prompt = buildSummarizePrompt(sectionText)
      const result = await proposeDraft(prompt, content)
      const summary = `> **Summary:** ${result.trim()}`
      setState({ status: 'done', summary })
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'AI provider failed to respond.',
      })
    }
  }, [content, toc, cursorLine, proposeDraft])

  const reset = useCallback(() => setState({ status: 'idle' }), [])

  return { state, summarize, reset }
}
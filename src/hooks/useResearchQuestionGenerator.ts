/**
 * useResearchQuestionGenerator
 * -----------------------------
 * Given a selected text, asks the AI provider to generate follow-up research
 * questions. The questions are returned as GFM task list items (`- [ ] ...`)
 * ready for insertion into the note at the caller's discretion.
 *
 * The hook does NOT modify the document; the caller decides where to insert.
 *
 * Usage:
 *  ```tsx
 *  const { state, generate, reset } = useResearchQuestionGenerator(proposeDraft)
 *  // Call generate(selectedText) on right-click
 *  // state.status === 'done' → render state.questions for user to choose
 *  // On accept: editor.insertSnippet(state.taskListMarkdown)
 *  ```
 */

import { useState, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResearchQState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; questions: string[]; taskListMarkdown: string }
  | { status: 'error'; message: string }

export interface ResearchQuestionGeneratorResult {
  state: ResearchQState
  generate: (selectedText: string) => Promise<void>
  reset: () => void
}

// ---------------------------------------------------------------------------
// Prompt & parsing
// ---------------------------------------------------------------------------

function buildPrompt(text: string): string {
  return (
    'You are a research assistant. Based on the following excerpt, generate 4-6 specific, ' +
    'actionable follow-up research questions that would deepen understanding of the topic. ' +
    'Return ONLY a JSON array of question strings, no other text. ' +
    'Example: ["What are the main limitations of X?","How does Y compare to Z in the context of W?"]\n\n' +
    `---\n${text.slice(0, 3000)}`
  )
}

function parseQuestions(raw: string): string[] {
  try {
    const match = raw.match(/\[[\s\S]*?\]/)
    if (!match) return []
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((q): q is string => typeof q === 'string')
      .map((q) => q.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

function toTaskList(questions: string[]): string {
  return questions.map((q) => `- [ ] ${q}`).join('\n')
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * @param proposeDraft  AI call delegate from `useAiProvider.proposeDraftFromPrompt`.
 */
export function useResearchQuestionGenerator(
  proposeDraft?: (prompt: string, currentMarkdown: string) => Promise<string>,
): ResearchQuestionGeneratorResult {
  const [state, setState] = useState<ResearchQState>({ status: 'idle' })

  const generate = useCallback(
    async (selectedText: string) => {
      if (!proposeDraft) {
        setState({ status: 'error', message: 'No AI provider is configured.' })
        return
      }
      if (!selectedText.trim()) {
        setState({ status: 'error', message: 'No text is selected.' })
        return
      }
      if (selectedText.trim().split(/\s+/).length < 10) {
        setState({ status: 'error', message: 'Selection is too short to generate questions.' })
        return
      }

      setState({ status: 'loading' })
      try {
        const prompt = buildPrompt(selectedText.trim())
        const raw = await proposeDraft(prompt, selectedText)
        const questions = parseQuestions(raw)
        if (questions.length === 0) {
          setState({ status: 'error', message: 'AI did not return valid questions.' })
          return
        }
        setState({ status: 'done', questions, taskListMarkdown: toTaskList(questions) })
      } catch (err) {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'AI provider failed to respond.',
        })
      }
    },
    [proposeDraft],
  )

  const reset = useCallback(() => setState({ status: 'idle' }), [])

  return { state, generate, reset }
}

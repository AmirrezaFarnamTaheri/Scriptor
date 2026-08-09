/**
 * useRephraseSelection
 * ---------------------
 * Sends a selected text range to the AI provider for rephrasing, returning
 * the original and proposed texts as a diff for the user to accept or reject.
 *
 * Modes:
 *  - 'formal'   — more professional and authoritative tone
 *  - 'casual'   — conversational and approachable
 *  - 'shorter'  — reduce length while preserving meaning
 *  - 'longer'   — expand with additional context and detail
 *  - 'clearer'  — simplify sentence structure and vocabulary
 *
 * The hook does NOT modify the document. The caller receives the proposed text
 * and decides whether to apply it (e.g. via `editor.insertSnippet`).
 */

import { useState, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RephraseMode = 'formal' | 'casual' | 'shorter' | 'longer' | 'clearer'

export type RephraseState =
  | { status: 'idle' }
  | { status: 'loading'; mode: RephraseMode }
  | { status: 'done'; original: string; proposed: string; mode: RephraseMode }
  | { status: 'error'; message: string }

export interface RephraseSelectionResult {
  state: RephraseState
  rephrase: (selectedText: string, mode: RephraseMode) => Promise<void>
  reset: () => void
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

const modeInstructions: Record<RephraseMode, string> = {
  formal:
    'Rewrite the following text in a formal, authoritative, and professional tone. ' +
    'Maintain the original meaning. Return only the rewritten text, no explanation.',
  casual:
    'Rewrite the following text in a friendly, conversational, and approachable tone. ' +
    'Maintain the original meaning. Return only the rewritten text, no explanation.',
  shorter:
    'Shorten the following text significantly while preserving the core meaning. ' +
    'Remove filler, redundancy, and verbose phrases. Return only the shortened text, no explanation.',
  longer:
    'Expand the following text with additional relevant context, examples, and detail. ' +
    'Keep the same topic and meaning. Return only the expanded text, no explanation.',
  clearer:
    'Rewrite the following text using simpler sentence structure and vocabulary to improve clarity. ' +
    'Maintain the original meaning. Return only the rewritten text, no explanation.',
}

function buildRephrasePrompt(text: string, mode: RephraseMode): string {
  return `${modeInstructions[mode]}\n\n---\n${text}`
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * @param proposeDraft  AI call delegate from `useAiProvider.proposeDraftFromPrompt`.
 *                      Pass `undefined` to get a graceful "not configured" error.
 */
export function useRephraseSelection(
  proposeDraft?: (prompt: string, currentMarkdown: string) => Promise<string>,
): RephraseSelectionResult {
  const [state, setState] = useState<RephraseState>({ status: 'idle' })

  const rephrase = useCallback(
    async (selectedText: string, mode: RephraseMode) => {
      if (!proposeDraft) {
        setState({ status: 'error', message: 'No AI provider is configured.' })
        return
      }
      if (!selectedText.trim()) {
        setState({ status: 'error', message: 'No text is selected.' })
        return
      }
      if (selectedText.trim().split(/\s+/).length < 3) {
        setState({ status: 'error', message: 'Selection is too short to rephrase.' })
        return
      }

      setState({ status: 'loading', mode })
      try {
        const prompt = buildRephrasePrompt(selectedText.trim(), mode)
        const proposed = await proposeDraft(prompt, selectedText)
        setState({ status: 'done', original: selectedText.trim(), proposed: proposed.trim(), mode })
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

  return { state, rephrase, reset }
}

/**
 * useSmartTagSuggestions
 * ----------------------
 * After a debounce following a note save, sends the note content to the AI
 * provider to suggest relevant tags. Suggestions are returned as dismissable
 * candidates — they are NEVER auto-applied.
 *
 * Usage:
 *  ```tsx
 *  const { suggestions, isPending, dismiss, accept, trigger } =
 *    useSmartTagSuggestions({ content, existingTags, proposeDraft })
 *
 *  // On note save, call trigger()
 *  // Render suggestions as dismissable chips, call accept(tag) to get the string
 *  ```
 */

import { useState, useCallback, useRef, useEffect } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TagSuggestion {
  tag: string
  /** Whether the user has explicitly dismissed this suggestion. */
  dismissed: boolean
}

export interface SmartTagSuggestionsConfig {
  /** Raw Markdown content of the active note. */
  content: string
  /** Tags already attached to the note (frontmatter). */
  existingTags?: readonly string[]
  /** AI provider callback (from useAiProvider.proposeDraftFromPrompt). */
  proposeDraft?: (prompt: string, currentMarkdown: string) => Promise<string>
  /** Debounce after trigger (ms). Default: 3000 */
  debounceMs?: number
  /** Maximum number of suggested tags to show. Default: 6 */
  maxSuggestions?: number
}

export interface SmartTagSuggestionsResult {
  /** Current pending suggestions (not dismissed). */
  suggestions: TagSuggestion[]
  /** True while the AI call is in flight. */
  isPending: boolean
  /** Error message if the last AI call failed. */
  error?: string
  /** Dismiss a specific suggestion so it won't appear. */
  dismiss: (tag: string) => void
  /** Accept a suggestion (returns the tag string for the caller to apply). */
  accept: (tag: string) => string
  /** Dismiss all current suggestions. */
  dismissAll: () => void
  /** Manually trigger a suggestion refresh. */
  trigger: () => void
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildTagPrompt(content: string, existingTags: readonly string[], max: number): string {
  const existingStr = existingTags.length ? `Existing tags: ${existingTags.join(', ')}. ` : ''
  return (
    `You are a tagging assistant for a Markdown note-taking app. ${existingStr}` +
    `Suggest up to ${max} relevant tags for the following note content. ` +
    `Return ONLY a JSON array of lowercase hyphen-separated tag strings, no other text. ` +
    `Example: ["machine-learning","python","neural-networks"]\n\n` +
    `---\n${content.slice(0, 4000)}`
  )
}

function parseTagsFromResponse(raw: string): string[] {
  try {
    // Extract the first JSON array from the response
    const match = raw.match(/\[[\s\S]*?\]/)
    if (!match) return []
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim().toLowerCase().replace(/\s+/g, '-'))
      .filter(Boolean)
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSmartTagSuggestions(config: SmartTagSuggestionsConfig): SmartTagSuggestionsResult {
  const {
    content,
    existingTags = [],
    proposeDraft,
    debounceMs = 3000,
    maxSuggestions = 6,
  } = config

  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([])
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef(content)
  useEffect(() => {
    contentRef.current = content
  }, [content])

  const fetchSuggestions = useCallback(async () => {
    if (!proposeDraft) {
      setError('No AI provider is configured.')
      return
    }
    const snap = contentRef.current
    if (snap.trim().split(/\s+/).length < 20) {
      // Too short to get meaningful tag suggestions
      return
    }

    setIsPending(true)
    setError(undefined)
    try {
      const prompt = buildTagPrompt(snap, existingTags, maxSuggestions)
      const raw = await proposeDraft(prompt, snap)
      const tags = parseTagsFromResponse(raw)
        .filter((t) => !existingTags.includes(t))
        .slice(0, maxSuggestions)

      setSuggestions(tags.map((tag) => ({ tag, dismissed: false })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI provider failed to respond.')
    } finally {
      setIsPending(false)
    }
  }, [proposeDraft, existingTags, maxSuggestions])

  const trigger = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(fetchSuggestions, debounceMs)
  }, [fetchSuggestions, debounceMs])

  const dismiss = useCallback((tag: string) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.tag === tag ? { ...s, dismissed: true } : s)),
    )
  }, [])

  const dismissAll = useCallback(() => {
    setSuggestions((prev) => prev.map((s) => ({ ...s, dismissed: true })))
  }, [])

  const accept = useCallback((tag: string) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.tag === tag ? { ...s, dismissed: true } : s)),
    )
    return tag
  }, [])

  return {
    suggestions: suggestions.filter((s) => !s.dismissed),
    isPending,
    error,
    dismiss,
    accept,
    dismissAll,
    trigger,
  }
}

import { useDeferredValue, useMemo } from 'react'
import { countWords, countCharacters } from '@scriptor/editor/pure'
import type { NoteDocument } from '../types/vault'

export interface UseNoteDraftStatsOptions {
  draftMarkdown: string
  activeNote: NoteDocument | null
  isNoteDirty: boolean
}

export interface NoteDraftStats {
  draftWordCount: number
  savedWordCount: number
  wordCountDelta: number
  charCount: number
  readingMinutes: number
}

export function useNoteDraftStats({
  draftMarkdown,
  activeNote,
  isNoteDirty,
}: UseNoteDraftStatsOptions): NoteDraftStats {
  // Stats are derived from the deferred draft: typing renders immediately at
  // high priority and the scans re-run at lower priority a frame later, so a
  // large note never pays its word/character scan inside the keystroke frame.
  const deferredDraft = useDeferredValue(draftMarkdown)
  const draftWordCount = useMemo(() => countWords(deferredDraft), [deferredDraft])
  const charCount = useMemo(() => countCharacters(deferredDraft), [deferredDraft])

  // The saved baseline must use the same semantic word definition as the
  // draft. The persisted native metadata count is a naive whitespace split
  // that counts Markdown structure ("#", "-", "|", "|--|") as words, so
  // mixing the two made the status-bar delta and reading time meaningless
  // for Markdown-heavy notes.
  const savedMarkdown = activeNote?.markdown ?? ''
  const savedWordCount = useMemo(() => countWords(savedMarkdown), [savedMarkdown])
  const savedReadingMinutes =
    savedWordCount === 0 ? 0 : Math.max(1, Math.ceil(savedWordCount / 200))

  const draftReadingMinutes = draftWordCount === 0 ? 0 : Math.max(1, Math.ceil(draftWordCount / 200))
  const readingMinutes = isNoteDirty ? draftReadingMinutes : savedReadingMinutes
  const wordCountDelta = isNoteDirty ? draftWordCount - savedWordCount : 0

  return {
    draftWordCount,
    savedWordCount,
    wordCountDelta,
    charCount,
    readingMinutes,
  }
}

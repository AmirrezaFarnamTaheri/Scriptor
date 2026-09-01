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

  const savedWordCount = activeNote?.metadata.word_count ?? 0
  const savedReadingMinutes = activeNote?.metadata.reading_time_minutes ?? 0

  const draftReadingMinutes = draftWordCount === 0 ? 0 : Math.max(1, Math.floor(draftWordCount / 200))
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

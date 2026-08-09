import { useMemo } from 'react'
import { countWords, countCharacters } from '@scriptor/core/utils/countWords'
import type { NoteWithMetadata } from '@scriptor/core/types'

export interface UseNoteDraftStatsOptions {
  draftMarkdown: string
  activeNote: NoteWithMetadata | null
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
  const draftWordCount = useMemo(() => countWords(draftMarkdown), [draftMarkdown])
  const charCount = useMemo(() => countCharacters(draftMarkdown), [draftMarkdown])

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

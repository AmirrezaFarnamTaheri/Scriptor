import type { NoteIndexSummary } from '../../types/vault'

export type InboxPeriod = 'week' | 'month' | 'quarter' | 'all'

export type { NoteIndexSummary }

export function isInboxEntry(note: NoteIndexSummary): boolean {
  if (note.archived) return false
  if (note.note_type === 'Type') return false
  return !note.organized
}

export function filterInboxEntries(notes: NoteIndexSummary[], period: InboxPeriod): NoteIndexSummary[] {
  const periodDays: Record<InboxPeriod, number | null> = {
    week: 7,
    month: 30,
    quarter: 90,
    all: null,
  }
  const days = periodDays[period]
  const cutoff =
    days == null
      ? null
      : new Date(Date.now() - days * 86_400_000).toISOString()

  return notes
    .filter(isInboxEntry)
    .filter((note) => (cutoff ? note.modified_at >= cutoff : true))
    .sort((left, right) => right.modified_at.localeCompare(left.modified_at))
}

export function nextInboxEntryAfter(notes: NoteIndexSummary[], currentPath: string): NoteIndexSummary | null {
  const index = notes.findIndex((note) => note.path === currentPath)
  if (index < 0) return null
  return notes[index + 1] ?? null
}

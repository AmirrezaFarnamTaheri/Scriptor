import assert from 'node:assert/strict'
import { test } from 'node:test'

import { filterInboxEntries, isInboxEntry, nextInboxEntryAfter } from './knowledge/inbox.ts'
import { defaultInstancePath, discoverNoteTypes } from './knowledge/noteTypes.ts'
import { discoverTemplatePaths, planDailyNotePreview } from './knowledge/templates.ts'
import type { NoteIndexSummary } from '../types/vault.ts'

function summary(partial: Partial<NoteIndexSummary> & Pick<NoteIndexSummary, 'path' | 'title'>): NoteIndexSummary {
  return {
    modified_at: '2026-06-20T12:00:00.000Z',
    note_type: null,
    organized: false,
    archived: false,
    tags: [],
    ...partial,
  }
}

test('isInboxEntry excludes organized, archived, and type definitions', () => {
  assert.equal(isInboxEntry(summary({ path: 'a.md', title: 'A', organized: true })), false)
  assert.equal(isInboxEntry(summary({ path: 'a.md', title: 'A', archived: true })), false)
  assert.equal(isInboxEntry(summary({ path: 'type/Note.md', title: 'Note', note_type: 'Type' })), false)
  assert.equal(isInboxEntry(summary({ path: 'inbox/a.md', title: 'A' })), true)
})

test('filterInboxEntries sorts newest first and respects period', () => {
  // Dates are relative to now so the period filter stays deterministic over
  // time; a hardcoded fixture ages out of the rolling window and breaks.
  // Freeze Date.now first so the relative fixtures are anchored to the mocked
  // clock rather than the real wall clock at test time.
  const originalNow = Date.now
  Date.now = () => Date.parse('2026-06-23T12:00:00.000Z')
  try {
    const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()
    const notes = [
      summary({ path: 'old.md', title: 'Old', modified_at: daysAgo(60) }),
      summary({ path: 'new.md', title: 'New', modified_at: daysAgo(2) }),
      summary({ path: 'done.md', title: 'Done', organized: true, modified_at: daysAgo(1) }),
    ]
    const week = filterInboxEntries(notes, 'week')
    assert.deepEqual(week.map((note) => note.path), ['new.md'])
    const all = filterInboxEntries(notes, 'all')
    assert.deepEqual(all.map((note) => note.path), ['new.md', 'old.md'])
  } finally {
    Date.now = originalNow
  }
})

test('nextInboxEntryAfter returns the following inbox row', () => {
  const notes = [
    summary({ path: 'a.md', title: 'A' }),
    summary({ path: 'b.md', title: 'B' }),
    summary({ path: 'c.md', title: 'C' }),
  ]
  assert.equal(nextInboxEntryAfter(notes, 'a.md')?.path, 'b.md')
  assert.equal(nextInboxEntryAfter(notes, 'c.md'), null)
})

test('discoverNoteTypes lists type definitions from summaries', () => {
  const types = discoverNoteTypes(
    [
      summary({ path: 'type/Meeting.md', title: 'Meeting', note_type: 'Type' }),
      summary({ path: 'notes/a.md', title: 'A' }),
    ],
    'type',
  )
  assert.deepEqual(types, [{ name: 'Meeting', path: 'type/Meeting.md' }])
})

test('defaultInstancePath namespaces instances by type', () => {
  assert.equal(defaultInstancePath('Meeting', 'Standup'), 'Meeting/Standup.md')
})

test('discoverTemplatePaths lists markdown files in templates directory', () => {
  const templates = discoverTemplatePaths(
    [
      { path: '.scriptor/templates/daily.md', kind: 'note', size_bytes: 1 },
      { path: '.scriptor/templates/meeting.md', kind: 'note', size_bytes: 1 },
      { path: 'notes/other.md', kind: 'note', size_bytes: 1 },
    ],
    '.scriptor/templates',
  )
  assert.deepEqual(templates.map((entry) => entry.path), [
    '.scriptor/templates/daily.md',
    '.scriptor/templates/meeting.md',
  ])
})

test('planDailyNotePreview resolves path and title tokens', () => {
  const preview = planDailyNotePreview(
    {
      directory: 'journal',
      filename_format: '{year}-{month}-{day}',
      title_format: 'Journal {iso}',
    },
    '2026-06-23',
  )
  assert.equal(preview.path, 'journal/2026-06-23.md')
  assert.equal(preview.title, 'Journal 2026-06-23')
})

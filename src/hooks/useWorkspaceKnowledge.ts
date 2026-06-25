import { useMemo } from 'react'

import type { NoteIndexSummary, ScannedEntry, VaultConfig } from '../types/vault'
import { filterInboxEntries } from '../lib/knowledge/inbox'
import { discoverNoteTypes } from '../lib/knowledge/noteTypes'
import { discoverTemplatePaths } from '../lib/knowledge/templates'

export function useWorkspaceKnowledge(
  noteSummaries: NoteIndexSummary[],
  entries: ScannedEntry[],
  vaultConfig: VaultConfig,
) {
  const inboxNotes = useMemo(() => {
    const period = vaultConfig.inbox?.period ?? 'all'
    return filterInboxEntries(noteSummaries, period)
  }, [noteSummaries, vaultConfig.inbox?.period])

  const noteTypes = useMemo(
    () => discoverNoteTypes(noteSummaries, vaultConfig.note_types?.directory ?? 'type'),
    [noteSummaries, vaultConfig.note_types?.directory],
  )

  const templatePaths = useMemo(
    () => discoverTemplatePaths(entries, vaultConfig.templates_directory ?? '.scriptor/templates'),
    [entries, vaultConfig.templates_directory],
  )

  return {
    inboxNotes,
    noteTypes,
    templatePaths,
  }
}

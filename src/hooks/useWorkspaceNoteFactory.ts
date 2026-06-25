import { useCallback } from 'react'

import {
  indexerUpdateNote,
  vaultBuildNoteMarkdown,
  vaultFrontmatterSet,
  vaultLoadTemplate,
  vaultPlanDailyNote,
  vaultReadNote,
  vaultSaveNote,
} from '../bridge/commands'
import type { NoteIndexSummary, VaultConfig, VaultDescriptor } from '../types/vault'
import type { ActivityEntry } from './useActivityLog'
import { nextInboxEntryAfter } from '../lib/knowledge/inbox'
import { offsetIsoDate } from '../lib/knowledge/dailyNote'
import { defaultNotePath } from './vault/helpers'

interface NoteTypeEntry {
  name: string
  path: string
}

interface UseWorkspaceNoteFactoryOptions {
  vault: VaultDescriptor | null
  vaultConfig: VaultConfig
  activePath: string | null
  sidebarView: 'vault' | 'inbox'
  setSidebarView: (view: 'vault' | 'inbox') => void
  inboxNotes: NoteIndexSummary[]
  noteTypes: NoteTypeEntry[]
  setError: React.Dispatch<React.SetStateAction<string | null>>
  logActivity: (kind: ActivityEntry['kind'], message: string, detail?: string) => void
  refreshVaultCore: () => Promise<void>
  refreshNoteSummaries: () => Promise<void>
  openNote: (path: string) => Promise<void>
  syncActiveNoteContent: (path: string) => Promise<void>
}

export function useWorkspaceNoteFactory({
  vault,
  vaultConfig,
  activePath,
  sidebarView,
  setSidebarView,
  inboxNotes,
  noteTypes,
  setError,
  logActivity,
  refreshVaultCore,
  refreshNoteSummaries,
  openNote,
  syncActiveNoteContent,
}: UseWorkspaceNoteFactoryOptions) {
  const organizeNote = useCallback(
    async (path: string) => {
      if (!vault) return
      const next =
        vaultConfig.workflow?.auto_advance_inbox_after_organize && sidebarView === 'inbox' && activePath === path
          ? nextInboxEntryAfter(inboxNotes, path)
          : null
      try {
        await vaultFrontmatterSet(path, '_organized', 'true')
        await indexerUpdateNote(path)
        await refreshNoteSummaries()
        if (activePath === path) {
          await syncActiveNoteContent(path)
        }
        if (next) {
          await openNote(next.path)
        }
        logActivity('success', 'Note organized', path)
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        setError(message)
        logActivity('error', 'Failed to organize note', message)
      }
    },
    [
      activePath,
      inboxNotes,
      logActivity,
      openNote,
      refreshNoteSummaries,
      setError,
      sidebarView,
      syncActiveNoteContent,
      vault,
      vaultConfig.workflow?.auto_advance_inbox_after_organize,
    ],
  )

  const createNoteOfType = useCallback(
    async (typeName: string, title?: string) => {
      if (!vault) {
        setError('Open a vault before creating a note.')
        return
      }
      const noteTitle = title?.trim() || `${typeName} ${new Date().toISOString().slice(0, 10)}`
      const typeDef = noteTypes.find((entry) => entry.name === typeName)
      let templateBody: string | undefined
      if (typeDef) {
        try {
          const doc = await vaultReadNote(typeDef.path)
          const match = doc.markdown.match(/^---[\s\S]*?template:\s*\|\s*\n([\s\S]*?)\n---/m)
          templateBody = match?.[1]?.trim()
        } catch {
          templateBody = undefined
        }
      }
      const pathBase = vaultConfig.inbox?.new_note_directory?.trim()
      const fileName = defaultNotePath(noteTitle)
      const path = pathBase ? `${pathBase.replace(/\/$/, '')}/${fileName}` : fileName
      const markdown = await vaultBuildNoteMarkdown(noteTitle.replace(/\.md$/i, ''), typeName, templateBody ?? null)
      setError(null)
      try {
        await vaultSaveNote(path, markdown)
        await indexerUpdateNote(path)
        await refreshVaultCore()
        await openNote(path)
        if (vaultConfig.inbox?.enabled !== false) {
          setSidebarView('inbox')
        }
        logActivity('success', `Created ${typeName} note`, path)
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        setError(message)
        logActivity('error', 'Failed to create typed note', message)
      }
    },
    [logActivity, noteTypes, openNote, refreshVaultCore, setError, setSidebarView, vault, vaultConfig.inbox],
  )

  const createNoteFromTemplate = useCallback(
    async (templatePath: string, title?: string) => {
      if (!vault) return
      const noteTitle = title?.trim() || `Untitled ${new Date().toISOString().slice(0, 10)}`
      try {
        const template = await vaultLoadTemplate(templatePath)
        const path = defaultNotePath(noteTitle)
        const markdown = await vaultBuildNoteMarkdown(noteTitle.replace(/\.md$/i, ''), null, template)
        await vaultSaveNote(path, markdown)
        await indexerUpdateNote(path)
        await refreshVaultCore()
        await openNote(path)
        logActivity('success', 'Note created from template', templatePath)
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        setError(message)
        logActivity('error', 'Template note creation failed', message)
      }
    },
    [logActivity, openNote, refreshVaultCore, setError, vault],
  )

  const createDailyNoteForOffset = useCallback(
    async (dayOffset = 0) => {
      if (!vault) return
      const iso = offsetIsoDate(new Date().toISOString().slice(0, 10), dayOffset)
      try {
        const plan = await vaultPlanDailyNote(iso)
        try {
          await vaultReadNote(plan.path)
          await openNote(plan.path)
          return
        } catch {
          // create below
        }
        await vaultSaveNote(plan.path, plan.markdown)
        await indexerUpdateNote(plan.path)
        await refreshVaultCore()
        await openNote(plan.path)
        logActivity('success', dayOffset === 0 ? 'Daily note created' : `Daily note for ${iso}`, plan.path)
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        setError(message)
      }
    },
    [logActivity, openNote, refreshVaultCore, setError, vault],
  )

  const createNote = useCallback(
    async (title?: string) => {
      if (!vault) {
        setError('Open a vault before creating a note.')
        return
      }

      const noteTitle = title?.trim() || `Untitled ${new Date().toISOString().slice(0, 10)}`
      const pathBase = vaultConfig.inbox?.new_note_directory?.trim()
      const fileName = defaultNotePath(noteTitle)
      const path = pathBase ? `${pathBase.replace(/\/$/, '')}/${fileName}` : fileName
      const markdown = await vaultBuildNoteMarkdown(noteTitle.replace(/\.md$/i, ''), null, null)

      setError(null)
      try {
        await vaultSaveNote(path, markdown)
        await indexerUpdateNote(path)
        await refreshVaultCore()
        await openNote(path)
        if (vaultConfig.inbox?.enabled !== false) {
          setSidebarView('inbox')
        }
        logActivity('success', 'Note created', path)
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        setError(message)
        logActivity('error', 'Failed to create note', message)
      }
    },
    [logActivity, openNote, refreshVaultCore, setError, setSidebarView, vault, vaultConfig.inbox],
  )

  const createNoteFromWikilink = useCallback(
    async (target: string) => {
      if (!vault) {
        setError('Open a vault before creating a note.')
        return
      }

      const normalized = target.trim()
      if (!normalized) {
        setError('Wikilink target is empty.')
        return
      }

      const path = defaultNotePath(normalized)
      const title = normalized.replace(/\.md$/i, '')
      const markdown = `# ${title}\n\n`

      setError(null)
      try {
        await vaultSaveNote(path, markdown)
        await indexerUpdateNote(path)
        await refreshVaultCore()
        await openNote(path)
        logActivity('success', 'Note created from wikilink', path)
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        setError(message)
        logActivity('error', 'Failed to create note from wikilink', message)
      }
    },
    [logActivity, openNote, refreshVaultCore, setError, vault],
  )

  const createDailyNote = useCallback(async () => {
    await createDailyNoteForOffset(0)
  }, [createDailyNoteForOffset])

  return {
    organizeNote,
    createNoteOfType,
    createNoteFromTemplate,
    createDailyNoteForOffset,
    createNote,
    createNoteFromWikilink,
    createDailyNote,
  }
}

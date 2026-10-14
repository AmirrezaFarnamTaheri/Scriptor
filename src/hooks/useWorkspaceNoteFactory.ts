import { useCallback } from 'react'
import { formatLocalDate } from '@scriptor/core/date'

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

const EXPECTED_MISSING_CONTENT_HASH = '<missing>'

const MAX_NEW_NOTE_FILENAME_ATTEMPTS = 32

/** Atomically choose an unused name for ordinary New commands. Caller-bound imports stay strict. */
async function saveNewNoteWithUniqueName(basePath: string, markdown: string, vaultId: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_NEW_NOTE_FILENAME_ATTEMPTS; attempt += 1) {
    const path = attempt === 0 ? basePath : basePath.replace(/\.md$/i, ' (' + (attempt + 1) + ').md')
    try {
      await vaultSaveNote(path, markdown, EXPECTED_MISSING_CONTENT_HASH, undefined, vaultId)
      return path
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      if (!/content hash mismatch/i.test(detail) || !detail.includes('expected <missing>')) throw error
    }
  }
  throw new Error('Could not create a uniquely named note. Choose a different title.')
}


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
  openNote: (path: string, isCurrent?: () => boolean) => Promise<unknown>
  syncActiveNoteContent: (path: string) => Promise<void>
  /** Monotone vault-open generation used to invalidate in-flight work. */
  getVaultGeneration?: () => number
}

export interface CreateNoteOptions {
  /** New-note writes require an absent destination by default; only explicit false allows replacement. */
  requireMissing?: boolean
  /** Suppress obsolete post-save navigation after the originating workspace changes. */
  isCurrent?: () => boolean
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
  getVaultGeneration,
}: UseWorkspaceNoteFactoryOptions) {
  const operationOwner = useCallback(() => {
    const generation = getVaultGeneration?.()
    return () => generation === undefined || getVaultGeneration?.() === generation
  }, [getVaultGeneration])

  const organizeNote = useCallback(
    async (path: string) => {
      if (!vault) return
      const isCurrent = operationOwner()
      const next =
        vaultConfig.workflow?.auto_advance_inbox_after_organize && sidebarView === 'inbox' && activePath === path
          ? nextInboxEntryAfter(inboxNotes, path)
          : null
      try {
        if (!isCurrent()) return
        await vaultFrontmatterSet(path, '_organized', 'true', undefined, vault.id)
        if (!isCurrent()) return
        await indexerUpdateNote(path)
        if (!isCurrent()) return
        await refreshNoteSummaries()
        if (!isCurrent()) return
        if (activePath === path) {
          await syncActiveNoteContent(path)
          if (!isCurrent()) return
        }
        if (next) {
          await openNote(next.path, isCurrent)
          if (!isCurrent()) return
        }
        logActivity('success', 'Note organized', path)
      } catch (caught) {
        if (!isCurrent()) return
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
      operationOwner,
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
      const isCurrent = operationOwner()
      const noteTitle = title?.trim() || `${typeName} ${formatLocalDate()}`
      const typeDef = noteTypes.find((entry) => entry.name === typeName)
      let templateBody: string | undefined
      if (typeDef) {
        try {
          const doc = await vaultReadNote(typeDef.path)
          if (!isCurrent()) return
          const match = doc.markdown.match(/^---[\s\S]*?template:\s*\|\s*\n([\s\S]*?)\n---/m)
          templateBody = match?.[1]?.trim()
        } catch {
          templateBody = undefined
        }
      }
      const pathBase = vaultConfig.inbox?.new_note_directory?.trim()
      const fileName = defaultNotePath(noteTitle)
      const path = pathBase ? `${pathBase.replace(/\/$/, '')}/${fileName}` : fileName
      if (!isCurrent()) return
      const markdown = await vaultBuildNoteMarkdown(noteTitle.replace(/\.md$/i, ''), typeName, templateBody ?? null)
      if (!isCurrent()) return
      setError(null)
      try {
        const createdPath = await saveNewNoteWithUniqueName(path, markdown, vault.id)
        if (!isCurrent()) return
        await indexerUpdateNote(createdPath)
        if (!isCurrent()) return
        await refreshVaultCore()
        if (!isCurrent()) return
        await openNote(createdPath, isCurrent)
        if (!isCurrent()) return
        if (vaultConfig.inbox?.enabled !== false) {
          setSidebarView('inbox')
        }
        logActivity('success', `Created ${typeName} note`, createdPath)
      } catch (caught) {
        if (!isCurrent()) return
        const message = caught instanceof Error ? caught.message : String(caught)
        setError(message)
        logActivity('error', 'Failed to create typed note', message)
      }
    },
    [logActivity, noteTypes, openNote, operationOwner, refreshVaultCore, setError, setSidebarView, vault, vaultConfig.inbox],
  )

  const createNoteFromTemplate = useCallback(
    async (templatePath: string, title?: string) => {
      if (!vault) return
      const isCurrent = operationOwner()
      const noteTitle = title?.trim() || `Untitled ${formatLocalDate()}`
      try {
        const template = await vaultLoadTemplate(templatePath)
        if (!isCurrent()) return
        const path = defaultNotePath(noteTitle)
        const markdown = await vaultBuildNoteMarkdown(noteTitle.replace(/\.md$/i, ''), null, template)
        if (!isCurrent()) return
        const createdPath = await saveNewNoteWithUniqueName(path, markdown, vault.id)
        if (!isCurrent()) return
        await indexerUpdateNote(createdPath)
        if (!isCurrent()) return
        await refreshVaultCore()
        if (!isCurrent()) return
        await openNote(createdPath, isCurrent)
        if (!isCurrent()) return
        logActivity('success', 'Note created from template', templatePath)
      } catch (caught) {
        if (!isCurrent()) return
        const message = caught instanceof Error ? caught.message : String(caught)
        setError(message)
        logActivity('error', 'Template note creation failed', message)
      }
    },
    [logActivity, openNote, operationOwner, refreshVaultCore, setError, vault],
  )

  const createDailyNoteForOffset = useCallback(
    async (dayOffset = 0) => {
      if (!vault) return
      const isCurrent = operationOwner()
      const iso = offsetIsoDate(formatLocalDate(), dayOffset)
      try {
        const plan = await vaultPlanDailyNote(iso)
        if (!isCurrent()) return
        let exists = false
        try {
          await vaultReadNote(plan.path)
          exists = true
        } catch {
          // A read failure must not authorize overwriting an existing note.
          // The create-only native CAS below fails closed if the path exists.
        }
        if (!isCurrent()) return
        if (exists) {
          await openNote(plan.path, isCurrent)
          return
        }
        await vaultSaveNote(plan.path, plan.markdown, EXPECTED_MISSING_CONTENT_HASH, undefined, vault.id)
        if (!isCurrent()) return
        await indexerUpdateNote(plan.path)
        if (!isCurrent()) return
        await refreshVaultCore()
        if (!isCurrent()) return
        await openNote(plan.path, isCurrent)
        if (!isCurrent()) return
        logActivity('success', dayOffset === 0 ? 'Daily note created' : `Daily note for ${iso}`, plan.path)
      } catch (caught) {
        if (!isCurrent()) return
        const message = caught instanceof Error ? caught.message : String(caught)
        setError(message)
      }
    },
    [logActivity, openNote, operationOwner, refreshVaultCore, setError, vault],
  )

  const createNote = useCallback(
    async (title?: string, initialMarkdown?: string, options: CreateNoteOptions = {}): Promise<string | null> => {
      if (!vault) {
        setError('Open a vault before creating a note.')
        return null
      }

      const noteTitle = title?.trim() || `Untitled ${formatLocalDate()}`
      const pathBase = vaultConfig.inbox?.new_note_directory?.trim()
      const fileName = defaultNotePath(noteTitle)
      const path = pathBase ? `${pathBase.replace(/\/$/, '')}/${fileName}` : fileName

      try {
        const markdown =
          initialMarkdown ?? (await vaultBuildNoteMarkdown(noteTitle.replace(/\.md$/i, ''), null, null))
        if (options.isCurrent?.() === false) return null
        setError(null)
        const createdPath = options.requireMissing === undefined
          ? await saveNewNoteWithUniqueName(path, markdown, vault.id)
          : (await vaultSaveNote(path, markdown, options.requireMissing ? EXPECTED_MISSING_CONTENT_HASH : undefined, undefined, vault.id), path)
        if (options.isCurrent?.() === false) return createdPath
        await indexerUpdateNote(createdPath)
        if (options.isCurrent?.() === false) return createdPath
        await refreshVaultCore()
        if (options.isCurrent?.() === false) return createdPath
        await openNote(createdPath, options.isCurrent)
        if (options.isCurrent?.() === false) return createdPath
        if (vaultConfig.inbox?.enabled !== false) {
          setSidebarView('inbox')
        }
        logActivity('success', 'Note created', createdPath)
        return createdPath
      } catch (caught) {
        if (options.isCurrent?.() === false) return null
        const message = caught instanceof Error ? caught.message : String(caught)
        setError(message)
        logActivity('error', 'Failed to create note', message)
        return null
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
        await vaultSaveNote(path, markdown, EXPECTED_MISSING_CONTENT_HASH, undefined, vault.id)
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

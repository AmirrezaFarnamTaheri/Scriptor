import { useCallback, useState } from 'react'

import {
  indexerRebuild,
  vaultRenameApply,
  vaultRenameBlockApply,
  vaultRenameBlockDryRun,
  vaultRenameDryRun,
  vaultRenameSectionApply,
  vaultRenameSectionDryRun,
  vaultRenameTagApply,
  vaultRenameTagDryRun,
} from '../bridge/commands'
import type { LinkRewritePreview, RenameNoteDryRunOutput } from '../types/vault'
import type { ActivityEntry } from './useActivityLog'

interface UseWorkspaceRenameOptions {
  activePath: string | null
  setError: React.Dispatch<React.SetStateAction<string | null>>
  logActivity: (kind: ActivityEntry['kind'], message: string, detail?: string) => void
  refreshVault: () => Promise<void>
  openNote: (path: string, isCurrent?: () => boolean) => Promise<unknown>
  loadGraph: (focusPath?: string | null) => Promise<void>
  flushAllPendingSaves: () => Promise<boolean>
  runNoteMutation: (path: string, mutation: () => Promise<void>) => Promise<boolean>
}

export function useWorkspaceRename({
  activePath,
  setError,
  logActivity,
  refreshVault,
  openNote,
  loadGraph,
  flushAllPendingSaves,
  runNoteMutation,
}: UseWorkspaceRenameOptions) {
  const [renamePreview, setRenamePreview] = useState<RenameNoteDryRunOutput | null>(null)
  const [linkRewritePreview, setLinkRewritePreview] = useState<LinkRewritePreview | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [isLinkRewriting, setIsLinkRewriting] = useState(false)

  const runRenameMutation = useCallback(async (mutation: () => Promise<void>, movesActiveNote = false) => {
    if (!(await flushAllPendingSaves())) {
      throw new Error('Could not save all pending changes. Rename cancelled; drafts retained.')
    }
    // Rewrites can touch the active note even when a different note, tag,
    // section, or block is being renamed. Use the editor's guarded refresh.
    if (activePath && !movesActiveNote) {
      if (!(await runNoteMutation(activePath, mutation))) {
        throw new Error('The editor is saving. Retry the rename after saving finishes.')
      }
    } else {
      await mutation()
    }
  }, [activePath, flushAllPendingSaves, runNoteMutation])

  const previewRename = useCallback(
    async (toPath: string, updateLinks: boolean, fromPath?: string) => {
      const source = fromPath ?? activePath
      if (!source) return
      const preview = await vaultRenameDryRun(source, toPath, updateLinks)
      setRenamePreview(preview)
    },
    [activePath],
  )

  const applyRename = useCallback(
    async (toPath: string, updateLinks: boolean, fromPath?: string) => {
      const source = fromPath ?? activePath
      if (!source) return
      setIsRenaming(true)
      setError(null)
      try {
        await runRenameMutation(async () => { await vaultRenameApply(source, toPath, updateLinks) }, source === activePath)
        await indexerRebuild()
        await refreshVault()
        setRenamePreview(null)
        logActivity('success', 'Note renamed', `${source} -> ${toPath}`)
        if (source === activePath) {
          await openNote(toPath)
          await loadGraph(toPath)
        }
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        setError(message)
        logActivity('error', 'Rename failed', message)
        throw caught
      } finally {
        setIsRenaming(false)
      }
    },
    [activePath, loadGraph, logActivity, openNote, refreshVault, runRenameMutation, setError],
  )

  const previewTagRename = useCallback(async (oldTag: string, newTag: string) => {
    const preview = await vaultRenameTagDryRun(oldTag, newTag)
    setLinkRewritePreview(preview)
  }, [])

  const applyTagRename = useCallback(
    async (oldTag: string, newTag: string) => {
      setIsLinkRewriting(true)
      setError(null)
      try {
        let edits = 0
        await runRenameMutation(async () => { edits = (await vaultRenameTagApply(oldTag, newTag)).edits })
        await indexerRebuild()
        await refreshVault()
        setLinkRewritePreview(null)
        logActivity('success', 'Tag renamed', `#${oldTag} -> #${newTag} (${edits} edits)`)
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        setError(message)
        logActivity('error', 'Tag rename failed', message)
        throw caught
      } finally {
        setIsLinkRewriting(false)
      }
    },
    [logActivity, refreshVault, runRenameMutation, setError],
  )

  const previewSectionRename = useCallback(
    async (notePath: string, oldSection: string, newSection: string, updateHeading: boolean) => {
      const preview = await vaultRenameSectionDryRun(notePath, oldSection, newSection, updateHeading)
      setLinkRewritePreview(preview)
    },
    [],
  )

  const applySectionRename = useCallback(
    async (notePath: string, oldSection: string, newSection: string, updateHeading: boolean) => {
      setIsLinkRewriting(true)
      setError(null)
      try {
        let edits = 0
        await runRenameMutation(async () => { edits = (await vaultRenameSectionApply(notePath, oldSection, newSection, updateHeading)).edits })
        await indexerRebuild()
        await refreshVault()
        setLinkRewritePreview(null)
        logActivity(
          'success',
          'Section renamed',
          `${oldSection} -> ${newSection} (${edits} edits)`,
        )
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        setError(message)
        logActivity('error', 'Section rename failed', message)
        throw caught
      } finally {
        setIsLinkRewriting(false)
      }
    },
    [logActivity, refreshVault, runRenameMutation, setError],
  )

  const previewBlockRename = useCallback(
    async (notePath: string, oldBlock: string, newBlock: string, updateAnchor: boolean) => {
      const preview = await vaultRenameBlockDryRun(notePath, oldBlock, newBlock, updateAnchor)
      setLinkRewritePreview(preview)
    },
    [],
  )

  const applyBlockRename = useCallback(
    async (notePath: string, oldBlock: string, newBlock: string, updateAnchor: boolean) => {
      setIsLinkRewriting(true)
      setError(null)
      try {
        let edits = 0
        await runRenameMutation(async () => { edits = (await vaultRenameBlockApply(notePath, oldBlock, newBlock, updateAnchor)).edits })
        await indexerRebuild()
        await refreshVault()
        setLinkRewritePreview(null)
        logActivity('success', 'Block renamed', `${oldBlock} -> ${newBlock} (${edits} edits)`)
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        setError(message)
        logActivity('error', 'Block rename failed', message)
        throw caught
      } finally {
        setIsLinkRewriting(false)
      }
    },
    [logActivity, refreshVault, runRenameMutation, setError],
  )

  return {
    renamePreview,
    linkRewritePreview,
    isRenaming,
    isLinkRewriting,
    previewRename,
    applyRename,
    previewTagRename,
    applyTagRename,
    previewSectionRename,
    applySectionRename,
    previewBlockRename,
    applyBlockRename,
    clearRenamePreview: () => setRenamePreview(null),
    clearLinkRewritePreview: () => setLinkRewritePreview(null),
  }
}

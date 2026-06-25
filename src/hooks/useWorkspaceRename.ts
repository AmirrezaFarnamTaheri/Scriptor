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
  openNote: (path: string) => Promise<void>
  loadGraph: (focusPath?: string | null) => Promise<void>
}

export function useWorkspaceRename({
  activePath,
  setError,
  logActivity,
  refreshVault,
  openNote,
  loadGraph,
}: UseWorkspaceRenameOptions) {
  const [renamePreview, setRenamePreview] = useState<RenameNoteDryRunOutput | null>(null)
  const [linkRewritePreview, setLinkRewritePreview] = useState<LinkRewritePreview | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [isLinkRewriting, setIsLinkRewriting] = useState(false)

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
        await vaultRenameApply(source, toPath, updateLinks)
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
      } finally {
        setIsRenaming(false)
      }
    },
    [activePath, loadGraph, logActivity, openNote, refreshVault, setError],
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
        const summary = await vaultRenameTagApply(oldTag, newTag)
        await indexerRebuild()
        await refreshVault()
        setLinkRewritePreview(null)
        logActivity('success', 'Tag renamed', `#${oldTag} -> #${newTag} (${summary.edits} edits)`)
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        setError(message)
        logActivity('error', 'Tag rename failed', message)
      } finally {
        setIsLinkRewriting(false)
      }
    },
    [logActivity, refreshVault, setError],
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
        const summary = await vaultRenameSectionApply(notePath, oldSection, newSection, updateHeading)
        await indexerRebuild()
        await refreshVault()
        setLinkRewritePreview(null)
        if (notePath === activePath) {
          await openNote(notePath)
        }
        logActivity(
          'success',
          'Section renamed',
          `${oldSection} -> ${newSection} (${summary.edits} edits)`,
        )
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        setError(message)
        logActivity('error', 'Section rename failed', message)
      } finally {
        setIsLinkRewriting(false)
      }
    },
    [activePath, logActivity, openNote, refreshVault, setError],
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
        const summary = await vaultRenameBlockApply(notePath, oldBlock, newBlock, updateAnchor)
        await indexerRebuild()
        await refreshVault()
        setLinkRewritePreview(null)
        if (notePath === activePath) {
          await openNote(notePath)
        }
        logActivity('success', 'Block renamed', `${oldBlock} -> ${newBlock} (${summary.edits} edits)`)
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        setError(message)
        logActivity('error', 'Block rename failed', message)
      } finally {
        setIsLinkRewriting(false)
      }
    },
    [activePath, logActivity, openNote, refreshVault, setError],
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

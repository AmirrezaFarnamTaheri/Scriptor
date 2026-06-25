import type { ExportProfile } from '@scriptor/core/contracts/export'
import { findExportProfile } from '@scriptor/export'
import type { EditorTransformAction, TypographyAction } from '@scriptor/editor'
import { generateLinkReferenceDefinitions } from '@scriptor/editor'
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from 'react'

import {
  exportStartNote,
  indexerRecordRecentAccess,
  indexerUpdateNote,
  vaultReadNote,
  vaultRecordRecentNote,
  vaultSaveAsset,
  vaultSaveNote,
} from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'
import { isContentHashMismatchError } from '../lib/vaultErrors'
import type {
  ExternalChangeConflict,
  NoteDocument,
  VaultConfig,
} from '../types/vault'
import type { ActivityEntry } from './useActivityLog'
import { extractOutline, extractWikilinks, type OutlineHeading } from './vault/helpers'

interface OpenTab {
  path: string
  title: string
  contentHash: string
  pinned?: boolean
}

export interface WorkspaceEditorRefs {
  activePathRef: MutableRefObject<string | null>
  activeNoteRef: MutableRefObject<NoteDocument | null>
  draftMarkdownRef: MutableRefObject<string>
  isSavingRef: MutableRefObject<boolean>
  checkExternalChangesRef: MutableRefObject<() => Promise<void>>
}

interface UseWorkspaceEditorOptions {
  editorRefs: WorkspaceEditorRefs
  setError: React.Dispatch<React.SetStateAction<string | null>>
  logActivity: (kind: ActivityEntry['kind'], message: string, detail?: string) => void
  loadBacklinks: (path: string) => Promise<void>
  setBacklinks: React.Dispatch<React.SetStateAction<import('../types/vault').BacklinkHit[]>>
  refreshVaultCore: () => Promise<void>
  searchQuery: string
  runSearch: (query: string) => Promise<void>
  vaultConfig: VaultConfig
  exportProfilesRef: RefObject<ExportProfile[]>
}

export function useWorkspaceEditor({
  editorRefs,
  setError,
  logActivity,
  loadBacklinks,
  setBacklinks,
  refreshVaultCore,
  searchQuery,
  runSearch,
  vaultConfig,
  exportProfilesRef,
}: UseWorkspaceEditorOptions) {
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([])
  const [closedTabs, setClosedTabs] = useState<OpenTab[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)
  const [activeNote, setActiveNote] = useState<NoteDocument | null>(null)
  const [draftMarkdown, setDraftMarkdown] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [externalChangeConflict, setExternalChangeConflict] = useState<ExternalChangeConflict | null>(null)
  const [noteNav, setNoteNav] = useState<{ paths: string[]; index: number }>({ paths: [], index: -1 })
  const [scrollToEditorLine, setScrollToEditorLine] = useState<number | null>(null)
  const [editorInsertRequest, setEditorInsertRequest] = useState<{ seq: number; text: string } | null>(null)
  const [editorTransformRequest, setEditorTransformRequest] = useState<{
    seq: number
    action: EditorTransformAction
  } | null>(null)
  const [editorTypographyRequest, setEditorTypographyRequest] = useState<{
    seq: number
    action: TypographyAction
  } | null>(null)

  const saveTimer = useRef<number | null>(null)
  const historyNavigation = useRef(false)
  const saveOverwriteRef = useRef(false)
  const { activePathRef, activeNoteRef, draftMarkdownRef, isSavingRef, checkExternalChangesRef } = editorRefs

  const resetNoteNavigation = useCallback(() => {
    setNoteNav({ paths: [], index: -1 })
  }, [])

  const loadNote = useCallback(
    async (path: string) => {
      setError(null)
      setExternalChangeConflict(null)
      saveOverwriteRef.current = false
      const document = await vaultReadNote(path)
      setActivePath(path)
      setActiveNote(document)
      setDraftMarkdown(document.markdown)
      setOpenTabs((tabs) => {
        const nextTab: OpenTab = {
          path,
          title: document.metadata.title,
          contentHash: document.metadata.content_hash,
        }
        const existing = tabs.find((tab) => tab.path === path)
        if (existing) {
          return tabs.map((tab) => (tab.path === path ? nextTab : tab))
        }
        return [...tabs, nextTab]
      })
      await loadBacklinks(path)
      if (isNativeBridgeAvailable()) {
        void vaultRecordRecentNote(path).catch(() => undefined)
        void indexerRecordRecentAccess(path).catch(() => undefined)
      }
    },
    [loadBacklinks, setError],
  )

  const recordNoteHistory = useCallback((path: string) => {
    setNoteNav(({ paths, index }) => {
      if (paths[index] === path) return { paths, index }
      const truncated = index >= 0 ? paths.slice(0, index + 1) : []
      const nextPaths = [...truncated, path].slice(-100)
      return { paths: nextPaths, index: nextPaths.length - 1 }
    })
  }, [])

  const openNote = useCallback(
    async (path: string) => {
      await loadNote(path)
      if (!historyNavigation.current) {
        recordNoteHistory(path)
      }
      historyNavigation.current = false
    },
    [loadNote, recordNoteHistory],
  )

  const openNoteAt = useCallback(
    async (path: string, line?: number | null) => {
      await openNote(path)
      if (line && line > 0) {
        setScrollToEditorLine(line)
      }
    },
    [openNote],
  )

  useEffect(() => {
    activePathRef.current = activePath
  }, [activePath])

  useEffect(() => {
    activeNoteRef.current = activeNote
  }, [activeNote])

  useEffect(() => {
    draftMarkdownRef.current = draftMarkdown
  }, [draftMarkdown])

  useEffect(() => {
    isSavingRef.current = isSaving
  }, [isSaving])

  const reloadActiveNoteFromDisk = useCallback(async () => {
    if (!activePath) {
      return
    }
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current)
    }
    saveOverwriteRef.current = false
    setExternalChangeConflict(null)
    await loadNote(activePath)
    logActivity('info', 'Reloaded note from disk', activePath)
  }, [activePath, loadNote, logActivity])

  const keepEditingAfterExternalChange = useCallback(() => {
    if (!externalChangeConflict) {
      return
    }
    saveOverwriteRef.current = true
    setExternalChangeConflict(null)
    logActivity('info', 'Keeping local edits', `${externalChangeConflict.path} will overwrite on save`)
  }, [externalChangeConflict, logActivity])

  const syncActiveNoteContent = useCallback(
    async (path: string) => {
      if (activePath !== path || !activeNote) {
        return
      }
      const doc = await vaultReadNote(path)
      setActiveNote(doc)
      setDraftMarkdown(doc.markdown)
    },
    [activeNote, activePath],
  )

  const checkExternalChanges = useCallback(async () => {
    const path = activePathRef.current
    const note = activeNoteRef.current
    if (!path || !note || isSavingRef.current || saveOverwriteRef.current) {
      return
    }

    try {
      const disk = await vaultReadNote(path)
      const loadedHash = note.metadata.content_hash
      if (disk.metadata.content_hash === loadedHash) {
        setExternalChangeConflict((current) => (current?.path === path ? null : current))
        return
      }

      const isDirty = draftMarkdownRef.current !== note.markdown
      if (!isDirty) {
        setActiveNote(disk)
        setDraftMarkdown(disk.markdown)
        setOpenTabs((tabs) =>
          tabs.map((tab) =>
            tab.path === path
              ? { ...tab, title: disk.metadata.title, contentHash: disk.metadata.content_hash }
              : tab,
          ),
        )
        setExternalChangeConflict(null)
        void loadBacklinks(path)
        return
      }

      setExternalChangeConflict({
        path,
        loaded_hash: loadedHash,
        disk_hash: disk.metadata.content_hash,
      })
    } catch {
      // Ignore transient read failures during external change checks.
    }
  }, [loadBacklinks])

  useEffect(() => {
    checkExternalChangesRef.current = checkExternalChanges
  }, [checkExternalChanges])

  const closeTab = useCallback(
    (path: string, force = false) => {
      const closing = openTabs.find((tab) => tab.path === path)
      if (closing?.pinned && !force) return

      setOpenTabs((tabs) => {
        const tab = tabs.find((entry) => entry.path === path)
        const nextTabs = tabs.filter((entry) => entry.path !== path)
        if (tab) {
          setClosedTabs((closed) => [tab, ...closed.filter((entry) => entry.path !== tab.path)].slice(0, 12))
        }
        if (activePath === path) {
          const fallback = nextTabs.at(-1)?.path ?? null
          if (fallback) {
            void openNote(fallback)
          } else {
            setActivePath(null)
            setActiveNote(null)
            setDraftMarkdown('')
            setBacklinks([])
          }
        }
        return nextTabs
      })
    },
    [activePath, openNote, openTabs, setBacklinks],
  )

  const reopenClosedTab = useCallback(() => {
    const [next, ...rest] = closedTabs
    if (!next) return
    setClosedTabs(rest)
    void openNote(next.path)
  }, [closedTabs, openNote])

  const togglePinTab = useCallback((path: string) => {
    setOpenTabs((tabs) =>
      tabs.map((tab) => (tab.path === path ? { ...tab, pinned: !tab.pinned } : tab)),
    )
  }, [])

  const scheduleSave = useCallback(
    (markdown: string) => {
      if (!activePath || !activeNote) return

      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current)
      }

      saveTimer.current = window.setTimeout(() => {
        void (async () => {
          setIsSaving(true)
          setError(null)
          try {
            const overwrite = saveOverwriteRef.current
            const saved = await vaultSaveNote(
              activePath,
              markdown,
              overwrite ? undefined : activeNote.metadata.content_hash,
            )
            saveOverwriteRef.current = false
            setExternalChangeConflict(null)
            setActiveNote({ metadata: saved.metadata, markdown })
            setDraftMarkdown(markdown)
            setOpenTabs((tabs) =>
              tabs.map((tab) =>
                tab.path === activePath
                  ? { ...tab, title: saved.metadata.title, contentHash: saved.metadata.content_hash }
                  : tab,
              ),
            )
            setLastSavedAt(new Date().toLocaleTimeString())
            await indexerUpdateNote(activePath)
            await refreshVaultCore()
            await loadBacklinks(activePath)
            if (searchQuery.trim()) {
              await runSearch(searchQuery)
            }
            if (vaultConfig.export.export_on_save?.enabled && vaultConfig.export.export_on_save.profile_id) {
              const profiles = exportProfilesRef.current ?? []
              const profile = findExportProfile(profiles, vaultConfig.export.export_on_save.profile_id)
              if (profile) {
                void exportStartNote(activePath, profile.id, false)
              }
            }
          } catch (caught) {
            const message = caught instanceof Error ? caught.message : String(caught)
            if (isContentHashMismatchError(message)) {
              try {
                const disk = await vaultReadNote(activePath)
                setExternalChangeConflict({
                  path: activePath,
                  loaded_hash: activeNote.metadata.content_hash,
                  disk_hash: disk.metadata.content_hash,
                })
              } catch {
                setExternalChangeConflict({
                  path: activePath,
                  loaded_hash: activeNote.metadata.content_hash,
                  disk_hash: 'unknown',
                })
              }
              logActivity('error', 'Save blocked — note changed on disk', activePath)
            } else {
              setError(message)
            }
          } finally {
            setIsSaving(false)
          }
        })()
      }, 700)
    },
    [
      activeNote,
      activePath,
      exportProfilesRef,
      loadBacklinks,
      logActivity,
      refreshVaultCore,
      runSearch,
      searchQuery,
      setError,
      vaultConfig,
    ],
  )

  const insertSnippet = useCallback(
    (snippet: string) => {
      if (!activePath) return
      setEditorInsertRequest({ seq: Date.now(), text: snippet })
    },
    [activePath],
  )

  const applyEditorTransform = useCallback(
    (action: EditorTransformAction) => {
      if (!activePath) return
      setEditorTransformRequest({ seq: Date.now(), action })
    },
    [activePath],
  )

  const applyEditorTypography = useCallback(
    (action: TypographyAction) => {
      if (!activePath) return
      setEditorTypographyRequest({ seq: Date.now(), action })
    },
    [activePath],
  )

  const saveActiveNoteNow = useCallback(async () => {
    if (!activePath || !activeNote) return
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    scheduleSave(draftMarkdownRef.current)
  }, [activeNote, activePath, scheduleSave])

  const updateDraft = useCallback(
    (markdown: string) => {
      setDraftMarkdown(markdown)
      scheduleSave(markdown)
    },
    [scheduleSave],
  )

  const saveVaultImage = useCallback(async (file: File) => {
    if (!isNativeBridgeAvailable()) return null
    const extension = file.name.split('.').pop()?.toLowerCase() || file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
    const relativePath = `assets/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`
    const bytes = Array.from(new Uint8Array(await file.arrayBuffer()))
    await vaultSaveAsset(relativePath, bytes)
    return relativePath
  }, [])

  const generateLinkReferences = useCallback(() => {
    const next = generateLinkReferenceDefinitions(draftMarkdown)
    if (next !== draftMarkdown) {
      updateDraft(next)
    }
  }, [draftMarkdown, updateDraft])

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current)
      }
    }
  }, [])

  const jumpToOutlineHeading = useCallback((heading: OutlineHeading) => {
    setScrollToEditorLine(heading.line)
  }, [])

  const navigateBack = useCallback(() => {
    setNoteNav(({ paths, index }) => {
      if (index <= 0) return { paths, index }
      const nextIndex = index - 1
      const path = paths[nextIndex]
      if (path) {
        historyNavigation.current = true
        void loadNote(path)
      }
      return { paths, index: nextIndex }
    })
  }, [loadNote])

  const navigateForward = useCallback(() => {
    setNoteNav(({ paths, index }) => {
      if (index >= paths.length - 1) return { paths, index }
      const nextIndex = index + 1
      const path = paths[nextIndex]
      if (path) {
        historyNavigation.current = true
        void loadNote(path)
      }
      return { paths, index: nextIndex }
    })
  }, [loadNote])

  const inspectorOutline = useMemo(
    () => (activeNote ? extractOutline(activeNote.markdown) : []),
    [activeNote],
  )

  const inspectorLinks = useMemo(
    () => (activeNote ? extractWikilinks(activeNote.markdown) : []),
    [activeNote],
  )

  const isNoteDirty = useMemo(
    () => (activeNote ? draftMarkdown !== activeNote.markdown : false),
    [activeNote, draftMarkdown],
  )

  return {
    openTabs,
    activePath,
    activeNote,
    draftMarkdown,
    isNoteDirty,
    externalChangeConflict,
    isSaving,
    lastSavedAt,
    canNavigateBack: noteNav.index > 0,
    canNavigateForward: noteNav.index >= 0 && noteNav.index < noteNav.paths.length - 1,
    navigateBack,
    navigateForward,
    scrollToEditorLine,
    editorInsertRequest,
    editorTransformRequest,
    editorTypographyRequest,
    inspectorOutline,
    inspectorLinks,
    openNote,
    openNoteAt,
    closeTab,
    reopenClosedTab,
    togglePinTab,
    closedTabs,
    updateDraft,
    saveVaultImage,
    generateLinkReferences,
    insertSnippet,
    applyEditorTransform,
    applyEditorTypography,
    saveActiveNoteNow,
    reloadActiveNoteFromDisk,
    keepEditingAfterExternalChange,
    syncActiveNoteContent,
    jumpToOutlineHeading,
    resetNoteNavigation,
  }
}

import type { ExportProfile } from '@scriptor/core/contracts/export'
import { findExportProfile } from '@scriptor/export'
import type { EditorTransformAction, TypographyAction } from '@scriptor/editor'
import { generateLinkReferenceDefinitions } from '@scriptor/editor/pure'
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from 'react'

import {
  exportStartNote,
  indexerApplyFilesystemChanges,
  indexerRecordRecentAccess,
  indexerUpdateNote,
  vaultReadNote,
  vaultRecordRecentNote,
  vaultSaveAsset,
  vaultSaveNote,
} from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'
import { importVaultFiles } from '../lib/importVaultFiles'
import { isContentHashMismatchError } from '../lib/vaultErrors'
import { coordinateNoteMutation } from '../lib/workspace/coordinateNoteMutation'
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

interface SaveRequest {
  path: string
  markdown: string
  contentHash: string
  navigationGeneration?: number
  draftRevision: number
  overwrite: boolean
  vaultId: string
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
  const noteNavRef = useRef<{ paths: string[]; index: number }>({ paths: [], index: -1 })
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
  const saveOverwriteRef = useRef(false)
  const navigationGenerationRef = useRef(0)
  const draftRevisionRef = useRef(0)
  const savedHashesRef = useRef(new Map<string, string>())
  const saveTailRef = useRef<Promise<void>>(Promise.resolve())
  const pendingSaveCountRef = useRef(0)
  const pendingRefreshRef = useRef<(() => Promise<void>) | null>(null)
  const refreshingRef = useRef(false)
  const pendingSaveRequestRef = useRef<SaveRequest | null>(null)
  const performSaveRef = useRef<(request: SaveRequest) => Promise<boolean>>(() => Promise.resolve(false))
  const createSaveRequestRef = useRef<(markdown: string, customPath?: string, customVaultId?: string) => SaveRequest | null>(() => null)
  const docVaultsRef = useRef<Map<string, string>>(new Map())
  const draftRevisionsByDocRef = useRef<Map<string, number>>(new Map())
  const saveTimersByDocRef = useRef<Map<string, number>>(new Map())
  const pendingRequestsByDocRef = useRef<Map<string, SaveRequest>>(new Map())
  const inFlightSavesByDocRef = useRef<Map<string, Promise<boolean>>>(new Map())
  const flushPendingDocumentSaveRef = useRef<(path: string, vaultId?: string) => Promise<boolean>>(() => Promise.resolve(false))
  const { activePathRef, activeNoteRef, draftMarkdownRef, isSavingRef, checkExternalChangesRef } = editorRefs

  const resetNoteNavigation = useCallback(async () => {
    if (activePathRef.current) {
      await flushPendingDocumentSaveRef.current(activePathRef.current)
    }
    for (const [docKey, timer] of Array.from(saveTimersByDocRef.current.entries())) {
      window.clearTimeout(timer)
      saveTimersByDocRef.current.delete(docKey)
      const pending = pendingRequestsByDocRef.current.get(docKey)
      if (pending) {
        pendingRequestsByDocRef.current.delete(docKey)
        await performSaveRef.current(pending)
      }
    }
    await saveTailRef.current
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
      pendingSaveRequestRef.current = null
    }
    navigationGenerationRef.current += 1
    const nextNav = { paths: [], index: -1 }
    noteNavRef.current = nextNav
    setNoteNav(nextNav)
  }, [activePathRef])

  const loadNote = useCallback(
    async (path: string, isCurrent: () => boolean = () => true) => {
      if (!isCurrent()) return false
      const currentPath = activePathRef.current
      const currentVaultId = activeNoteRef.current?.metadata.vault_id
      if (currentPath && currentPath !== path && currentVaultId) {
        void flushPendingDocumentSaveRef.current(currentPath, currentVaultId)
      }

      const targetVaultId = docVaultsRef.current.get(path) ?? currentVaultId
      if (targetVaultId) {
        const targetDocKey = `${targetVaultId}:${path}`
        const inFlight = inFlightSavesByDocRef.current.get(targetDocKey)
        if (inFlight) {
          await inFlight
        }
      }

      const navigationGeneration = ++navigationGenerationRef.current
      setError(null)
      setExternalChangeConflict(null)
      saveOverwriteRef.current = false
      const document = await vaultReadNote(path)
      if (!isCurrent() || navigationGeneration !== navigationGenerationRef.current) return false
      docVaultsRef.current.set(path, document.metadata.vault_id)
      setActivePath(path)
      setActiveNote(document)
      setDraftMarkdown(document.markdown)
      activePathRef.current = path
      activeNoteRef.current = document
      draftMarkdownRef.current = document.markdown
      savedHashesRef.current.set(path, document.metadata.content_hash)
      setOpenTabs((tabs) => {
        const nextTab: OpenTab = {
          path,
          title: document.metadata.title,
          contentHash: document.metadata.content_hash,
        }
        const existing = tabs.find((tab) => tab.path === path)
        if (existing) {
          return tabs.map((tab) => (tab.path === path ? { ...nextTab, pinned: tab.pinned } : tab))
        }
        return [...tabs, nextTab]
      })
      void loadBacklinks(path)
      if (!isCurrent() || navigationGeneration !== navigationGenerationRef.current) return false
      if (isNativeBridgeAvailable()) {
        void vaultRecordRecentNote(path).catch(() => undefined)
        void indexerRecordRecentAccess(path).catch(() => undefined)
      }
      return true
    },
    [activeNoteRef, activePathRef, draftMarkdownRef, loadBacklinks, setError],
  )

  const recordNoteHistory = useCallback((path: string) => {
    const current = noteNavRef.current
    if (current.paths[current.index] === path) return
    const truncated = current.index >= 0 ? current.paths.slice(0, current.index + 1) : []
    const nextPaths = [...truncated, path].slice(-100)
    const nextNav = { paths: nextPaths, index: nextPaths.length - 1 }
    noteNavRef.current = nextNav
    setNoteNav(nextNav)
  }, [])

  const openNote = useCallback(
    async (path: string, isCurrent?: () => boolean) => {
      const didLoad = await loadNote(path, isCurrent)
      if (didLoad) {
        recordNoteHistory(path)
      }
    },
    [loadNote, recordNoteHistory],
  )

  const openNoteAt = useCallback(
    async (path: string, line?: number | null) => {
      const loading = openNote(path)
      const navigationGeneration = navigationGenerationRef.current
      await loading
      if (navigationGeneration === navigationGenerationRef.current && activePathRef.current === path && line && line > 0) {
        setScrollToEditorLine(line)
      }
    },
    [activePathRef, openNote],
  )

  const restoreEditorSession = useCallback(
    async (
      tabs: Array<{ path: string; pinned?: boolean }>,
      active: string | null,
      isCurrent: () => boolean = () => true,
    ) => {
      if (tabs.length === 0 || !isCurrent()) return
      setOpenTabs(
        tabs.map((tab) => ({
          path: tab.path,
          title: tab.path.split('/').pop()?.replace(/\.md$/i, '') ?? tab.path,
          contentHash: '',
          pinned: tab.pinned,
        })),
      )
      const target = active && tabs.some((tab) => tab.path === active) ? active : tabs[0]?.path
      if (target && isCurrent()) {
        await openNote(target, isCurrent)
      }
    },
    [openNote],
  )

  useEffect(() => {
    activePathRef.current = activePath
  }, [activePath, activePathRef])

  useEffect(() => {
    activeNoteRef.current = activeNote
  }, [activeNote, activeNoteRef])

  useEffect(() => {
    draftMarkdownRef.current = draftMarkdown
  }, [draftMarkdown, draftMarkdownRef])

  useEffect(() => {
    isSavingRef.current = isSaving
  }, [isSaving, isSavingRef])

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
    async (
      path: string,
      expected?: { navigationGeneration: number; draftRevision: number },
    ) => {
      if (activePath !== path || !activeNote) {
        return
      }
      const navigationGeneration = expected?.navigationGeneration ?? navigationGenerationRef.current
      const draftRevision = expected?.draftRevision ?? draftRevisionRef.current
      const doc = await vaultReadNote(path)
      if (
        activePathRef.current !== path ||
        navigationGeneration !== navigationGenerationRef.current ||
        draftRevision !== draftRevisionRef.current
      ) {
        return
      }
      setActiveNote(doc)
      setDraftMarkdown(doc.markdown)
      activeNoteRef.current = doc
      draftMarkdownRef.current = doc.markdown
      savedHashesRef.current.set(path, doc.metadata.content_hash)
      setOpenTabs((tabs) =>
        tabs.map((tab) =>
          tab.path === path
            ? { ...tab, title: doc.metadata.title, contentHash: doc.metadata.content_hash }
            : tab,
        ),
      )
      setExternalChangeConflict(null)
      await loadBacklinks(path)
      if (navigationGeneration !== navigationGenerationRef.current) return
    },
    [activeNote, activeNoteRef, activePath, activePathRef, draftMarkdownRef, loadBacklinks],
  )

  const checkExternalChanges = useCallback(async () => {
    const path = activePathRef.current
    const note = activeNoteRef.current
    if (!path || !note || isSavingRef.current || saveOverwriteRef.current) {
      return
    }

    const navigationGeneration = navigationGenerationRef.current
    const draftRevision = draftRevisionRef.current
    try {
      const disk = await vaultReadNote(path)
      if (
        navigationGeneration !== navigationGenerationRef.current ||
        draftRevision !== draftRevisionRef.current ||
        activePathRef.current !== path ||
        activeNoteRef.current !== note ||
        isSavingRef.current
      ) return
      const loadedHash = note.metadata.content_hash
      if (disk.metadata.content_hash === loadedHash) {
        setExternalChangeConflict((current) => (current?.path === path ? null : current))
        return
      }

      const isDirty = draftMarkdownRef.current !== note.markdown
      if (!isDirty) {
        setActiveNote(disk)
        setDraftMarkdown(disk.markdown)
        activeNoteRef.current = disk
        draftMarkdownRef.current = disk.markdown
        savedHashesRef.current.set(path, disk.metadata.content_hash)
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
  }, [activeNoteRef, activePathRef, draftMarkdownRef, isSavingRef, loadBacklinks])

  useEffect(() => {
    checkExternalChangesRef.current = checkExternalChanges
  }, [checkExternalChanges, checkExternalChangesRef])

  const closeTab = useCallback(
    async (path: string, force = false): Promise<boolean> => {
      const closing = openTabs.find((tab) => tab.path === path)
      if (closing?.pinned && !force) return false

      const targetVaultId = docVaultsRef.current.get(path) ?? activeNoteRef.current?.metadata.vault_id
      if (targetVaultId && !force) {
        const saved = await flushPendingDocumentSaveRef.current(path, targetVaultId)
        if (!saved) {
          setError(`Failed to save changes to ${path} before closing. Draft retained.`)
          return false
        }
      } else if (targetVaultId) {
        void flushPendingDocumentSaveRef.current(path, targetVaultId)
      }

      const nextTabs = openTabs.filter((entry) => entry.path !== path)
      setOpenTabs((tabs) => tabs.filter((entry) => entry.path !== path))
      if (closing) {
        setClosedTabs((closed) => [closing, ...closed.filter((entry) => entry.path !== path)].slice(0, 12))
      }
      if (activePath === path) {
        const fallback = nextTabs.at(-1)?.path ?? null
        if (fallback) {
          await openNote(fallback)
        } else {
          navigationGenerationRef.current += 1
          activePathRef.current = null
          activeNoteRef.current = null
          draftMarkdownRef.current = ''
          setActivePath(null)
          setActiveNote(null)
          setDraftMarkdown('')
          setBacklinks([])
        }
      }
      return true
    },
    [activeNoteRef, activePath, activePathRef, draftMarkdownRef, openNote, openTabs, setBacklinks, setError],
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

  const createSaveRequest = useCallback(
    (
      markdown: string,
      customPath?: string,
      customVaultId?: string,
    ): SaveRequest | null => {
      const path = customPath ?? activePathRef.current
      const note = activeNoteRef.current
      const vaultId =
        customVaultId ?? (path ? docVaultsRef.current.get(path) : undefined) ?? note?.metadata.vault_id
      if (!path || !vaultId) return null
      const docKey = `${vaultId}:${path}`
      const draftRevision = draftRevisionsByDocRef.current.get(docKey) ?? draftRevisionRef.current
      return {
        path,
        markdown,
        contentHash:
          savedHashesRef.current.get(path) ??
          (note && note.metadata.path === path ? note.metadata.content_hash : ''),
        navigationGeneration: navigationGenerationRef.current,
        draftRevision,
        overwrite: saveOverwriteRef.current,
        vaultId,
      }
    },
    [activeNoteRef, activePathRef],
  )

  useEffect(() => {
    createSaveRequestRef.current = createSaveRequest
  }, [createSaveRequest])

  const isSaveRequestCurrent = useCallback(
    (request: SaveRequest) => {
      const active = activeNoteRef.current
      if (!active || activePathRef.current !== request.path) return false
      if (active.metadata.vault_id !== request.vaultId) return false
      const docKey = `${request.vaultId}:${request.path}`
      const currentRev = draftRevisionsByDocRef.current.get(docKey) ?? draftRevisionRef.current
      return currentRev === request.draftRevision
    },
    [activeNoteRef, activePathRef],
  )

  const scheduleSavedNoteRefresh = useCallback((refresh: () => Promise<void>) => {
    pendingRefreshRef.current = refresh
    if (refreshingRef.current) return
    refreshingRef.current = true
    void (async () => {
      try {
        while (pendingRefreshRef.current) {
          const next = pendingRefreshRef.current
          pendingRefreshRef.current = null
          try {
            await next()
          } catch (caught) {
            logActivity('error', 'Note saved, but workspace details could not refresh', String(caught))
          }
        }
      } finally {
        refreshingRef.current = false
      }
    })()
  }, [logActivity])

  const saveRequest = useCallback(
    async (request: SaveRequest) => {
      const isCurrent = () => isSaveRequestCurrent(request)
      if (isCurrent()) setError(null)
      try {
        const expectedHash = savedHashesRef.current.get(request.path) ?? request.contentHash
        const saved = await vaultSaveNote(
          request.path,
          request.markdown,
          request.overwrite ? undefined : expectedHash,
          undefined,
          request.vaultId,
        )
        savedHashesRef.current.set(request.path, saved.metadata.content_hash)
        await indexerUpdateNote(request.path)

        setOpenTabs((tabs) =>
          tabs.map((tab) =>
            tab.path === request.path
              ? { ...tab, title: saved.metadata.title, contentHash: saved.metadata.content_hash }
              : tab,
          ),
        )

        if (!isCurrent()) return true

        if (request.overwrite) saveOverwriteRef.current = false
        setExternalChangeConflict(null)
        const document = { metadata: saved.metadata, markdown: request.markdown }
        setActiveNote(document)
        setDraftMarkdown(request.markdown)
        activeNoteRef.current = document
        draftMarkdownRef.current = request.markdown
        setLastSavedAt(new Date().toLocaleTimeString())
        // Derived workspace data must not hold the durable-write queue. Keep
        // at most one running refresh and one latest pending refresh.
        scheduleSavedNoteRefresh(async () => {
          if (!isCurrent()) return
          await refreshVaultCore()
          if (!isCurrent()) return
          await loadBacklinks(request.path)
          if (isCurrent() && searchQuery.trim()) await runSearch(searchQuery)
        })
        if (vaultConfig.export.export_on_save?.enabled && vaultConfig.export.export_on_save.profile_id) {
          const profiles = exportProfilesRef.current ?? []
          const profile = findExportProfile(profiles, vaultConfig.export.export_on_save.profile_id)
          if (profile) {
            void exportStartNote(request.path, profile.id, false).catch((caught) => {
              logActivity('error', 'Note saved, but automatic export failed', String(caught))
            })
          }
        }
        return true
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        if (isCurrent()) {
          if (isContentHashMismatchError(message)) {
            try {
              const disk = await vaultReadNote(request.path)
              if (!isCurrent()) return false
              setExternalChangeConflict({
                path: request.path,
                loaded_hash: request.contentHash,
                disk_hash: disk.metadata.content_hash,
              })
            } catch {
              if (!isCurrent()) return false
              setExternalChangeConflict({
                path: request.path,
                loaded_hash: request.contentHash,
                disk_hash: 'unknown',
              })
            }
            logActivity('error', 'Save blocked — note changed on disk', request.path)
          } else {
            setError(message)
            logActivity('error', `Failed to save ${request.path}`, message)
          }
        } else {
          logActivity('error', `Failed to save ${request.path}`, message)
          setError(`Failed to save ${request.path}: ${message}`)
        }
        return false
      } finally {
        pendingSaveCountRef.current -= 1
        if (pendingSaveCountRef.current === 0) {
          isSavingRef.current = false
          setIsSaving(false)
        }
      }
    },
    [
      activeNoteRef,
      draftMarkdownRef,
      exportProfilesRef,
      isSaveRequestCurrent,
      isSavingRef,
      loadBacklinks,
      logActivity,
      refreshVaultCore,
      runSearch,
      searchQuery,
      scheduleSavedNoteRefresh,
      setError,
      vaultConfig,
    ],
  )

  const performSave = useCallback(
    (request: SaveRequest) => {
      pendingSaveCountRef.current += 1
      isSavingRef.current = true
      setIsSaving(true)
      const docKey = `${request.vaultId}:${request.path}`
      const task = saveTailRef.current.then(() => saveRequest(request))
      inFlightSavesByDocRef.current.set(docKey, task)
      saveTailRef.current = task.then(
        () => undefined,
        () => undefined,
      )
      void task.finally(() => {
        if (inFlightSavesByDocRef.current.get(docKey) === task) {
          inFlightSavesByDocRef.current.delete(docKey)
        }
      })
      return task
    },
    [isSavingRef, saveRequest],
  )

  useEffect(() => {
    performSaveRef.current = performSave
  }, [performSave])

  const flushPendingDocumentSave = useCallback(
    (path: string, vaultId?: string): Promise<boolean> => {
      const targetVaultId =
        vaultId ?? docVaultsRef.current.get(path) ?? activeNoteRef.current?.metadata.vault_id
      if (!targetVaultId) return Promise.resolve(false)
      const docKey = `${targetVaultId}:${path}`
      const timer = saveTimersByDocRef.current.get(docKey)
      if (timer) {
        window.clearTimeout(timer)
        saveTimersByDocRef.current.delete(docKey)
      }
      if (saveTimer.current && activePathRef.current === path) {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      let request: SaveRequest | null | undefined = pendingRequestsByDocRef.current.get(docKey)
      pendingRequestsByDocRef.current.delete(docKey)
      if (activePathRef.current === path) {
        pendingSaveRequestRef.current = null
      }

      if (
        !request &&
        activePathRef.current === path &&
        activeNoteRef.current &&
        draftMarkdownRef.current !== activeNoteRef.current.markdown
      ) {
        request = createSaveRequest(draftMarkdownRef.current, path, targetVaultId)
      }
      if (request) {
        return performSave(request)
      }
      return Promise.resolve(true)
    },
    [activeNoteRef, activePathRef, createSaveRequest, draftMarkdownRef, performSave],
  )

  useEffect(() => {
    flushPendingDocumentSaveRef.current = flushPendingDocumentSave
  }, [flushPendingDocumentSave])

  const flushAllPendingSaves = useCallback(async () => {
    if (activePathRef.current && activeNoteRef.current) {
      void flushPendingDocumentSave(activePathRef.current, activeNoteRef.current.metadata.vault_id)
    }
    for (const [docKey, timer] of Array.from(saveTimersByDocRef.current.entries())) {
      window.clearTimeout(timer)
      saveTimersByDocRef.current.delete(docKey)
      const pending = pendingRequestsByDocRef.current.get(docKey)
      if (pending) {
        pendingRequestsByDocRef.current.delete(docKey)
        void performSave(pending)
      }
    }
    await saveTailRef.current
  }, [activeNoteRef, activePathRef, flushPendingDocumentSave, performSave])

  const scheduleSave = useCallback(
    (markdown: string) => {
      const request = createSaveRequest(markdown)
      if (!request) return
      const docKey = `${request.vaultId}:${request.path}`
      pendingRequestsByDocRef.current.set(docKey, request)
      pendingSaveRequestRef.current = request

      const existingTimer = saveTimersByDocRef.current.get(docKey)
      if (existingTimer) {
        window.clearTimeout(existingTimer)
      }
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current)
      }

      const timer = window.setTimeout(() => {
        saveTimersByDocRef.current.delete(docKey)
        if (saveTimer.current === timer) {
          saveTimer.current = null
        }
        if (pendingSaveRequestRef.current === request) {
          pendingSaveRequestRef.current = null
        }
        const pending = pendingRequestsByDocRef.current.get(docKey)
        if (pending) {
          pendingRequestsByDocRef.current.delete(docKey)
          void performSave(pending)
        }
      }, 700)
      saveTimersByDocRef.current.set(docKey, timer)
      saveTimer.current = timer
    },
    [createSaveRequest, performSave],
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
    const path = activePathRef.current
    const note = activeNoteRef.current
    if (!path || !note) return false
    return flushPendingDocumentSave(path, note.metadata.vault_id)
  }, [activeNoteRef, activePathRef, flushPendingDocumentSave])

  const runNoteMutation = useCallback(
    async (sourcePath: string, runMutation: () => Promise<void>) => {
      const note = activeNoteRef.current
      const navigationGeneration = navigationGenerationRef.current
      const draftRevision = draftRevisionRef.current
      if (sourcePath === activePathRef.current && isSavingRef.current) {
        return false
      }
      const didMutate = await coordinateNoteMutation({
        sourcePath,
        activePath: activePathRef.current,
        isDirty: Boolean(note && draftMarkdownRef.current !== note.markdown),
        saveActiveNote: saveActiveNoteNow,
        runMutation,
      })
      if (didMutate && sourcePath === activePathRef.current) {
        try {
          await syncActiveNoteContent(sourcePath, { navigationGeneration, draftRevision })
        } catch (caught) {
          // The native mutation is already durable. Preserve that successful
          // outcome while making the reconciliation failure observable.
          logActivity(
            'error',
            'Note updated, but the editor could not refresh',
            caught instanceof Error ? caught.message : String(caught),
          )
        }
      }
      return didMutate
    },
    [
      activeNoteRef,
      activePathRef,
      draftMarkdownRef,
      isSavingRef,
      logActivity,
      saveActiveNoteNow,
      syncActiveNoteContent,
    ],
  )

  const updateDraft = useCallback(
    (markdown: string) => {
      draftRevisionRef.current += 1
      setDraftMarkdown(markdown)
      draftMarkdownRef.current = markdown
      scheduleSave(markdown)
    },
    [draftMarkdownRef, scheduleSave],
  )

  const saveVaultImage = useCallback(async (file: File) => {
    if (!isNativeBridgeAvailable()) return null
    const extension = file.name.split('.').pop()?.toLowerCase() || file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
    const relativePath = `assets/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`
    const bytes = Array.from(new Uint8Array(await file.arrayBuffer()))
    await vaultSaveAsset(relativePath, bytes)
    return relativePath
  }, [])

  const importDroppedFiles = useCallback(
    async (files: FileList | File[], options?: Parameters<typeof importVaultFiles>[1]) => {
      const paths = await importVaultFiles(files, options)
      if (paths.length > 0) {
        await indexerApplyFilesystemChanges(paths)
      }
      return paths
    },
    [],
  )

  const generateLinkReferences = useCallback(() => {
    const next = generateLinkReferenceDefinitions(draftMarkdown)
    if (next !== draftMarkdown) {
      updateDraft(next)
    }
  }, [draftMarkdown, updateDraft])

  const flushAllPendingSavesRef = useRef(flushAllPendingSaves)
  useEffect(() => {
    flushAllPendingSavesRef.current = flushAllPendingSaves
  }, [flushAllPendingSaves])

  useEffect(() => {
    return () => {
      void flushAllPendingSavesRef.current()
    }
  }, [])

  const jumpToOutlineHeading = useCallback((heading: OutlineHeading) => {
    setScrollToEditorLine(heading.line)
  }, [])

  const navigateBack = useCallback(() => {
    const current = noteNavRef.current
    if (current.index <= 0) return
    const index = current.index - 1
    const path = current.paths[index]
    if (!path) return
    const nextNav = { paths: current.paths, index }
    noteNavRef.current = nextNav
    setNoteNav(nextNav)
    void loadNote(path)
  }, [loadNote])

  const navigateForward = useCallback(() => {
    const current = noteNavRef.current
    if (current.index >= current.paths.length - 1) return
    const index = current.index + 1
    const path = current.paths[index]
    if (!path) return
    const nextNav = { paths: current.paths, index }
    noteNavRef.current = nextNav
    setNoteNav(nextNav)
    void loadNote(path)
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
    importDroppedFiles,
    generateLinkReferences,
    insertSnippet,
    applyEditorTransform,
    applyEditorTypography,
    saveActiveNoteNow,
    runNoteMutation,
    reloadActiveNoteFromDisk,
    keepEditingAfterExternalChange,
    syncActiveNoteContent,
    jumpToOutlineHeading,
    resetNoteNavigation,
    restoreEditorSession,
    flushPendingDocumentSave,
    flushAllPendingSaves,
  }
}

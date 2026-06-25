import type { ExportProfileContribution } from '@scriptor/core/contracts/plugin'
import type { ExportProfile } from '@scriptor/core/contracts/export'
import type { SnippetCatalogEntry } from '@scriptor/editor'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  indexerListNoteSummaries,
  indexerRebuild,
  indexerResolveWikilink,
  pickVaultFolder,
  vaultLintFix,
  vaultLoadConfig,
  vaultLoadSnippets,
  vaultOpen,
  vaultScan,
} from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'
import type {
  NoteDocument,
  NoteIndexSummary,
  ScannedEntry,
  SearchHit,
  VaultDescriptor,
  VaultConfig,
  VaultSection,
} from '../types/vault'
import { createActivityEntry, type ActivityEntry } from './useActivityLog'
import { useWorkspaceKnowledge } from './useWorkspaceKnowledge'
import { useWorkspaceGit } from './useWorkspaceGit'
import { useWorkspaceExport } from './useWorkspaceExport'
import { useWorkspaceSearch } from './useWorkspaceSearch'
import { useWorkspaceDiagnostics } from './useWorkspaceDiagnostics'
import { useWorkspaceEditor } from './useWorkspaceEditor'
import { useWorkspaceRename } from './useWorkspaceRename'
import { useWorkspaceNoteFactory } from './useWorkspaceNoteFactory'
import { useWorkspaceFilesystemSync } from './useWorkspaceFilesystemSync'
import { buildVaultSections } from './vault/helpers'

type WorkspaceStatus = 'idle' | 'opening' | 'indexing' | 'ready' | 'error'

export type { OutlineHeading } from './vault/helpers'

const DEFAULT_VAULT_CONFIG: VaultConfig = {
  daily_note: {
    directory: 'daily',
    filename_format: '{iso}',
    title_format: '{iso}',
    template_path: null,
  },
  templates_directory: '.scriptor/templates',
  inbox: { enabled: true, period: 'all', new_note_directory: null },
  workflow: { auto_advance_inbox_after_organize: false },
  note_types: { directory: 'type' },
  export: {
    bibliography_path: 'references.bib',
    csl_style_path: 'apa-lite.csl',
    export_on_save: { enabled: false, profile_id: null },
  },
  writing_targets: { daily_words: 500, history_path: '.scriptor/stats-history.json' },
  graph_groups: [],
  extra_roots: [],
  mcp: { mode: 'read-only', disabled: false },
}

export function useVaultWorkspace(options?: { onSearchComplete?: (hits: SearchHit[]) => void }) {
  const [status, setStatus] = useState<WorkspaceStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [vault, setVault] = useState<VaultDescriptor | null>(null)
  const [sections, setSections] = useState<VaultSection[]>([])
  const [entries, setEntries] = useState<ScannedEntry[]>([])
  const [isFixingVaultLint, setIsFixingVaultLint] = useState(false)
  const [vaultConfig, setVaultConfig] = useState<VaultConfig>(DEFAULT_VAULT_CONFIG)
  const [snippetCatalog, setSnippetCatalog] = useState<SnippetCatalogEntry[]>([])
  const [noteSummaries, setNoteSummaries] = useState<NoteIndexSummary[]>([])
  const [sidebarView, setSidebarView] = useState<'vault' | 'inbox'>('vault')
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([])
  const activePathRef = useRef<string | null>(null)
  const activeNoteRef = useRef<NoteDocument | null>(null)
  const draftMarkdownRef = useRef('')
  const isSavingRef = useRef(false)
  const checkExternalChangesRef = useRef<() => Promise<void>>(async () => {})
  const vaultRefreshTimer = useRef<number | null>(null)
  const entriesRef = useRef<ScannedEntry[]>([])
  const applyFilesystemChangesRef = useRef<(paths: string[]) => Promise<void>>(async () => {})
  const loadGraphRef = useRef<(focusPath?: string | null) => Promise<void>>(async () => {})
  const exportProfilesRef = useRef<ExportProfile[]>([])
  const logActivity = useCallback((kind: ActivityEntry['kind'], message: string, detail?: string) => {
    setActivityLog((entries) => [createActivityEntry(kind, message, detail), ...entries].slice(0, 100))
  }, [])

  const {
    searchQuery,
    searchResults,
    isSearching,
    runSearch,
    setVaultSearchQuery,
    clearSearch,
  } = useWorkspaceSearch(options)

  const noteCount = useMemo(() => entries.filter((entry) => entry.kind === 'note').length, [entries])

  const [pluginExportProfiles, setPluginExportProfiles] = useState<ExportProfileContribution[]>([])

  const refreshVaultConfig = useCallback(async () => {
    if (!vault) {
      setVaultConfig(DEFAULT_VAULT_CONFIG)
      return
    }
    try {
      const loaded = await vaultLoadConfig()
      setVaultConfig({
        ...DEFAULT_VAULT_CONFIG,
        ...loaded,
        daily_note: { ...DEFAULT_VAULT_CONFIG.daily_note, ...loaded.daily_note },
        export: { ...DEFAULT_VAULT_CONFIG.export, ...loaded.export },
        writing_targets: {
          daily_words: loaded.writing_targets?.daily_words ?? DEFAULT_VAULT_CONFIG.writing_targets!.daily_words,
          history_path: loaded.writing_targets?.history_path ?? DEFAULT_VAULT_CONFIG.writing_targets!.history_path,
        },
        graph_groups: loaded.graph_groups ?? DEFAULT_VAULT_CONFIG.graph_groups,
        extra_roots: loaded.extra_roots ?? DEFAULT_VAULT_CONFIG.extra_roots,
        mcp: {
          mode: loaded.mcp?.mode ?? DEFAULT_VAULT_CONFIG.mcp!.mode,
          disabled: loaded.mcp?.disabled ?? DEFAULT_VAULT_CONFIG.mcp!.disabled,
        },
        inbox: {
          enabled: loaded.inbox?.enabled ?? DEFAULT_VAULT_CONFIG.inbox!.enabled,
          period: loaded.inbox?.period ?? DEFAULT_VAULT_CONFIG.inbox!.period,
          new_note_directory: loaded.inbox?.new_note_directory ?? null,
        },
        workflow: {
          auto_advance_inbox_after_organize:
            loaded.workflow?.auto_advance_inbox_after_organize ??
            DEFAULT_VAULT_CONFIG.workflow!.auto_advance_inbox_after_organize,
        },
        note_types: {
          directory: loaded.note_types?.directory ?? DEFAULT_VAULT_CONFIG.note_types!.directory,
        },
      })
    } catch {
      setVaultConfig(DEFAULT_VAULT_CONFIG)
    }
  }, [vault])

  const refreshNoteSummaries = useCallback(async () => {
    if (!vault || !isNativeBridgeAvailable()) {
      setNoteSummaries([])
      return
    }
    try {
      const summaries = await indexerListNoteSummaries()
      setNoteSummaries(summaries)
    } catch {
      setNoteSummaries([])
    }
  }, [vault])

  const refreshVaultSnippets = useCallback(async () => {
    if (!vault) {
      setSnippetCatalog([])
      return
    }
    try {
      const snippets = await vaultLoadSnippets()
      setSnippetCatalog(
        snippets.map((snippet) => ({
          name: snippet.name,
          content: snippet.content,
          description: snippet.description ?? undefined,
        })),
      )
    } catch {
      setSnippetCatalog([])
    }
  }, [vault])

  const refreshVaultEntries = useCallback(async () => {
    const scanned = await vaultScan()
    setEntries(scanned)
    setSections(buildVaultSections(scanned))
  }, [])

  const {
    health,
    setHealth,
    healthDiagnostics,
    setHealthDiagnostics,
    rebuild,
    setRebuild,
    backlinks,
    graph,
    refreshHealth,
    loadBacklinks,
    setBacklinks,
    loadGraph,
    rebuildIndex,
    applyFilesystemChanges,
    lastRebuildMs,
  } = useWorkspaceDiagnostics({
    vault,
    setStatus,
    setError,
    logActivity,
    refreshVaultEntries,
    entriesRef,
    activePathRef,
    searchQuery,
    runSearch,
  })

  const refreshVaultCore = useCallback(async () => {
    await refreshVaultEntries()
    await refreshHealth()
    await refreshNoteSummaries()
  }, [refreshHealth, refreshVaultEntries, refreshNoteSummaries])

  const editorRefs = useMemo(
    () => ({
      activePathRef,
      activeNoteRef,
      draftMarkdownRef,
      isSavingRef,
      checkExternalChangesRef,
    }),
    [],
  )

  const editor = useWorkspaceEditor({
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
  })

  const {
    gitStatusState,
    isGitBusy,
    refreshGit,
    commitFiles,
    pullRemote,
    pushRemote,
  } = useWorkspaceGit({
    vaultOpen: Boolean(vault),
    refreshVault: refreshVaultCore,
    logActivity,
    setError,
  })

  const {
    exportProfiles,
    exportResult,
    exportHistory,
    isExporting,
    exportWithProfile,
    cancelExport,
  } = useWorkspaceExport({
    activePath: editor.activePath,
    draftMarkdown: editor.draftMarkdown,
    vaultConfig,
    pluginExportProfiles,
    logActivity,
    setError,
    refreshGit,
  })

  useEffect(() => {
    exportProfilesRef.current = exportProfiles
  }, [exportProfiles])

  const {
    activePath,
    activeNote,
    externalChangeConflict,
    openNote,
    reloadActiveNoteFromDisk,
    keepEditingAfterExternalChange,
  } = editor

  const fixVaultLint = useCallback(async () => {
    if (!vault) return null
    setIsFixingVaultLint(true)
    try {
      const output = await vaultLintFix()
      await refreshVaultCore()
      if (activePathRef.current && output.fixed_paths.includes(activePathRef.current)) {
        await openNote(activePathRef.current)
      }
      logActivity(
        'info',
        output.files_fixed > 0
          ? `Fixed vault lint in ${output.files_fixed} file${output.files_fixed === 1 ? '' : 's'}`
          : 'No fixable vault lint issues remained',
        `${output.edits_applied} edit${output.edits_applied === 1 ? '' : 's'} applied`,
      )
      return output
    } catch (error) {
      logActivity('error', 'Vault lint fix failed', error instanceof Error ? error.message : String(error))
      return null
    } finally {
      setIsFixingVaultLint(false)
    }
  }, [logActivity, openNote, refreshVaultCore, vault])

  const refreshVault = useCallback(async () => {
    await refreshVaultCore()
    await refreshGit()
  }, [refreshGit, refreshVaultCore])

  const rebuildIndexWithGit = useCallback(async () => {
    await rebuildIndex()
    await refreshGit()
  }, [rebuildIndex, refreshGit])

  const rename = useWorkspaceRename({
    activePath,
    setError,
    logActivity,
    refreshVault,
    openNote,
    loadGraph,
  })

  useWorkspaceFilesystemSync({
    vault,
    activePathRef,
    checkExternalChangesRef,
    applyFilesystemChangesRef,
    refreshGit,
    vaultRefreshTimer,
  })

  useEffect(() => {
    entriesRef.current = entries
  }, [entries])

  useEffect(() => {
    applyFilesystemChangesRef.current = applyFilesystemChanges
  }, [applyFilesystemChanges])

  useEffect(() => {
    loadGraphRef.current = loadGraph
  }, [loadGraph])

  const openVaultAt = useCallback(
    async (rootPath: string) => {
      setStatus('opening')
      setError(null)
      clearSearch()
      editor.resetNoteNavigation()

      try {
        const opened = await vaultOpen(rootPath)
        setVault(opened.vault)
        setStatus('indexing')

        const scanned = await vaultScan()
        setEntries(scanned)
        setSections(buildVaultSections(scanned))

        const summary = await indexerRebuild()
        setRebuild(summary)
        setHealth(summary.health)
        setHealthDiagnostics(null)
        setStatus('ready')

        const firstNote = scanned.find((entry) => entry.kind === 'note')
        if (firstNote) {
          await openNote(firstNote.path)
        }
        await refreshHealth(opened.vault)
        await refreshGit()
        await refreshVaultConfig()
        await refreshVaultSnippets()
        await refreshNoteSummaries()
        logActivity('success', `Opened vault ${opened.vault.name}`, rootPath)
      } catch (caught) {
        setStatus('error')
        const message = caught instanceof Error ? caught.message : String(caught)
        setError(message)
        logActivity('error', 'Failed to open vault', message)
      }
    },
    [logActivity, openNote, refreshGit, refreshHealth, refreshVaultConfig, refreshVaultSnippets, refreshNoteSummaries],
  )

  const { inboxNotes, noteTypes, templatePaths } = useWorkspaceKnowledge(noteSummaries, entries, vaultConfig)

  const notes = useWorkspaceNoteFactory({
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
    syncActiveNoteContent: editor.syncActiveNoteContent,
  })

  const chooseVaultFolder = useCallback(async () => {
    const folder = await pickVaultFolder()
    if (!folder) return
    await openVaultAt(folder)
  }, [openVaultAt])

  const openWikilinkTarget = useCallback(
    async (target: string) => {
      const normalized = target.trim()
      try {
        const resolution = await indexerResolveWikilink(normalized)
        if (resolution.kind === 'resolved' && resolution.path) {
          await openNote(resolution.path)
          return
        }
        if (resolution.kind === 'ambiguous') {
          setError(`Ambiguous wikilink "${normalized}" (${resolution.candidates.length} matches)`)
          logActivity('error', 'Ambiguous wikilink', normalized)
          return
        }
      } catch {
        // Fall through to client-side scan when native bridge is unavailable.
      }

      const match = entries.find(
        (entry) =>
          entry.kind === 'note' &&
          (entry.path === normalized ||
            entry.path === `${normalized}.md` ||
            entry.path.endsWith(`/${normalized}.md`) ||
            entry.path.split('/').at(-1)?.replace(/\.md$/i, '') === normalized),
      )

      if (!match) {
        setError(`Could not resolve wikilink: ${normalized}`)
        logActivity('error', 'Unresolved wikilink', normalized)
        return
      }

      await openNote(match.path)
    },
    [entries, logActivity, openNote],
  )

  const commitActiveNote = useCallback(async () => {
    if (!activePath) {
      setError('Open a note before committing.')
      return
    }
    await commitFiles([activePath], `Update ${activeNote?.metadata.title ?? activePath}`)
  }, [activeNote, activePath, commitFiles])

  const graphProgress = useMemo(() => {
    if (!rebuild || noteCount === 0) return 0
    const indexed = rebuild.indexed_notes + rebuild.skipped_notes
    return Math.min(100, Math.round((indexed / noteCount) * 100))
  }, [noteCount, rebuild])

  const visibleSections = useMemo(() => {
    if (!searchQuery.trim() || searchResults.length === 0) {
      return sections
    }

    const paths = new Set(searchResults.map((hit) => hit.path))
    return sections
      .map((section) => ({
        ...section,
        notes: section.notes.filter((note) => paths.has(note)),
        count: section.notes.filter((note) => paths.has(note)).length,
      }))
      .filter((section) => section.count > 0)
  }, [searchQuery, searchResults, sections])

  const problemCount = useMemo(() => {
    const vaultIssues = healthDiagnostics?.issues.length ?? 0
    const gitConflicts = gitStatusState?.conflicted_files.length ?? 0
    const externalChanges = externalChangeConflict ? 1 : 0
    return vaultIssues + gitConflicts + externalChanges
  }, [externalChangeConflict, gitStatusState, healthDiagnostics])

  const { resetNoteNavigation: _resetNoteNavigation, syncActiveNoteContent: _sync, ...editorSurface } = editor

  return {
    status,
    error,
    vault,
    sections: visibleSections,
    entries,
    health,
    healthDiagnostics,
    problemCount,
    rebuild,
    lastRebuildMs,
    noteCount,
    graphProgress,
    ...editorSurface,
    snippetCatalog,
    backlinks,
    graph,
    ...rename,
    gitStatus: gitStatusState,
    exportResult,
    exportHistory,
    isExporting,
    isGitBusy,
    exportProfiles,
    setPluginExportProfiles,
    searchQuery,
    searchResults,
    isSearching,
    activityLog,
    logActivity,
    openVaultAt,
    chooseVaultFolder,
    vaultConfig,
    setVaultConfig,
    reloadActiveNoteFromDisk,
    keepEditingAfterExternalChange,
    refreshVault,
    refreshHealth,
    fixVaultLint,
    isFixingVaultLint,
    rebuildIndex: rebuildIndexWithGit,
    ...notes,
    inboxNotes,
    noteTypes,
    templatePaths,
    noteSummaries,
    sidebarView,
    setSidebarView,
    refreshNoteSummaries,
    openWikilinkTarget,
    setVaultSearchQuery,
    loadGraph,
    exportWithProfile,
    cancelExport,
    commitFiles,
    commitActiveNote,
    pullRemote,
    pushRemote,
    refreshGit,
    refreshVaultConfig,
    refreshVaultSnippets,
  }
}

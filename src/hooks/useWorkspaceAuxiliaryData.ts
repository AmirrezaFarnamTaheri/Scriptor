import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  gitShowMergeBaseFile,
  indexerListBibliography,
  indexerListTags,
  systemInfo,
  vaultListRecentNotes,
  vaultReadNote,
} from '../bridge/commands'
import type { BibliographyEntry } from '../types/vault'

interface RecentNote {
  path: string
  title: string
}

interface KeyedValue<T> {
  key: string
  value: T
}

interface ConflictData {
  path: string
  source: string
  basePreview: string | null
}

interface UseWorkspaceAuxiliaryDataOptions {
  nativeReady: boolean
  vaultId: string | null
  activePath: string | null
  rebuildRevision: unknown
  conflictPath: string | null
  settingsOpen: boolean
}

function noteTitle(path: string): string {
  return path.split('/').pop() ?? path
}

/**
 * Owns async, read-only data that decorates the workspace shell.
 *
 * Returned values are keyed to the inputs that produced them, so a vault/path
 * transition never exposes data from the previous context while a request is in flight.
 */
export function useWorkspaceAuxiliaryData({
  nativeReady,
  vaultId,
  activePath,
  rebuildRevision,
  conflictPath,
  settingsOpen,
}: UseWorkspaceAuxiliaryDataOptions) {
  const vaultKey = nativeReady && vaultId ? vaultId : ''
  const indexKey = vaultKey ? `${vaultKey}:${String(rebuildRevision ?? '')}` : ''
  const [bibliographyState, setBibliographyState] = useState<KeyedValue<BibliographyEntry[]> | null>(null)
  const [tagsState, setTagsState] = useState<KeyedValue<string[]> | null>(null)
  const [recentState, setRecentState] = useState<KeyedValue<RecentNote[]> | null>(null)
  const [conflictState, setConflictState] = useState<ConflictData | null>(null)
  const [systemInfoState, setSystemInfoState] = useState<Awaited<ReturnType<typeof systemInfo>> | null>(null)

  const refreshBibliography = useCallback(async () => {
    if (!indexKey) return
    try {
      const entries = await indexerListBibliography()
      setBibliographyState({ key: indexKey, value: entries })
    } catch {
      setBibliographyState({ key: indexKey, value: [] })
    }
  }, [indexKey])

  useEffect(() => {
    let cancelled = false
    if (!indexKey) return
    void indexerListBibliography()
      .then((entries) => {
        if (!cancelled) setBibliographyState({ key: indexKey, value: entries })
      })
      .catch(() => {
        if (!cancelled) setBibliographyState({ key: indexKey, value: [] })
      })
    return () => {
      cancelled = true
    }
  }, [indexKey])

  useEffect(() => {
    if (!indexKey) return
    let cancelled = false
    void indexerListTags()
      .then((entries) => {
        if (!cancelled) {
          setTagsState({ key: indexKey, value: entries.map((entry) => entry.tag) })
        }
      })
      .catch(() => {
        if (!cancelled) setTagsState({ key: indexKey, value: [] })
      })
    return () => {
      cancelled = true
    }
  }, [indexKey])

  useEffect(() => {
    if (!vaultKey) return
    let cancelled = false
    const requestKey = `${vaultKey}:${activePath ?? ''}`
    void vaultListRecentNotes(16)
      .then((entries) => {
        if (!cancelled) {
          setRecentState({
            key: requestKey,
            value: entries.map((entry) => ({ path: entry.path, title: noteTitle(entry.path) })),
          })
        }
      })
      .catch(() => {
        if (!cancelled) setRecentState({ key: requestKey, value: [] })
      })
    return () => {
      cancelled = true
    }
  }, [activePath, vaultKey])

  useEffect(() => {
    if (!nativeReady || !conflictPath) return
    let cancelled = false
    void Promise.allSettled([vaultReadNote(conflictPath), gitShowMergeBaseFile(conflictPath)]).then(
      ([noteResult, baseResult]) => {
        if (cancelled) return
        setConflictState({
          path: conflictPath,
          source: noteResult.status === 'fulfilled' ? noteResult.value.markdown : '',
          basePreview: baseResult.status === 'fulfilled' ? baseResult.value : null,
        })
      },
    )
    return () => {
      cancelled = true
    }
  }, [conflictPath, nativeReady])

  useEffect(() => {
    if (!nativeReady || !settingsOpen) return
    let cancelled = false
    void systemInfo()
      .then((info) => {
        if (!cancelled) setSystemInfoState(info)
      })
      .catch(() => {
        if (!cancelled) setSystemInfoState(null)
      })
    return () => {
      cancelled = true
    }
  }, [nativeReady, settingsOpen])

  const recentKey = vaultKey ? `${vaultKey}:${activePath ?? ''}` : ''
  return useMemo(
    () => ({
      bibliographyRaw: bibliographyState?.key === indexKey ? bibliographyState.value : [],
      vaultTags: tagsState?.key === indexKey ? tagsState.value : [],
      recentNotes: recentState?.key === recentKey ? recentState.value : [],
      conflictSource: conflictState?.path === conflictPath ? conflictState.source : '',
      conflictBasePreview: conflictState?.path === conflictPath ? conflictState.basePreview : null,
      systemInfo: nativeReady && settingsOpen ? systemInfoState : null,
      refreshBibliography,
    }),
    [
      bibliographyState,
      conflictPath,
      conflictState,
      indexKey,
      nativeReady,
      recentKey,
      recentState,
      refreshBibliography,
      settingsOpen,
      systemInfoState,
      tagsState,
    ],
  )
}

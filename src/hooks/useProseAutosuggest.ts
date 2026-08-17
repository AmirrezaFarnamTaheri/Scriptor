/**
 * useProseAutosuggest
 * --------------------
 * Manages the prose autosuggest corpus for the active editor.
 *
 * Sources:
 *  - current document  — mined live inside the CM extension itself
 *  - open tabs         — extracted from tab file paths (word tokens from path segments)
 *  - vault corpus      — updated via debounced indexer search (word frequency)
 *  - accepted cache    — stored in sessionStorage, managed by the CM extension
 *
 * Usage:
 *  ```tsx
 *  const { attachCorpusSetter } = useProseAutosuggest({ vaultPath })
 *  // After the editor adapter is ready:
 *  useEffect(() => {
 *    if (adapter) attachCorpusSetter((corpus) => adapter.setProseCorpus?.(corpus))
 *  }, [adapter])
 *  ```
 */

import { useCallback, useEffect, useRef } from 'react'
import type { ProseCorpus } from '@scriptor/editor'
import { buildVaultCorpus } from '@scriptor/editor/pure'
import { indexerSearch } from '../bridge/commands/indexer'
import type { SearchHit } from '../types/vault'
export interface ProseAutosuggestConfig {
  /** Path to the current vault root. Used for vault corpus refresh. */
  vaultPath: string | null
  /** Note paths that are currently open in tabs (other than active). */
  openTabPaths?: string[]
  /** Debounce delay (ms) before refreshing vault corpus. Default: 2000 */
  corpusRefreshDebounce?: number
  /** Max vault terms to keep in corpus. Default: 400 */
  maxVaultTerms?: number
}

/** Tokens mined from a note path: folder and file-name words, lowercased. */
function pathTerms(paths: string[]): string[] {
  return paths.flatMap((p) =>
    p
      .replace(/\\/g, '/')
      .split('/')
      .flatMap((seg) => seg.replace(/\.md$/, '').match(/[A-Za-z][a-z]{2,}/g) ?? [])
      .map((w) => w.toLowerCase()),
  )
}

/** Separator that cannot occur in a note path, keeping the memo key unambiguous. */
const TAB_KEY_SEPARATOR = '\u0000'

export function useProseAutosuggest(config: ProseAutosuggestConfig) {
  const {
    vaultPath,
    openTabPaths = [],
    corpusRefreshDebounce = 2000,
    maxVaultTerms = 400,
  } = config

  /** Callback set by the editor once it mounts. */
  const setCorpusRef = useRef<((corpus: ProseCorpus) => void) | null>(null)
  /** Pending debounce timer, cleared on unmount so no work runs after teardown. */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Monotonic id so only the newest refresh may publish a corpus. */
  const requestIdRef = useRef(0)

  // `openTabPaths` defaults to a fresh array each render, so callers key off the
  // joined string instead of the array identity.
  const tabsKey = openTabPaths.join(TAB_KEY_SEPARATOR)

  // ---------------------------------------------------------------------------
  // Vault corpus refresh (debounced)
  // ---------------------------------------------------------------------------

  const refreshVaultCorpus = useCallback(
    (setCorpus: (corpus: ProseCorpus) => void) => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      const requestId = ++requestIdRef.current
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        void (async () => {
          try {
            // Empty query returns the most-recently-indexed hits (broad vocabulary sample).
            const results: SearchHit[] = await indexerSearch('', 200).catch(() => [])
            // A newer refresh (or unmount) superseded this one: drop the result.
            if (requestId !== requestIdRef.current) return

            const vaultContents = results.map((r) => `${r.title} ${r.snippet}`)
            setCorpus({
              vaultTerms: buildVaultCorpus(vaultContents, maxVaultTerms),
              openTabTerms: pathTerms(tabsKey.length === 0 ? [] : tabsKey.split(TAB_KEY_SEPARATOR)),
            })
          } catch {
            // Non-fatal — autosuggest degrades to current-doc only
          }
        })()
      }, corpusRefreshDebounce)
    },
    [corpusRefreshDebounce, maxVaultTerms, tabsKey],
  )

  // Cancel any pending refresh on unmount and invalidate in-flight requests.
  useEffect(
    () => () => {
      requestIdRef.current++
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    },
    [],
  )

  // ---------------------------------------------------------------------------
  // Attach the corpus setter from the editor adapter
  // ---------------------------------------------------------------------------

  const attachCorpusSetter = useCallback(
    (setter: (corpus: ProseCorpus) => void) => {
      setCorpusRef.current = setter
      if (vaultPath) refreshVaultCorpus(setter)
    },
    [vaultPath, refreshVaultCorpus],
  )

  // ---------------------------------------------------------------------------
  // Re-run when vault path or open tabs change
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const setCorpus = setCorpusRef.current
    if (setCorpus && vaultPath) refreshVaultCorpus(setCorpus)
  }, [vaultPath, refreshVaultCorpus])

  return { attachCorpusSetter }
}

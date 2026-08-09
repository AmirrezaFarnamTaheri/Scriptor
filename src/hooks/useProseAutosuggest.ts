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

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { ProseCorpus } from '@scriptor/editor'
import { buildVaultCorpus } from '@scriptor/editor'
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

/** Tiny debounce — avoids importing lodash for a single use. */
function debounce<T extends unknown[]>(fn: (...args: T) => void, delay: number) {
  let timer: ReturnType<typeof setTimeout>
  return (...args: T) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export function useProseAutosuggest(config: ProseAutosuggestConfig) {
  const {
    vaultPath,
    openTabPaths = [],
    corpusRefreshDebounce = 2000,
    maxVaultTerms = 400,
  } = config

  /** Callback set by the editor once it mounts. */
  const setCorpusRef = useRef<((corpus: ProseCorpus) => void) | null>(null)

  // ---------------------------------------------------------------------------
  // Vault corpus refresh (debounced)
  // ---------------------------------------------------------------------------

  const refreshVaultCorpus = useMemo(
    () =>
      debounce(
        async (
          setCorpus: (corpus: ProseCorpus) => void,
          _vaultPath: string,
          tabPaths: string[],
        ) => {
          if (!setCorpus) return

          try {
            // Empty query returns the most-recently-indexed hits (broad vocabulary sample).
            const results: SearchHit[] = await indexerSearch('', 200).catch(() => [])

            const vaultContents = results.map((r) => `${r.title} ${r.snippet}`)
            const vaultTerms = buildVaultCorpus(vaultContents, maxVaultTerms)

            // Build open-tab terms from tab file paths (word tokens from folder/file names).
            const openTabTerms = tabPaths.flatMap((p) =>
              p
                .replace(/\\/g, '/')
                .split('/')
                .flatMap((seg) => seg.replace(/\.md$/, '').match(/[A-Za-z][a-z]{2,}/g) ?? [])
                .map((w) => w.toLowerCase()),
            )

            setCorpus({ vaultTerms, openTabTerms })
          } catch {
            // Non-fatal — autosuggest degrades to current-doc only
          }
        },
        corpusRefreshDebounce,
      ),
    [corpusRefreshDebounce, maxVaultTerms],
  )

  // ---------------------------------------------------------------------------
  // Attach the corpus setter from the editor adapter
  // ---------------------------------------------------------------------------

  const attachCorpusSetter = useCallback(
    (setter: (corpus: ProseCorpus) => void) => {
      setCorpusRef.current = setter
      if (vaultPath) {
        refreshVaultCorpus(setter, vaultPath, openTabPaths)
      }
    },
    [vaultPath, openTabPaths, refreshVaultCorpus],
  )

  // ---------------------------------------------------------------------------
  // Re-run when vault path or open tabs change
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const setCorpus = setCorpusRef.current
    if (setCorpus && vaultPath) {
      refreshVaultCorpus(setCorpus, vaultPath, openTabPaths)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultPath, openTabPaths.join(','), refreshVaultCorpus])

  return { attachCorpusSetter }
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Database, Play, Plus, Trash2 } from 'lucide-react'

import {
  indexerSearchRanked,
  type RankedSearchHit,
} from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'
import {
  loadVaultPresetJson,
  saveVaultPresetJson,
  VAULT_SMART_COLLECTIONS_PATH,
} from '../lib/vaultPresets'
import { VirtualKnowledgeNoteList } from './app/VirtualKnowledgeNoteList'
import type { KnowledgeNoteSummary } from '../types/vault'
import { expectArray, expectRecord, expectString } from '../lib/runtimeSchema'
import { readVersionedStorage, writeVersionedStorage } from '../lib/versionedStorage'

export interface SmartCollection {
  id: string
  label: string
  query: string
}

const STORAGE_KEY = 'scriptor:smart-collections'

const DEFAULT_COLLECTIONS: SmartCollection[] = [
  { id: 'recent-research', label: 'Research notes', query: 'path has #research' },
  { id: 'drafts', label: 'Draft tags', query: 'tag has draft' },
  { id: 'inbox', label: 'Inbox folder', query: 'path matches inbox' },
]

function validateCollections(value: unknown): SmartCollection[] {
  const parsed = expectArray(value, 'smart collections').map((item, index) => {
    const context = `smart collections[${index}]`
    const record = expectRecord(item, context)
    return {
      id: expectString(record, 'id', context),
      label: expectString(record, 'label', context),
      query: expectString(record, 'query', context),
    }
  })
  return parsed.length > 0 ? parsed : DEFAULT_COLLECTIONS
}

function loadCollections(): SmartCollection[] {
  return readVersionedStorage({
    key: STORAGE_KEY,
    schemaVersion: 1,
    fallback: DEFAULT_COLLECTIONS,
    validate: validateCollections,
    migrate: validateCollections,
  })
}

function saveCollections(collections: SmartCollection[]) {
  writeVersionedStorage(STORAGE_KEY, 1, collections)
}

interface SmartCollectionsPanelProps {
  embedded?: boolean
  vaultOpen: boolean
  onOpenNote: (path: string) => void
}

export function SmartCollectionsPanel({ embedded = false, vaultOpen, onOpenNote }: SmartCollectionsPanelProps) {
  const canQuery = vaultOpen && isNativeBridgeAvailable()
  const [collections, setCollections] = useState<SmartCollection[]>(() => loadCollections())
  const [activeId, setActiveId] = useState(collections[0]?.id ?? '')
  const [results, setResults] = useState<KnowledgeNoteSummary[]>([])
  // W3-1: ranked hits stored separately so the score debug affordance can render.
  const [rankedHits, setRankedHits] = useState<RankedSearchHit[]>([])
  const [status, setStatus] = useState('Select a collection to run its DQL query.')
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [usedFuzzy, setUsedFuzzy] = useState(false)
  const [draftLabel, setDraftLabel] = useState('')
  const [draftQuery, setDraftQuery] = useState('path has #tag')

  useEffect(() => {
    if (!vaultOpen) return
    void loadVaultPresetJson<SmartCollection[]>(VAULT_SMART_COLLECTIONS_PATH).then((stored) => {
      if (stored && stored.length > 0) {
        setCollections(stored)
        setActiveId(stored[0]?.id ?? '')
      }
    })
  }, [vaultOpen])

  const activeCollection = useMemo(
    () => collections.find((entry) => entry.id === activeId) ?? collections[0] ?? null,
    [activeId, collections],
  )

  const runQuery = useCallback(
    async (collection: SmartCollection) => {
      if (!canQuery) {
        setStatus('Open a vault in the desktop app to run DQL collections.')
        setResults([])
        setRankedHits([])
        return
      }
      setStatus(`Running "${collection.label}"…`)
      try {
        // W3-1: use ranked search so results are BM25-ordered.
        const out = await indexerSearchRanked(collection.query)
        const mapped: KnowledgeNoteSummary[] = out.hits.map((hit) => ({
          path: hit.path,
          title: hit.title,
          inbound_links: 0,
          outbound_links: 0,
        }))
        setResults(mapped)
        setRankedHits(out.hits)
        setDurationMs(out.durationMs)
        setUsedFuzzy(out.usedFuzzyFallback)
        const suffix = out.usedFuzzyFallback ? ' (fuzzy fallback)' : ''
        setStatus(`${mapped.length} note(s) matched "${collection.label}" in ${out.durationMs}ms${suffix}.`)
      } catch (error) {
        setResults([])
        setRankedHits([])
        setStatus(error instanceof Error ? error.message : 'Search failed')
      }
    },
    [canQuery],
  )

  useEffect(() => {
    if (!canQuery || !activeCollection) return
    let cancelled = false
    const requestedCollection = activeCollection
    void indexerSearchRanked(requestedCollection.query)
      .then((out) => {
        if (cancelled) return
        const mapped: KnowledgeNoteSummary[] = out.hits.map((hit) => ({
          path: hit.path,
          title: hit.title,
          inbound_links: 0,
          outbound_links: 0,
        }))
        setResults(mapped)
        setRankedHits(out.hits)
        setDurationMs(out.durationMs)
        setUsedFuzzy(out.usedFuzzyFallback)
        const suffix = out.usedFuzzyFallback ? ' (fuzzy fallback)' : ''
        setStatus(`${mapped.length} note(s) matched "${requestedCollection.label}" in ${out.durationMs}ms${suffix}.`)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setResults([])
        setRankedHits([])
        setStatus(error instanceof Error ? error.message : 'Search failed')
      })
    return () => {
      cancelled = true
    }
  }, [activeCollection, canQuery])

  const addCollection = () => {
    const label = draftLabel.trim()
    const query = draftQuery.trim()
    if (!label || !query) return
    const entry: SmartCollection = { id: crypto.randomUUID(), label, query }
    const next = [...collections, entry]
    setCollections(next)
    saveCollections(next)
    setActiveId(entry.id)
    setDraftLabel('')
  }

  const removeCollection = (id: string) => {
    const next = collections.filter((entry) => entry.id !== id)
    setCollections(next)
    saveCollections(next)
    if (activeId === id) setActiveId(next[0]?.id ?? '')
  }

  return (
    <div className={`smart-collections-panel${embedded ? ' knowledge-workbench-embed' : ''}`}>
      {!embedded ? (
        <header className="smart-collections-header">
          <h3>
            <Database size={16} />
            Smart collections
          </h3>
          <p className="health-subtitle">Persistent DQL folders that stay in sync with the vault index.</p>
          {vaultOpen ? (
            <button
              type="button"
              className="toolbar-button"
              onClick={() => {
                void saveVaultPresetJson(VAULT_SMART_COLLECTIONS_PATH, collections)
                saveCollections(collections)
              }}
            >
              Save presets to vault
            </button>
          ) : null}
        </header>
      ) : (
        <p className="health-subtitle">{status}</p>
      )}

      <div className="smart-collections-layout">
        <aside className="smart-collections-sidebar" aria-label="Collection list">
          {collections.map((collection) => (
            <div key={collection.id} className={activeId === collection.id ? 'smart-collection active' : 'smart-collection'}>
              <button type="button" onClick={() => setActiveId(collection.id)}>
                {collection.label}
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove ${collection.label}`}
                onClick={() => removeCollection(collection.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </aside>

        <div className="smart-collections-main">
          {activeCollection ? (
            <>
              <div className="smart-collections-toolbar">
                <code className="smart-collection-query">{activeCollection.query}</code>
                <button type="button" className="toolbar-button" onClick={() => void runQuery(activeCollection)}>
                  <Play size={14} />
                  Refresh
                </button>
              </div>
              {embedded ? null : (
                <p className="health-subtitle">
                  {status}
                  {/* W3-1: score debug affordance — shows BM25 column breakdown */}
                  {durationMs !== null && !usedFuzzy && rankedHits.length > 0 && (
                    <details className="search-score-debug" style={{ display: 'inline', marginLeft: '0.5rem' }}>
                      <summary style={{ cursor: 'pointer', fontSize: '0.75em', opacity: 0.6 }}>score debug</summary>
                      <table className="score-debug-table" style={{ fontSize: '0.7em', borderCollapse: 'collapse', marginTop: '0.25rem' }}>
                        <thead>
                          <tr>
                            <th>title</th><th>headings</th><th>tags</th><th>body</th><th>total</th><th>path</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rankedHits.slice(0, 10).map((hit) =>
                            hit.scoreDebug ? (
                              <tr key={hit.path}>
                                <td>{hit.scoreDebug.titleScore.toFixed(3)}</td>
                                <td>{hit.scoreDebug.headingScore.toFixed(3)}</td>
                                <td>{hit.scoreDebug.tagScore.toFixed(3)}</td>
                                <td>{hit.scoreDebug.bodyScore.toFixed(3)}</td>
                                <td><strong>{hit.scoreDebug.bm25Total.toFixed(3)}</strong></td>
                                <td style={{ maxWidth: '16rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hit.path}</td>
                              </tr>
                            ) : null
                          )}
                        </tbody>
                      </table>
                    </details>
                  )}
                </p>
              )}
              {results.length === 0 ? (
                <p className="empty-state">No notes matched this collection.</p>
              ) : (
                <VirtualKnowledgeNoteList notes={results} onOpenNote={onOpenNote} triageLabel="Open" />
              )}
            </>
          ) : (
            <p className="empty-state">Add a smart collection to get started.</p>
          )}

          <form
            className="smart-collection-form saved-views-form"
            onSubmit={(event) => {
              event.preventDefault()
              addCollection()
            }}
          >
            <h4>New collection</h4>
            <label>
              Label
              <input value={draftLabel} onChange={(event) => setDraftLabel(event.target.value)} placeholder="Weekly review" />
            </label>
            <label>
              DQL query
              <input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="path has #review" />
            </label>
            <button type="submit" className="primary-button">
              <Plus size={14} />
              Add collection
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

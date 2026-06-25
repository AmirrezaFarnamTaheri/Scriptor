import { useCallback, useEffect, useMemo, useState } from 'react'
import { Database, Play, Plus, Trash2 } from 'lucide-react'

import { indexerExecuteDql } from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'
import { VirtualKnowledgeNoteList } from './app/VirtualKnowledgeNoteList'
import type { KnowledgeNoteSummary } from '../types/vault'

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

function loadCollections(): SmartCollection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_COLLECTIONS
    const parsed = JSON.parse(raw) as SmartCollection[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_COLLECTIONS
  } catch {
    return DEFAULT_COLLECTIONS
  }
}

function saveCollections(collections: SmartCollection[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collections))
  } catch {
    // ignore storage failures
  }
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
  const [status, setStatus] = useState('Select a collection to run its DQL query.')
  const [draftLabel, setDraftLabel] = useState('')
  const [draftQuery, setDraftQuery] = useState('path has #tag')

  const activeCollection = useMemo(
    () => collections.find((entry) => entry.id === activeId) ?? collections[0] ?? null,
    [activeId, collections],
  )

  const runQuery = useCallback(
    async (collection: SmartCollection) => {
      if (!canQuery) {
        setStatus('Open a vault in the desktop app to run DQL collections.')
        setResults([])
        return
      }
      setStatus(`Running "${collection.label}"…`)
      try {
        const rows = await indexerExecuteDql(collection.query)
        const mapped: KnowledgeNoteSummary[] = rows.map((row) => ({
          path: row.path,
          title: row.title,
          inbound_links: 0,
          outbound_links: 0,
        }))
        setResults(mapped)
        setStatus(`${mapped.length} note(s) matched "${collection.label}".`)
      } catch (error) {
        setResults([])
        setStatus(error instanceof Error ? error.message : 'DQL query failed')
      }
    },
    [canQuery],
  )

  useEffect(() => {
    if (!activeCollection) return
    void runQuery(activeCollection)
  }, [activeCollection?.id, canQuery])

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
              {embedded ? null : <p className="health-subtitle">{status}</p>}
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

import { useEffect, useMemo, useState } from 'react'
import { Filter, X } from 'lucide-react'

import {
  indexerListDeadEnds,
  indexerListOrphans,
  indexerListUnresolvedTargets,
} from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { VirtualKnowledgeNoteList } from './app/VirtualKnowledgeNoteList'
import type { KnowledgeNoteSummary, UnresolvedLinkTarget } from '../types/vault'

interface KnowledgeFiltersPanelProps {
  embedded?: boolean
  vaultOpen: boolean
  onClose: () => void
  onOpenNote: (path: string) => void
  onCreateNoteFromWikilink?: (target: string) => void
}

type FilterTab = 'orphans' | 'dead-ends' | 'placeholders'

export function KnowledgeFiltersPanel({
  embedded = false,
  vaultOpen,
  onClose,
  onOpenNote,
  onCreateNoteFromWikilink,
}: KnowledgeFiltersPanelProps) {
  const canBrowse = vaultOpen && isNativeBridgeAvailable()
  const [tab, setTab] = useState<FilterTab>('orphans')
  const [orphans, setOrphans] = useState<KnowledgeNoteSummary[]>([])
  const [deadEnds, setDeadEnds] = useState<KnowledgeNoteSummary[]>([])
  const [placeholders, setPlaceholders] = useState<UnresolvedLinkTarget[]>([])
  const [loadStatus, setLoadStatus] = useState('Loading knowledge filters…')
  const [triageIndex, setTriageIndex] = useState(0)

  useEscapeToClose(!embedded, onClose)

  useEffect(() => {
    if (!canBrowse) return

    let cancelled = false
    void (async () => {
      try {
        const [orphanRows, deadEndRows, placeholderRows] = await Promise.all([
          indexerListOrphans(),
          indexerListDeadEnds(),
          indexerListUnresolvedTargets(),
        ])
        if (cancelled) return
        setOrphans(orphanRows)
        setDeadEnds(deadEndRows)
        setPlaceholders(placeholderRows)
        setLoadStatus(
          `${orphanRows.length} orphans · ${deadEndRows.length} dead ends · ${placeholderRows.length} unresolved targets`,
        )
      } catch (error) {
        if (!cancelled) {
          setLoadStatus(error instanceof Error ? error.message : 'Could not load knowledge filters')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [canBrowse])

  const activeNotes = useMemo(() => {
    if (tab === 'orphans') return orphans
    if (tab === 'dead-ends') return deadEnds
    return []
  }, [deadEnds, orphans, tab])

  const triageNote = activeNotes[triageIndex] ?? null

  const startTriage = () => {
    if (activeNotes.length === 0) return
    setTriageIndex(0)
    onOpenNote(activeNotes[0]!.path)
  }

  const triageNext = (path: string) => {
    const index = activeNotes.findIndex((note) => note.path === path)
    const nextIndex = index >= 0 ? index + 1 : triageIndex + 1
    if (nextIndex < activeNotes.length) {
      setTriageIndex(nextIndex)
      onOpenNote(activeNotes[nextIndex]!.path)
    }
  }

  const status = useMemo(() => {
    if (!canBrowse) return 'Open a vault in the desktop app to browse knowledge filters.'
    return loadStatus
  }, [canBrowse, loadStatus])

  const body = (
    <>
      {embedded ? <p className="health-subtitle">{status}</p> : null}

      <div className="knowledge-filter-tabs" role="tablist" aria-label="Filter categories">
          {(
            [
              ['orphans', `Orphans (${orphans.length})`],
              ['dead-ends', `Dead ends (${deadEnds.length})`],
              ['placeholders', `Unresolved (${placeholders.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? 'active' : undefined}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="knowledge-filter-body">
          {tab !== 'placeholders' && activeNotes.length > 0 ? (
            <div className="knowledge-triage-bar">
              <button type="button" className="toolbar-button" onClick={startTriage}>
                Start triage ({activeNotes.length})
              </button>
              {triageNote ? (
                <span className="health-subtitle">
                  Triage {triageIndex + 1} of {activeNotes.length}: {triageNote.title}
                </span>
              ) : null}
            </div>
          ) : null}
          {tab === 'placeholders' ? (
            placeholders.length === 0 ? (
              <p className="empty-state">No unresolved wikilink targets.</p>
            ) : (
              <ul className="knowledge-target-list">
                {placeholders.map((target) => (
                  <li key={target.target}>
                    <strong>[[{target.target}]]</strong>
                    <small>
                      {target.reference_count} reference{target.reference_count === 1 ? '' : 's'}
                    </small>
                    {onCreateNoteFromWikilink ? (
                      <button
                        type="button"
                        className="knowledge-create-note"
                        onClick={() => onCreateNoteFromWikilink(target.target)}
                      >
                        Create note
                      </button>
                    ) : null}
                    <div className="knowledge-target-refs">
                      {target.referencing_paths.map((path) => (
                        <button key={path} type="button" onClick={() => onOpenNote(path)}>
                          {path}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : activeNotes.length === 0 ? (
            <p className="empty-state">No notes in this category.</p>
          ) : (
            <VirtualKnowledgeNoteList
              notes={activeNotes}
              onOpenNote={onOpenNote}
              triageLabel="Next"
              onTriageNext={triageNext}
            />
          )}
        </div>
    </>
  )

  if (embedded) {
    return <div className="knowledge-workbench-embed">{body}</div>
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="knowledge-filters-panel"
        role="dialog"
        aria-label="Knowledge filters"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2>
              <Filter size={18} />
              Knowledge filters
            </h2>
            <p className="health-subtitle">{status}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close knowledge filters">
            <X />
          </button>
        </header>
        {body}
      </section>
    </div>
  )
}

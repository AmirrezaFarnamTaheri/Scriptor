import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react'
import { Filter } from 'lucide-react'

import {
  indexerListDeadEnds,
  indexerListOrphans,
  indexerListUnresolvedTargets,
} from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'
import { VirtualKnowledgeNoteList } from './app/VirtualKnowledgeNoteList'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import { EmptyState } from './EmptyState'
import type { KnowledgeNoteSummary, UnresolvedLinkTarget } from '../types/vault'

interface KnowledgeFiltersPanelProps {
  embedded?: boolean
  vaultOpen: boolean
  onClose: () => void
  onOpenNote: (path: string) => void
  onCreateNoteFromWikilink?: (target: string) => void
}

type FilterTab = 'orphans' | 'dead-ends' | 'placeholders'

const FILTER_TABS: FilterTab[] = ['orphans', 'dead-ends', 'placeholders']

/** Presents indexed link-health filters with retryable loading, keyboard tabs, and triage actions. */
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
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadStatus, setLoadStatus] = useState('Loading knowledge filters…')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [triageIndex, setTriageIndex] = useState(0)
  const tabIdBase = useId()

  useEffect(() => {
    if (!canBrowse) return

    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a renewed index load must not leave stale success/error UI visible
    setLoadState('loading')
    setLoadStatus('Loading knowledge filters…')
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
        setLoadState('ready')
        setLoadStatus('')
      } catch (error) {
        if (!cancelled) {
          setLoadState('error')
          setLoadStatus(error instanceof Error ? error.message : 'Could not load knowledge filters')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [canBrowse, loadAttempt])

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

  const retryLoad = () => {
    setLoadState('loading')
    setLoadStatus('Loading knowledge filters…')
    setLoadAttempt((attempt) => attempt + 1)
  }

  const status = useMemo(() => {
    if (!canBrowse) return 'Open a vault in the desktop app to browse knowledge filters.'
    return loadStatus
  }, [canBrowse, loadStatus])

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (direction === 0 && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? FILTER_TABS.length - 1
          : (index + direction + FILTER_TABS.length) % FILTER_TABS.length
    const nextTab = FILTER_TABS[nextIndex]!
    setTab(nextTab)
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`#${CSS.escape(`${tabIdBase}-${nextTab}`)}`)
      ?.focus()
  }

  const body = (
    <>
      <div className="knowledge-filter-tabs" role="tablist" aria-label="Filter categories">
        {(
          [
            ['orphans', `Orphans (${orphans.length})`],
            ['dead-ends', `Dead ends (${deadEnds.length})`],
            ['placeholders', `Unresolved (${placeholders.length})`],
          ] as const
        ).map(([id, label], index) => (
          <button
            id={`${tabIdBase}-${id}`}
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`${tabIdBase}-panel`}
            tabIndex={tab === id ? 0 : -1}
            className={tab === id ? 'active' : undefined}
            onClick={() => setTab(id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        id={`${tabIdBase}-panel`}
        className="knowledge-filter-body"
        role="tabpanel"
        aria-labelledby={`${tabIdBase}-${tab}`}
      >
        {!canBrowse ? (
          <EmptyState
            icon={<Filter />}
            title="Open a vault to inspect link health"
            description="Knowledge repair uses the desktop index for orphan, dead-end, and unresolved-link detection."
          />
        ) : loadState === 'loading' ? (
          <p className="health-subtitle knowledge-filter-loading" role="status">
            Loading knowledge repair data…
          </p>
        ) : loadState === 'error' ? (
          <EmptyState
            icon={<Filter />}
            title="Knowledge repair is unavailable"
            description={loadStatus}
            action={{ label: 'Retry', onClick: retryLoad }}
          />
        ) : (
          <>
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
                <EmptyState
                  icon={<Filter />}
                  title="No unresolved links"
                  description="Every wikilink target currently resolves to an indexed note."
                />
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
              <EmptyState
                icon={<Filter />}
                title={tab === 'orphans' ? 'No orphan notes' : 'No dead-end notes'}
                description={
                  tab === 'orphans'
                    ? 'Every indexed note has at least one inbound link.'
                    : 'Every indexed note links onward to another note.'
                }
              />
            ) : (
              <VirtualKnowledgeNoteList
                notes={activeNotes}
                onOpenNote={onOpenNote}
                triageLabel="Next"
                onTriageNext={triageNext}
              />
            )}
          </>
        )}
      </div>
    </>
  )

  if (embedded) {
    return <div className="knowledge-workbench-embed">{body}</div>
  }

  return (
    <UnifiedPanelShell
      title="Knowledge filters"
      subtitle={status}
      icon={<Filter size={18} />}
      ariaLabel="Knowledge filters"
      onClose={onClose}
      className="knowledge-filters-panel knowledge-filter-dialog"
    >
      {body}
    </UnifiedPanelShell>
  )
}

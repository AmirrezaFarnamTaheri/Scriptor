import { memo, useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react'
import { Filter } from 'lucide-react'

import {
  indexerListDeadEnds,
  indexerListOrphans,
  indexerListUnresolvedTargets,
} from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'
import { useI18n } from '../lib/i18n'
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
export const KnowledgeFiltersPanel = memo(function KnowledgeFiltersPanel({
  embedded = false,
  vaultOpen,
  onClose,
  onOpenNote,
  onCreateNoteFromWikilink,
}: KnowledgeFiltersPanelProps) {
  const { t } = useI18n()
  const canBrowse = vaultOpen && isNativeBridgeAvailable()
  const [tab, setTab] = useState<FilterTab>('orphans')
  const [orphans, setOrphans] = useState<KnowledgeNoteSummary[]>([])
  const [deadEnds, setDeadEnds] = useState<KnowledgeNoteSummary[]>([])
  const [placeholders, setPlaceholders] = useState<UnresolvedLinkTarget[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadStatus, setLoadStatus] = useState(() => t('knowledge.filters.loading'))
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [triageIndex, setTriageIndex] = useState<number | null>(null)
  const tabIdBase = useId()

  useEffect(() => {
    if (!canBrowse) return

    let cancelled = false
    setLoadState('loading')
    setLoadStatus(t('knowledge.filters.loading'))
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
          setLoadStatus(error instanceof Error ? error.message : t('knowledge.filters.loadError'))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [canBrowse, loadAttempt, t])

  const activeNotes = useMemo(() => {
    if (tab === 'orphans') return orphans
    if (tab === 'dead-ends') return deadEnds
    return []
  }, [deadEnds, orphans, tab])

  useEffect(() => {
    setTriageIndex((current) =>
      current === null ? null : Math.min(current, Math.max(0, activeNotes.length - 1)),
    )
  }, [activeNotes.length])

  useEffect(() => {
    setTriageIndex(null)
  }, [tab])

  const triageNote = triageIndex === null ? null : activeNotes[triageIndex] ?? null

  const startTriage = () => {
    if (activeNotes.length === 0) return
    setTriageIndex(0)
    onOpenNote(activeNotes[0]!.path)
  }

  const triageNext = (path: string) => {
    if (triageIndex === null) return
    const index = activeNotes.findIndex((note) => note.path === path)
    const nextIndex = index >= 0 ? index + 1 : triageIndex + 1
    if (nextIndex < activeNotes.length) {
      setTriageIndex(nextIndex)
      onOpenNote(activeNotes[nextIndex]!.path)
    } else {
      setTriageIndex(null)
    }
  }

  const retryLoad = () => {
    setLoadState('loading')
    setLoadStatus(t('knowledge.filters.loading'))
    setLoadAttempt((attempt) => attempt + 1)
  }

  const status = useMemo(() => {
    if (!canBrowse) return t('knowledge.filters.openVaultStatus')
    return loadStatus
  }, [canBrowse, loadStatus, t])

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
      <div className="knowledge-filter-tabs" role="tablist" aria-label={t('knowledge.filters.categories')}>
        {(
          [
            ['orphans', t('knowledge.filters.orphans', { count: orphans.length })],
            ['dead-ends', t('knowledge.filters.deadEnds', { count: deadEnds.length })],
            ['placeholders', t('knowledge.filters.unresolved', { count: placeholders.length })],
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
            title={t('knowledge.filters.openVaultTitle')}
            description={t('knowledge.filters.openVaultDescription')}
          />
        ) : loadState === 'loading' ? (
          <p className="health-subtitle knowledge-filter-loading" role="status">
            {t('knowledge.filters.loadingRepair')}
          </p>
        ) : loadState === 'error' ? (
          <EmptyState
            icon={<Filter />}
            title={t('knowledge.filters.unavailableTitle')}
            description={loadStatus}
            action={{ label: t('actions.retry'), onClick: retryLoad }}
          />
        ) : (
          <>
            {tab !== 'placeholders' && activeNotes.length > 0 ? (
              <div className="knowledge-triage-bar">
                <button type="button" className="toolbar-button" onClick={startTriage}>
                  {t('knowledge.filters.startTriage', { count: activeNotes.length })}
                </button>
                {triageNote ? (
                  <span className="health-subtitle">
                    {t('knowledge.filters.triageProgress', {
                      current: (triageIndex ?? 0) + 1,
                      count: activeNotes.length,
                      title: triageNote.title,
                    })}
                  </span>
                ) : null}
              </div>
            ) : null}
            {tab === 'placeholders' ? (
              placeholders.length === 0 ? (
                <EmptyState
                  icon={<Filter />}
                  title={t('knowledge.filters.noUnresolvedTitle')}
                  description={t('knowledge.filters.noUnresolvedDescription')}
                />
              ) : (
                <ul className="knowledge-target-list">
                  {placeholders.map((target) => (
                    <li key={target.target}>
                      <strong>[[{target.target}]]</strong>
                      <small>
                        {t(target.reference_count === 1 ? 'knowledge.filters.reference' : 'knowledge.filters.references', { count: target.reference_count })}
                      </small>
                      {onCreateNoteFromWikilink ? (
                        <button
                          type="button"
                          className="knowledge-create-note"
                          onClick={() => onCreateNoteFromWikilink(target.target)}
                        >
                          {t('knowledge.filters.createNote')}
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
                title={t(tab === 'orphans' ? 'knowledge.filters.noOrphansTitle' : 'knowledge.filters.noDeadEndsTitle')}
                description={
                  tab === 'orphans'
                    ? t('knowledge.filters.noOrphansDescription')
                    : t('knowledge.filters.noDeadEndsDescription')
                }
              />
            ) : (
              <VirtualKnowledgeNoteList
                notes={activeNotes}
                onOpenNote={onOpenNote}
                triageLabel={t('actions.next')}
                triageActionPath={triageNote?.path}
                onTriageNext={triageNote ? triageNext : undefined}
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
      title={t('knowledge.filters.title')}
      subtitle={status}
      icon={<Filter size={18} />}
      ariaLabel={t('knowledge.filters.title')}
      onClose={onClose}
      className="knowledge-filters-panel knowledge-filter-dialog"
    >
      {body}
    </UnifiedPanelShell>
  )
})


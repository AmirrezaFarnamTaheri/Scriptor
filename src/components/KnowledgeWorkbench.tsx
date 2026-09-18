import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, Network } from 'lucide-react'

import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import { KnowledgeFiltersPanel } from './KnowledgeFiltersPanel'
import { SavedViewsPanel } from './SavedViewsPanel'
import { SmartCollectionsPanel } from './SmartCollectionsPanel'
import { TagBrowserPanel } from './TagBrowserPanel'
import { useI18n } from '../lib/i18n'

export type KnowledgeWorkbenchTab = 'repair' | 'views' | 'collections' | 'tags' | 'discover'

interface KnowledgeWorkbenchProps {
  vaultOpen: boolean
  vaultId?: string | null
  initialTab?: KnowledgeWorkbenchTab
  activePath: string | null
  onClose: () => void
  onOpenNote: (path: string) => void
  onOpenGraph: () => void
  onCreateNoteFromWikilink?: (target: string) => void
  onInsertTag: (tag: string) => void
  onRenameTag?: (tag: string) => void
  promptText: (request: {
    title: string
    label: string
    defaultValue: string
    submitLabel?: string
  }) => Promise<string | null>
}

const TABS = [
  { id: 'repair', labelKey: 'knowledge.repair' },
  { id: 'views', labelKey: 'knowledge.views' },
  { id: 'collections', labelKey: 'knowledge.collections' },
  { id: 'tags', labelKey: 'knowledge.tags' },
  { id: 'discover', labelKey: 'knowledge.discover' },
] as const

export const KnowledgeWorkbench = memo(function KnowledgeWorkbench({
  vaultOpen,
  vaultId = null,
  initialTab = 'repair',
  activePath,
  onClose,
  onOpenNote,
  onOpenGraph,
  onCreateNoteFromWikilink,
  onInsertTag,
  onRenameTag,
  promptText,
}: KnowledgeWorkbenchProps) {
  const { t } = useI18n()
  const [tab, setTab] = useState<KnowledgeWorkbenchTab>(initialTab)

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab)
    }
  }, [initialTab])

  const handleOpenNote = useCallback((path: string) => {
    onOpenNote(path)
    onClose()
  }, [onClose, onOpenNote])

  const handleTabChange = useCallback((next: string) => {
    setTab(next as KnowledgeWorkbenchTab)
  }, [])

  const tabs = useMemo(
    () => TABS.map((entry) => ({ id: entry.id, label: t(entry.labelKey) })),
    [t],
  )

  return (
    <UnifiedPanelShell
      title={t('knowledge.title')}
      subtitle={t('knowledge.subtitle')}
      icon={<BookOpen size={18} />}
      ariaLabel={t('knowledge.title')}
      onClose={onClose}
      tabs={tabs}
      activeTab={tab}
      onTabChange={handleTabChange}
      className="knowledge-workbench-panel knowledge-filters-panel"
      wide
    >
      {tab === 'repair' ? (
        <KnowledgeFiltersPanel
          embedded
          vaultOpen={vaultOpen}
          onClose={onClose}
          onOpenNote={onOpenNote}
          onCreateNoteFromWikilink={onCreateNoteFromWikilink}
        />
      ) : null}

      {tab === 'views' ? (
        <SavedViewsPanel
          embedded
          vaultOpen={vaultOpen}
          vaultId={vaultId}
          onClose={onClose}
          promptText={promptText}
          onOpenNote={handleOpenNote}
        />
      ) : null}

      {tab === 'collections' ? (
        <SmartCollectionsPanel embedded vaultOpen={vaultOpen} vaultId={vaultId} onOpenNote={handleOpenNote} />
      ) : null}

      {tab === 'tags' ? (
        <TagBrowserPanel
          embedded
          vaultOpen={vaultOpen}
          onClose={onClose}
          onOpenNote={handleOpenNote}
          onInsertTag={onInsertTag}
          onRenameTag={onRenameTag}
        />
      ) : null}

      {tab === 'discover' ? (
        <div className="knowledge-workbench-embed knowledge-discover-pane">
          <p className="health-subtitle">
            {t('knowledge.discoverDescription')}
          </p>
          <div className="knowledge-discover-actions">
            <button
              type="button"
              className="primary-button"
              disabled={!vaultOpen}
              onClick={() => {
                onOpenGraph()
                onClose()
              }}
            >
              <Network size={14} />
              {t('knowledge.openGraph')}
            </button>
            <button type="button" className="toolbar-button" onClick={() => setTab('repair')}>
              {t('knowledge.unresolvedInbox')}
            </button>
            <button type="button" className="toolbar-button" onClick={() => setTab('collections')}>
              {t('knowledge.smartCollections')}
            </button>
            <button type="button" className="toolbar-button" onClick={() => setTab('tags')}>
              {t('knowledge.tagBrowser')}
            </button>
          </div>
          {activePath ? (
            <p className="health-subtitle">
              {t('knowledge.graphFocus')} <strong>{activePath}</strong>
            </p>
          ) : (
            <p className="empty-state">{t('knowledge.openNoteForGraph')}</p>
          )}
        </div>
      ) : null}
    </UnifiedPanelShell>
  )
})

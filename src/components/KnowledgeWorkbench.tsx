import { useState } from 'react'
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

export function KnowledgeWorkbench({
  vaultOpen,
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

  const handleOpenNote = (path: string) => {
    onOpenNote(path)
    onClose()
  }

  return (
    <UnifiedPanelShell
      title={t('knowledge.title')}
      subtitle={t('knowledge.subtitle')}
      icon={<BookOpen size={18} />}
      ariaLabel={t('knowledge.title')}
      onClose={onClose}
      tabs={TABS.map((entry) => ({ id: entry.id, label: t(entry.labelKey) }))}
      activeTab={tab}
      onTabChange={(next) => setTab(next as KnowledgeWorkbenchTab)}
      className="knowledge-workbench-panel knowledge-filters-panel"
      wide
    >
      {tab === 'repair' ? (
        <KnowledgeFiltersPanel
          embedded
          vaultOpen={vaultOpen}
          onClose={onClose}
          onOpenNote={handleOpenNote}
          onCreateNoteFromWikilink={onCreateNoteFromWikilink}
        />
      ) : null}

      {tab === 'views' ? (
        <SavedViewsPanel
          embedded
          vaultOpen={vaultOpen}
          onClose={onClose}
          promptText={promptText}
          onOpenNote={handleOpenNote}
        />
      ) : null}

      {tab === 'collections' ? (
        <SmartCollectionsPanel embedded vaultOpen={vaultOpen} onOpenNote={handleOpenNote} />
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
            Navigate relationships, triage backlinks, and jump into graph-assisted curation.
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
              Open knowledge graph
            </button>
            <button type="button" className="toolbar-button" onClick={() => setTab('repair')}>
              Unresolved link inbox
            </button>
            <button type="button" className="toolbar-button" onClick={() => setTab('collections')}>
              Smart collections
            </button>
            <button type="button" className="toolbar-button" onClick={() => setTab('tags')}>
              Tag browser
            </button>
          </div>
          {activePath ? (
            <p className="health-subtitle">
              Graph focus: <strong>{activePath}</strong>
            </p>
          ) : (
            <p className="empty-state">Open a note to focus the graph on its neighborhood.</p>
          )}
        </div>
      ) : null}
    </UnifiedPanelShell>
  )
}

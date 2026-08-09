import { BookOpen, AlertTriangle, CheckCircle2, RefreshCw, Plus, Lock } from 'lucide-react'
import { WidgetCard } from '../chrome/WorkspaceChrome'
import {
  CITATION_PLUGIN_CAPABILITY_ID,
  CITATION_PLUGIN_ID,
  citationsPluginManifest,
  isCitationsPluginEnabled,
} from './citation-plugin-manifest.ts'

export {
  CITATION_PLUGIN_CAPABILITY_ID,
  CITATION_PLUGIN_ID,
  citationsPluginManifest,
  isCitationsPluginEnabled,
}

export interface CitationInspectorProps {
  isEnabled?: boolean
  enabledPlugins?: string[]
  citationKeys?: string[]
  bibliographyKeys?: Set<string> | string[]
  bibliographyPath?: string
  onOpenBibliography?: () => void
  onInsertCitation?: (key: string) => void
  onSyncZotero?: () => void
  onEnablePlugin?: () => void
}

export function CitationInspector({
  isEnabled,
  enabledPlugins,
  citationKeys = [],
  bibliographyKeys = new Set(),
  bibliographyPath = 'references.bib',
  onOpenBibliography,
  onInsertCitation,
  onSyncZotero,
  onEnablePlugin,
}: CitationInspectorProps) {
  const pluginEnabled = isEnabled ?? isCitationsPluginEnabled(enabledPlugins)

  if (!pluginEnabled) {
    return (
      <WidgetCard title="Citations & Bibliography">
        <div className="citation-inspector-disabled">
          <p className="note-quality-warn">
            <Lock size={14} />
            Plugin Disabled
          </p>
          <p className="empty-state">
            The Zotero &amp; CSL Citations capability (<code>{CITATION_PLUGIN_ID}</code>) is disabled.
          </p>
          <p className="citation-disabled-prompt">
            Enable the plugin in Plugin Management Center to manage bibliographies, insert Pandoc/CSL citations, and sync with Zotero.
          </p>
          {onEnablePlugin ? (
            <button type="button" className="toolbar-button" onClick={onEnablePlugin}>
              Enable Citations Plugin
            </button>
          ) : null}
        </div>
      </WidgetCard>
    )
  }

  const bibSet = bibliographyKeys instanceof Set ? bibliographyKeys : new Set(bibliographyKeys)
  const missingCitations = citationKeys.filter((key) => !bibSet.has(key))
  const resolvedCount = citationKeys.length - missingCitations.length

  return (
    <WidgetCard title="Citations & Bibliography">
      <div className="citation-inspector-content">
        <div className="note-quality-status">
          {missingCitations.length === 0 && citationKeys.length > 0 ? (
            <p className="note-quality-good">
              <CheckCircle2 size={14} />
              All citations resolved
            </p>
          ) : missingCitations.length > 0 ? (
            <p className="note-quality-warn">
              <AlertTriangle size={14} />
              {missingCitations.length} unresolved citation{missingCitations.length === 1 ? '' : 's'}
            </p>
          ) : (
            <p className="health-subtitle">No citations in current document</p>
          )}
        </div>

        <ul className="note-quality-metrics">
          <li>
            <span>Total Citations</span>
            <strong>{citationKeys.length}</strong>
          </li>
          <li>
            <span>Resolved</span>
            <strong>{resolvedCount}</strong>
          </li>
          <li>
            <span>Missing</span>
            <strong>{missingCitations.length}</strong>
          </li>
        </ul>

        {missingCitations.length > 0 ? (
          <div className="missing-citations-list">
            <small>Missing keys:</small>
            <ul>
              {missingCitations.map((key) => (
                <li key={key}>
                  <code>@{key}</code>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="citation-inspector-actions">
          {onOpenBibliography ? (
            <button type="button" className="toolbar-button" onClick={onOpenBibliography}>
              <BookOpen size={14} />
              Bibliography ({bibliographyPath})
            </button>
          ) : null}
          {onInsertCitation ? (
            <button type="button" className="toolbar-button" onClick={() => onInsertCitation('')}>
              <Plus size={14} />
              Insert Citation
            </button>
          ) : null}
          {onSyncZotero ? (
            <button type="button" className="toolbar-button" onClick={onSyncZotero}>
              <RefreshCw size={14} />
              Sync Zotero
            </button>
          ) : null}
        </div>
      </div>
    </WidgetCard>
  )
}

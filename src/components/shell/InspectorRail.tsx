import type { RefObject } from 'react'
import { useMemo } from 'react'
import { Archive, FileText, Pencil, Tags } from 'lucide-react'

import { MarkdownPreview, type MarkdownPreviewHandle } from '@scriptor/renderer'
import type { LoadedPlugin } from '@scriptor/plugin-api'
import type { TemplatePackContribution } from '@scriptor/core/contracts/plugin'
import { WidgetCard } from '../chrome/WorkspaceChrome'
import { ReferencesPreviewPanel } from '../ReferencesPreviewPanel'
import { PluginPanel } from '../PluginPanel'
import { NoteQualityCard } from '../inspector/NoteQualityCard'
import { PreviewQABar } from '../inspector/PreviewQABar'
import { INSPECTOR_PRESETS, type InspectorPreset } from '../../lib/inspectorPresets'
import type { BibliographyEntry, BacklinkHit, ExportJobOutput, VaultHealthDiagnostics, VaultHealthReport } from '../../types/vault'

interface InspectorRailProps {
  railRef?: RefObject<HTMLElement | null>
  activeMode: 'inspector' | 'preview' | 'plugins'
  onModeChange: (mode: 'inspector' | 'preview' | 'plugins') => void
  splitPreview: boolean
  activePath: string | null
  previewRef: RefObject<MarkdownPreviewHandle | null>
  draftMarkdown: string
  previewProps: {
    fetchNote?: (target: string) => Promise<string | null>
    readVaultText?: (path: string) => Promise<string | null>
    executeDql?: (query: string) => Promise<unknown>
    runCodeChunk?: (language: string, code: string) => Promise<unknown>
    postProcessHtml?: (html: string) => string
    renderPlantUmlLocal?: (source: string) => Promise<string | null>
  }
  inspectorOutline: Array<{ line: number; label: string; level: number }>
  inspectorLinks: string[]
  backlinks: BacklinkHit[]
  jumpToOutlineHeading: (heading: { line: number; label: string; level: number }) => void
  openWikilinkTarget: (target: string) => void
  openNote: (path: string) => void
  onRenameSection: (label: string) => void
  onRenameBlock?: (blockId: string) => void
  citationRows: string[]
  bibliography: BibliographyEntry[]
  bibliographyKeys: Set<string>
  formatInline: (entry: BibliographyEntry) => string
  formatBibliography: (entry: BibliographyEntry) => string
  insertSnippet: (text: string) => void
  logActivity: (kind: 'success' | 'error', message: string, detail?: string) => void
  setStatusDockToJobs: () => void
  exportProfiles: Array<{ id: string; label: string }>
  exportWithProfile: (profileId: string, dryRun?: boolean) => Promise<void>
  isExporting: boolean
  cancelExport: () => Promise<void>
  exportResult: ExportJobOutput | null
  healthAction: string
  onOpenHealthDashboard: () => void
  healthMetrics: Array<[string, string]>
  health: VaultHealthReport | null
  isNoteDirty: boolean
  inspectorPreset: InspectorPreset
  onInspectorPresetChange: (preset: InspectorPreset) => void
  showInspectorHealth?: boolean
  onOpenKnowledgeWorkbench: () => void
  onOpenPublishCenter: () => void
  onOpenGraph: () => void
  plugins: {
    plugins: LoadedPlugin[]
    templatePacks: TemplatePackContribution[]
    safeMode: boolean
    healthDiagnostics: VaultHealthDiagnostics | null
    marketplaceCatalog: Array<{ id: string; name: string; version: string; description: string }>
    onToggleSafeMode: (enabled: boolean) => void
    onTogglePlugin: (pluginId: string, enabled: boolean) => void
    onInstallMarketplace: (pluginId: string) => void
  }
}

export function InspectorRail({
  railRef,
  activeMode,
  onModeChange,
  splitPreview,
  activePath,
  previewRef,
  draftMarkdown,
  previewProps,
  inspectorOutline,
  inspectorLinks,
  backlinks,
  jumpToOutlineHeading,
  openWikilinkTarget,
  openNote,
  onRenameSection,
  onRenameBlock,
  citationRows,
  bibliography,
  bibliographyKeys,
  formatInline,
  formatBibliography,
  insertSnippet,
  logActivity,
  setStatusDockToJobs,
  exportProfiles,
  exportWithProfile,
  isExporting,
  cancelExport,
  exportResult,
  healthAction,
  onOpenHealthDashboard,
  healthMetrics,
  health,
  isNoteDirty,
  inspectorPreset,
  onInspectorPresetChange,
  showInspectorHealth = true,
  onOpenKnowledgeWorkbench,
  onOpenPublishCenter,
  onOpenGraph,
  plugins,
}: InspectorRailProps) {
  const presetConfig = useMemo(
    () => INSPECTOR_PRESETS.find((entry) => entry.id === inspectorPreset) ?? INSPECTOR_PRESETS[0],
    [inspectorPreset],
  )
  const missingCitations = citationRows.filter((key) => !bibliographyKeys.has(key)).length

  return (
    <aside className="inspector-panel" aria-label="Inspector" ref={railRef}>
      <div className="inspector-tabs" role="tablist" aria-label="Inspector mode">
        {(['inspector', 'preview', 'plugins'] as const).map((mode) => (
          <button
            type="button"
            className={activeMode === mode ? 'active' : ''}
            onClick={() => onModeChange(mode)}
            role="tab"
            aria-selected={activeMode === mode}
            key={mode}
          >
            {mode[0].toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      <div className="inspector-preset-row" aria-label="Inspector layout preset">
        {INSPECTOR_PRESETS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={inspectorPreset === entry.id ? 'active' : undefined}
            title={entry.description}
            onClick={() => onInspectorPresetChange(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {showInspectorHealth ? (
      <WidgetCard title="Note Health" action={healthAction} onAction={onOpenHealthDashboard}>
        <div className="metric-grid">
          {healthMetrics.map(([label, value]) => (
            <div className="metric" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </WidgetCard>
      ) : null}

      {presetConfig.showQuality ? (
        <NoteQualityCard
          activePath={activePath}
          health={health}
          outboundLinks={inspectorLinks.length}
          backlinkCount={backlinks.length}
          citationKeys={citationRows}
          bibliographyKeys={bibliographyKeys}
          isNoteDirty={isNoteDirty}
          onOpenWorkbench={onOpenKnowledgeWorkbench}
          onOpenPublish={onOpenPublishCenter}
          onOpenGraph={onOpenGraph}
        />
      ) : null}

      {activeMode === 'preview' ? (
        <>
          <PreviewQABar
            activePath={activePath}
            isNoteDirty={isNoteDirty}
            missingCitations={missingCitations}
            onOpenPublish={onOpenPublishCenter}
          />
          {splitPreview ? (
            <p className="preview-sync-hint" role="status">
              Split preview is open beside the editor with scroll sync.
            </p>
          ) : (
            <>
              <p className="preview-sync-hint" role="status">
                Scroll sync is active between editor and preview.
              </p>
              <WidgetCard title="Preview">
                {activePath ? (
                  <MarkdownPreview
                    ref={previewRef}
                    markdown={draftMarkdown}
                    className="markdown-preview"
                    basePath={activePath}
                    fetchNote={previewProps.fetchNote}
                    readVaultText={previewProps.readVaultText}
                    executeDql={previewProps.executeDql as any}
                    runCodeChunk={previewProps.runCodeChunk as any}
                    postProcessHtml={previewProps.postProcessHtml}
                    renderPlantUmlLocal={previewProps.renderPlantUmlLocal}
                  />
                ) : (
                  <p className="empty-state">Open a note to preview Markdown.</p>
                )}
              </WidgetCard>
            </>
          )}
          {presetConfig.showCitations ? (
            <ReferencesPreviewPanel
              citationKeys={citationRows}
              bibliography={bibliography}
              onInsertBlock={(block) => insertSnippet(block)}
            />
          ) : null}
        </>
      ) : activeMode !== 'plugins' ? (
        <>
          {presetConfig.showOutline ? (
          <WidgetCard title="Outline">
            <div className="compact-list">
              {inspectorOutline.length === 0 ? (
                <p className="empty-state">No headings yet.</p>
              ) : (
                inspectorOutline.map((heading) => (
                  <div className="outline-row" key={`${heading.line}:${heading.label}`}>
                    <button type="button" onClick={() => jumpToOutlineHeading(heading)}>
                      <FileText />
                      <span>{heading.label}</span>
                      <small>H{heading.level}</small>
                    </button>
                    {activePath ? (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Rename section ${heading.label}`}
                        onClick={() => onRenameSection(heading.label)}
                      >
                        <Pencil size={14} />
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </WidgetCard>
          ) : null}

          {presetConfig.showLinks ? (
          <WidgetCard title="Outgoing Links">
            <div className="compact-list">
              {inspectorLinks.length === 0 ? (
                <p className="empty-state">No wikilinks in this note.</p>
              ) : (
                inspectorLinks.map((row) => {
                  const blockMatch = row.match(/#\^([^\]]+)$/)
                  return (
                  <div className="outline-row" key={row}>
                    <button type="button" onClick={() => openWikilinkTarget(row)}>
                      <FileText />
                      <span>{row}</span>
                    </button>
                    {blockMatch && activePath && onRenameBlock ? (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Rename block ${blockMatch[1]}`}
                        onClick={() => onRenameBlock(blockMatch[1])}
                      >
                        <Pencil size={14} />
                      </button>
                    ) : null}
                  </div>
                  )
                })
              )}
            </div>
          </WidgetCard>
          ) : null}

          {presetConfig.showBacklinks ? (
          <WidgetCard title="Backlinks">
            <div className="compact-list">
              {backlinks.length === 0 ? (
                <p className="empty-state">No backlinks yet.</p>
              ) : (
                backlinks.map((hit) => (
                  <button type="button" key={`${hit.from_path}:${hit.line}`} onClick={() => openNote(hit.from_path)}>
                    <FileText />
                    <span>{hit.from_title}</span>
                    <small>L{hit.line}</small>
                  </button>
                ))
              )}
            </div>
          </WidgetCard>
          ) : null}

          {presetConfig.showCitations ? (
          <WidgetCard title="Citations">
            <div className="compact-list">
              {citationRows.length === 0 ? (
                <p className="empty-state">No citations in this note.</p>
              ) : (
                citationRows.map((key) => {
                  const resolved = bibliographyKeys.has(key)
                  const entry = bibliography.find((row) => row.key === key)
                  return (
                    <button
                      type="button"
                      key={key}
                      className={resolved ? 'resolved' : 'unresolved'}
                      onClick={() => {
                        insertSnippet(`[@${key}] `)
                        logActivity(
                          resolved ? 'success' : 'error',
                          resolved ? 'Citation resolved' : 'Unresolved citation',
                          entry?.title ?? key,
                        )
                      }}
                    >
                      <Tags />
                      <span>{key}</span>
                      <small>
                        {resolved
                          ? entry
                            ? `${formatInline(entry)} · ${formatBibliography(entry)}`
                            : 'in bibliography'
                          : 'missing'}
                      </small>
                    </button>
                  )
                })
              )}
            </div>
          </WidgetCard>
          ) : null}

          {presetConfig.showExportQuick ? (
          <WidgetCard title="Publishing">
            <p className="health-subtitle">Use the publish center for profiles, dry runs, and export history.</p>
            <button type="button" className="primary-button" onClick={onOpenPublishCenter}>
              Open publish center
            </button>
          </WidgetCard>
          ) : (
          <WidgetCard title="Export Profiles">
            <div className="export-grid">
              {exportProfiles.map((profile) => (
                <button
                  type="button"
                  key={profile.id}
                  disabled={!activePath || isExporting}
                  onClick={() => {
                    setStatusDockToJobs()
                    void exportWithProfile(profile.id)
                  }}
                >
                  <Archive />
                  {profile.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="primary-button"
              disabled={!activePath || isExporting}
              onClick={() => {
                setStatusDockToJobs()
                void exportWithProfile('html-standalone', true)
              }}
            >
              {isExporting ? 'Exporting...' : 'Preview export command'}
            </button>
            {isExporting ? (
              <button type="button" className="toolbar-button" onClick={() => void cancelExport()}>
                Cancel export
              </button>
            ) : null}
            {exportResult ? (
              <p className="export-result" role="status">
                {exportResult.dry_run
                  ? `Dry run: ${exportResult.command.join(' ')}`
                  : `Exported to ${exportResult.artifact_path}`}
              </p>
            ) : null}
          </WidgetCard>
          )}
        </>
      ) : (
        <PluginPanel
          plugins={plugins.plugins}
          templatePacks={plugins.templatePacks}
          safeMode={plugins.safeMode}
          healthDiagnostics={plugins.healthDiagnostics}
          marketplaceCatalog={plugins.marketplaceCatalog}
          onToggleSafeMode={plugins.onToggleSafeMode}
          onTogglePlugin={plugins.onTogglePlugin}
          onInstallMarketplace={plugins.onInstallMarketplace}
        />
      )}
    </aside>
  )
}

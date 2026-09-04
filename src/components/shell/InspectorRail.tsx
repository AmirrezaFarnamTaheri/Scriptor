import type { RefObject } from 'react'
import { lazy, Suspense, useMemo } from 'react'
import { Archive, BookOpen, FileText, Hash, Link2, Pencil, Quote, Tags } from 'lucide-react'

import { MarkdownPreview, type MarkdownPreviewHandle, type DqlResultRow, type CodeChunkRunResult } from '@scriptor/renderer'
import type { LoadedPlugin, PluginRuntimePolicy } from '@scriptor/plugin-api'
import type { TemplatePackContribution } from '@scriptor/core/contracts/plugin'
import type { McpMode, McpToolDescriptor } from '@scriptor/core/contracts/mcp'
import type { LayoutPreset } from '../../lib/workspace/layoutPresets'
import { WidgetCard } from '../chrome/WorkspaceChrome'
import { EmptyState } from '../EmptyState'
import { ReferencesPreviewPanel } from '../ReferencesPreviewPanel'
import type { FeatureFlagEntry, McpAuditEntry } from '../StorePanel'
import { ErrorBoundary } from '../ErrorBoundary'
import { PanelErrorFallback } from '../PanelErrorFallback'
import { NoteQualityCard } from '../inspector/NoteQualityCard'
import { PreviewQABar } from '../inspector/PreviewQABar'
import { INSPECTOR_PRESETS, type InspectorPreset } from '../../lib/inspectorPresets'
import type { BibliographyEntry, BacklinkHit, ExportJobOutput, VaultHealthDiagnostics, VaultHealthReport } from '../../types/vault'
import { useTablistKeys } from '../../hooks/useTablistKeys'
import { useI18n } from '../../lib/i18n'

const StorePanel = lazy(() =>
  import('../StorePanel').then((module) => ({ default: module.StorePanel })),
)

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
    executeDql?: (query: string) => Promise<DqlResultRow[]>
    runCodeChunk?: (language: string, code: string) => Promise<CodeChunkRunResult>
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
  /**
   * Optional store surfaces beyond plugins. When omitted, StorePanel still
   * renders its MCP / Features / Layouts tabs in an empty, read-only state.
   */
  store?: {
    mcpMode?: McpMode
    mcpTools?: McpToolDescriptor[]
    mcpAuditLog?: McpAuditEntry[]
    onSetMcpMode?: (mode: McpMode) => void
    featureFlags?: FeatureFlagEntry[]
    onToggleFeature?: (key: string, enabled: boolean) => void
    activeLayoutPresetId?: string | null
    onApplyLayoutPreset?: (preset: LayoutPreset) => void
  }
  plugins: {
    plugins: LoadedPlugin[]
    templatePacks: TemplatePackContribution[]
    safeMode: boolean
    healthDiagnostics: VaultHealthDiagnostics | null
    marketplaceCatalog: Array<{ id: string; name: string; version: string; description: string }>
    activeVaultId: string | null
    pluginPolicies: Record<string, PluginRuntimePolicy | null>
    onToggleSafeMode: (enabled: boolean) => void
    onTogglePlugin: (pluginId: string, enabled: boolean) => void
    onReviewConsent: (pluginId: string, permissions: PluginRuntimePolicy['grantedPermissions'], vaultIds: string[]) => void
    onRevokeConsent: (pluginId: string) => void
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
  store,
}: InspectorRailProps) {
  const { t } = useI18n()
  const presetConfig = useMemo(
    () => INSPECTOR_PRESETS.find((entry) => entry.id === inspectorPreset) ?? INSPECTOR_PRESETS[0],
    [inspectorPreset],
  )
  const missingCitations = citationRows.filter((key) => !bibliographyKeys.has(key)).length
  const INSPECTOR_TABS: readonly string[] = ['inspector', 'preview', 'plugins']
  const handleInspectorTabKeys = useTablistKeys(INSPECTOR_TABS, activeMode, (id) => onModeChange(id as 'inspector' | 'preview' | 'plugins'))

  return (
    <aside className="inspector-panel" aria-label={t('inspector.ariaLabel')} ref={railRef}>
      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="inspector-tabs" role="tablist" aria-label={t('inspector.modeAria')} onKeyDown={handleInspectorTabKeys}>
        {(['inspector', 'preview', 'plugins'] as const).map((mode) => (
          <button
            type="button"
            key={mode}
            id={`inspector-tab-${mode}`}
            role="tab"
            tabIndex={activeMode === mode ? 0 : -1}
            aria-selected={activeMode === mode}
            aria-controls={`inspector-panel-${mode}`}
            className={activeMode === mode ? 'active' : ''}
            onClick={() => onModeChange(mode)}
          >
            {t(`inspector.tabs.${mode}`)}
          </button>
        ))}
      </div>

      {/* ── Preset row ──────────────────────────────────────────────────────── */}
      <div className="inspector-preset-row" aria-label={t('inspector.presetAria')}>
        {INSPECTOR_PRESETS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={inspectorPreset === entry.id ? 'active' : undefined}
            title={t(`inspector.preset.${entry.id}.description`)}
            aria-pressed={inspectorPreset === entry.id}
            onClick={() => onInspectorPresetChange(entry.id)}
          >
            {t(`inspector.preset.${entry.id}.label`)}
          </button>
        ))}
      </div>

      {/* ── Shared health card (visible in all modes) ───────────────────────── */}
      {showInspectorHealth ? (
        <WidgetCard title={t('inspector.noteHealth')} action={healthAction} onAction={onOpenHealthDashboard}>
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

      {/* ── Panel regions — each gets role="tabpanel" ────────────────────────── */}

      {/* PREVIEW panel */}
      <div
        id="inspector-panel-preview"
        role="tabpanel"
        aria-labelledby="inspector-tab-preview"
        hidden={activeMode !== 'preview'}
      >
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
                {t('inspector.previewSyncSplit')}
              </p>
            ) : (
              <>
                <p className="preview-sync-hint" role="status">
                  {t('inspector.previewSyncActive')}
                </p>
                <WidgetCard title={t('inspector.previewCard')}>
                  {activePath ? (
                    <ErrorBoundary
                      name="inspector-markdown-preview"
                      resetKeys={[activePath]}
                      fallback={
                        <PanelErrorFallback
                          variant="inline"
                          title={t('inspector.previewError.title')}
                          detail={t('inspector.previewError.detail')}
                        />
                      }
                    >
                      <MarkdownPreview
                        ref={previewRef}
                        markdown={draftMarkdown}
                        className="markdown-preview"
                        basePath={activePath}
                        fetchNote={previewProps.fetchNote}
                        readVaultText={previewProps.readVaultText}
                        executeDql={previewProps.executeDql}
                        runCodeChunk={previewProps.runCodeChunk}
                        postProcessHtml={previewProps.postProcessHtml}
                        renderPlantUmlLocal={previewProps.renderPlantUmlLocal}
                      />
                    </ErrorBoundary>
                  ) : (
                    <EmptyState
                      icon={<FileText />}
                      title={t('inspector.noNoteOpen')}
                      description={t('inspector.noNoteOpenHint')}
                    />
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
        ) : null}
      </div>

      {/* INSPECTOR panel */}
      <div
        id="inspector-panel-inspector"
        role="tabpanel"
        aria-labelledby="inspector-tab-inspector"
        hidden={activeMode !== 'inspector'}
      >
        {activeMode === 'inspector' ? (
          <>
            {presetConfig.showOutline ? (
              <WidgetCard title={t('inspector.outline')}>
                <div className="compact-list">
                  {inspectorOutline.length === 0 ? (
                    <EmptyState icon={<Hash />} title={t('inspector.noHeadings')} description={t('inspector.noHeadingsHint')} />
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
                            aria-label={t('inspector.renameSection', { label: heading.label })}
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
              <WidgetCard title={t('inspector.outgoingLinks')}>
                <div className="compact-list">
                  {inspectorLinks.length === 0 ? (
                    <EmptyState icon={<Link2 />} title={t('inspector.noWikilinks')} description={t('inspector.noWikilinksHint')} />
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
                              aria-label={t('inspector.renameBlock', { label: blockMatch[1] })}
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
              <WidgetCard title={t('inspector.backlinks')}>
                <div className="compact-list">
                  {backlinks.length === 0 ? (
                    <EmptyState icon={<BookOpen />} title={t('inspector.noBacklinks')} description={t('inspector.noBacklinksHint')} />
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
              <WidgetCard title={t('inspector.citations')}>
                <div className="compact-list">
                  {citationRows.length === 0 ? (
                    <EmptyState icon={<Quote />} title={t('inspector.noCitations')} description={t('inspector.noCitationsHint')} />
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
                              resolved ? t('inspector.citationResolved') : t('inspector.citationUnresolved'),
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
                                : t('inspector.inBibliography')
                              : t('inspector.missing')}
                          </small>
                        </button>
                      )
                    })
                  )}
                </div>
              </WidgetCard>
            ) : null}

            {presetConfig.showExportQuick ? (
              <WidgetCard title={t('inspector.publishing')}>
                <p className="health-subtitle">{t('inspector.publishingHint')}</p>
                <button type="button" className="primary-button" onClick={onOpenPublishCenter}>
                  {t('inspector.openPublishCenter')}
                </button>
              </WidgetCard>
            ) : (
              <WidgetCard title={t('inspector.exportProfiles')}>
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
                  {isExporting ? t('inspector.exporting') : t('inspector.previewExportCommand')}
                </button>
                {isExporting ? (
                  <button type="button" className="toolbar-button" onClick={() => void cancelExport()}>
                    {t('inspector.cancelExport')}
                  </button>
                ) : null}
                {exportResult ? (
                  <p className="export-result" role="status">
                    {exportResult.dry_run
                      ? t('inspector.dryRun', { command: exportResult.command.join(' ') })
                      : t('inspector.exportedTo', { path: exportResult.artifact_path })}
                  </p>
                ) : null}
              </WidgetCard>
            )}
          </>
        ) : null}
      </div>

      {/* PLUGINS panel */}
      <div
        id="inspector-panel-plugins"
        role="tabpanel"
        aria-labelledby="inspector-tab-plugins"
        hidden={activeMode !== 'plugins'}
      >
        {activeMode === 'plugins' ? (
          <ErrorBoundary
            name="plugin-panel"
            fallback={
              <PanelErrorFallback
                variant="inline"
                title={t('inspector.pluginsError.title')}
                detail={t('inspector.pluginsError.detail')}
              />
            }
          >
            <Suspense fallback={<div className="panel-loading" role="status">{t('inspector.loadingStore')}</div>}>
              <StorePanel
              plugins={plugins.plugins}
              templatePacks={plugins.templatePacks}
              safeMode={plugins.safeMode}
              healthDiagnostics={plugins.healthDiagnostics}
              marketplaceCatalog={plugins.marketplaceCatalog}
              activeVaultId={plugins.activeVaultId}
              pluginPolicies={plugins.pluginPolicies}
              onToggleSafeMode={plugins.onToggleSafeMode}
              onTogglePlugin={plugins.onTogglePlugin}
              onReviewConsent={plugins.onReviewConsent}
              onRevokeConsent={plugins.onRevokeConsent}
              onInstallMarketplace={plugins.onInstallMarketplace}
              mcpMode={store?.mcpMode}
              mcpTools={store?.mcpTools}
              mcpAuditLog={store?.mcpAuditLog}
              onSetMcpMode={store?.onSetMcpMode}
              featureFlags={store?.featureFlags}
              onToggleFeature={store?.onToggleFeature}
              activeLayoutPresetId={store?.activeLayoutPresetId}
              onApplyLayoutPreset={store?.onApplyLayoutPreset}
              />
            </Suspense>
          </ErrorBoundary>
        ) : null}
      </div>
    </aside>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Settings } from 'lucide-react'

import { exportDiscover, vaultLoadConfig, vaultSaveConfig } from '../bridge/commands'
import { planDailyNotePreview } from '../lib/knowledge/templates'
import type { AiProviderId } from '../hooks/useAiProvider'
import type { JourneySnapshot } from '../hooks/useJourneyMetrics'
import type { PanelPresentation } from '../hooks/usePanelPresentation'
import type { WorkspaceChromePrefs } from '../hooks/useWorkspaceChrome'
import {
  DEFAULT_WORKSPACE_LAYOUTS,
  type WorkspaceLayout,
} from '../hooks/useWorkspaceLayout'
import type { WorkspaceMode } from '../hooks/useWorkspaceMode'
import { EDITOR_FONT_FAMILIES } from '../brand/support'
import type { PandocDiscovery, VaultConfig } from '../types/vault'
import { AiProviderSettings } from './AiProviderSettings'
import { DaemonOpsPanel } from './DaemonOpsPanel'
import { ReleaseQualityPanel } from './ReleaseQualityPanel'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'

export interface SystemInfoSnapshot {
  os: string
  arch: string
  family: string
  locale?: string
}

interface SettingsPanelProps {
  vaultOpen: boolean
  systemInfo: SystemInfoSnapshot | null
  diagnosticsOptIn: boolean
  onDiagnosticsOptInChange: (enabled: boolean) => void
  aiProvider: AiProviderId
  aiEndpoint: string
  aiHasApiKey: boolean
  aiBusy: boolean
  aiLastError: string | null
  onAiProviderChange: (provider: AiProviderId) => void
  onAiEndpointChange: (endpoint: string) => void
  onAiSaveApiKey: (secret: string) => void
  onAiClearApiKey: () => void
  nativeReady: boolean
  headlessEngine: boolean
  onHeadlessEngineChange: (enabled: boolean) => void
  daemonVersion: string | null
  daemonError: string | null
  onRefreshDaemon: () => void
  onStartDaemon: () => void
  activePath?: string | null
  onClose: () => void
  onConfigSaved?: () => void
  workspaceMode?: WorkspaceMode
  workspaceLayouts?: Record<WorkspaceMode, WorkspaceLayout>
  onSaveWorkspaceLayout?: (mode: WorkspaceMode, layout: WorkspaceLayout) => void
  onResetWorkspaceLayout?: (mode: WorkspaceMode) => void
  panelPresentation?: PanelPresentation
  onPanelPresentationChange?: (presentation: PanelPresentation) => void
  journey?: JourneySnapshot
  timeToFirstEditMs?: number | null
  timeToFirstExportMs?: number | null
  onResetJourney?: () => void
  workspaceChrome?: WorkspaceChromePrefs
  onPatchWorkspaceChrome?: (patch: Partial<WorkspaceChromePrefs>) => void
  onResetWorkspaceChrome?: () => void
  onOpenSupport?: () => void
}

const DEFAULT_CONFIG: VaultConfig = {
  daily_note: {
    directory: 'daily',
    filename_format: '{iso}',
    title_format: '{iso}',
    template_path: null,
  },
  templates_directory: '.scriptor/templates',
  inbox: { enabled: true, period: 'all', new_note_directory: null },
  workflow: { auto_advance_inbox_after_organize: false },
  note_types: { directory: 'type' },
  export: {
    bibliography_path: 'references.bib',
    csl_style_path: 'apa-lite.csl',
    export_on_save: { enabled: false, profile_id: null },
  },
  writing_targets: { daily_words: 500, history_path: '.scriptor/stats-history.json' },
  graph_groups: [],
  extra_roots: [],
}

export function SettingsPanel({
  vaultOpen,
  systemInfo,
  diagnosticsOptIn,
  onDiagnosticsOptInChange,
  aiProvider,
  aiEndpoint,
  aiHasApiKey,
  aiBusy,
  aiLastError,
  onAiProviderChange,
  onAiEndpointChange,
  onAiSaveApiKey,
  onAiClearApiKey,
  nativeReady,
  headlessEngine,
  onHeadlessEngineChange,
  daemonVersion,
  daemonError,
  onRefreshDaemon,
  onStartDaemon,
  activePath = null,
  onClose,
  onConfigSaved,
  workspaceMode = 'writing',
  workspaceLayouts,
  onSaveWorkspaceLayout,
  onResetWorkspaceLayout,
  panelPresentation = 'modal',
  onPanelPresentationChange,
  journey,
  timeToFirstEditMs = null,
  timeToFirstExportMs = null,
  onResetJourney,
  workspaceChrome,
  onPatchWorkspaceChrome,
  onResetWorkspaceChrome,
  onOpenSupport,
}: SettingsPanelProps) {
  const [config, setConfig] = useState<VaultConfig>(DEFAULT_CONFIG)
  const [status, setStatus] = useState('')
  const [pandoc, setPandoc] = useState<PandocDiscovery | null>(null)
  const [pandocError, setPandocError] = useState<string | null>(null)

  const refreshPandoc = useCallback(async () => {
    if (!nativeReady) return
    setPandocError(null)
    try {
      setPandoc(await exportDiscover())
    } catch (error) {
      setPandoc(null)
      setPandocError(error instanceof Error ? error.message : 'Pandoc not found')
    }
  }, [nativeReady])

  const dailyNotePreview = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return planDailyNotePreview(config.daily_note, today)
  }, [config.daily_note])

  useEffect(() => {
    if (!vaultOpen || !nativeReady) return
    void vaultLoadConfig()
      .then((loaded) =>
        setConfig({
          ...DEFAULT_CONFIG,
          ...loaded,
          daily_note: { ...DEFAULT_CONFIG.daily_note, ...loaded.daily_note },
          export: { ...DEFAULT_CONFIG.export, ...loaded.export },
          writing_targets: {
            daily_words: loaded.writing_targets?.daily_words ?? DEFAULT_CONFIG.writing_targets!.daily_words,
            history_path: loaded.writing_targets?.history_path ?? DEFAULT_CONFIG.writing_targets!.history_path,
          },
          graph_groups: loaded.graph_groups ?? DEFAULT_CONFIG.graph_groups,
          extra_roots: loaded.extra_roots ?? DEFAULT_CONFIG.extra_roots,
        }),
      )
      .catch(() => setConfig(DEFAULT_CONFIG))
  }, [nativeReady, vaultOpen])

  useEffect(() => {
    if (nativeReady) void refreshPandoc()
  }, [nativeReady, refreshPandoc])

  const saveConfig = async () => {
    if (!nativeReady) return
    setStatus('Saving…')
    try {
      await vaultSaveConfig(config)
      setStatus('Vault config saved to `.scriptor/config.json`.')
      onConfigSaved?.()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save config')
    }
  }

  return (
    <UnifiedPanelShell
      title="Settings"
      subtitle="Desktop runtime, vault workflow, and diagnostics."
      icon={<Settings size={18} />}
      ariaLabel="Settings"
      onClose={onClose}
      className="settings-panel knowledge-filters-panel"
      wide
    >
        <div className="settings-section">
          <h3>Runtime</h3>
          <p className={nativeReady ? 'settings-status ok' : 'settings-status warn'}>
            {nativeReady ? 'Native Tauri bridge connected' : 'Browser preview — run `pnpm desktop:dev` for vault commands'}
          </p>
          {nativeReady ? (
            <>
              <dl className="settings-grid">
                <div>
                  <dt>Pandoc</dt>
                  <dd>{pandoc ? pandoc.version : pandocError ? 'Not found' : 'Checking…'}</dd>
                </div>
                <div>
                  <dt>Path</dt>
                  <dd className="settings-path">{pandoc?.path ?? '—'}</dd>
                </div>
              </dl>
              {pandocError ? (
                <p className="settings-status warn">
                  {pandocError}. Install Pandoc or set `SCRIPTOR_PANDOC_PATH`. Windows:{' '}
                  <code>winget install JohnMacFarlane.Pandoc</code> · macOS:{' '}
                  <code>brew install pandoc</code>
                </p>
              ) : pandoc ? null : (
                <p className="health-subtitle">Press refresh to detect Pandoc on this machine.</p>
              )}
              <button type="button" className="toolbar-button" onClick={() => void refreshPandoc()}>
                Refresh Pandoc discovery
              </button>
              <h4 className="settings-subheading">Headless engine</h4>
              <label className="diagnostics-opt-in">
                <input
                  type="checkbox"
                  checked={headlessEngine}
                  onChange={(event) => onHeadlessEngineChange(event.target.checked)}
                />
                <span>Route vault indexing through the headless engine (daemon IPC)</span>
              </label>
              <p className="health-subtitle">
                When enabled, search, rebuild, backlinks, graph, health, git status, note save, rename, and export route through the daemon. Note read stays in-process.
              </p>
              {headlessEngine ? (
                <>
                  <p className={daemonVersion ? 'settings-status ok' : 'settings-status warn'} role="status">
                    {daemonVersion
                      ? `Daemon connected — version ${daemonVersion}`
                      : daemonError
                        ? `Daemon offline — ${daemonError}`
                        : 'Daemon status unknown — refresh or start the service'}
                  </p>
                  <div className="settings-actions">
                    <button type="button" className="toolbar-button" onClick={onRefreshDaemon}>
                      Refresh daemon status
                    </button>
                    <button type="button" className="toolbar-button" onClick={onStartDaemon}>
                      Start daemon
                    </button>
                  </div>
                  <DaemonOpsPanel
                    activePath={activePath}
                    daemonVersion={daemonVersion}
                    daemonError={daemonError}
                    onRefresh={onRefreshDaemon}
                    onStart={onStartDaemon}
                  />
                </>
              ) : null}
            </>
          ) : null}
        </div>

        {vaultOpen && nativeReady && (
          <div className="settings-section">
            <h3>Vault config</h3>
            <p className="health-subtitle">Stored in `.scriptor/config.json` (Foam-compatible daily note paths).</p>
            <label className="settings-field">
              Daily note directory
              <input
                value={config.daily_note.directory}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    daily_note: { ...current.daily_note, directory: event.target.value },
                  }))
                }
              />
            </label>
            <label className="settings-field">
              Filename format
              <input
                value={config.daily_note.filename_format}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    daily_note: { ...current.daily_note, filename_format: event.target.value },
                  }))
                }
              />
            </label>
            <label className="settings-field">
              Title format
              <input
                value={config.daily_note.title_format}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    daily_note: { ...current.daily_note, title_format: event.target.value },
                  }))
                }
              />
            </label>
            <p className="settings-preview" role="status">
              Today&apos;s daily note: <code>{dailyNotePreview.path}</code> — title <code>{dailyNotePreview.title}</code>
            </p>
            <label className="settings-field">
              Daily template path (optional)
              <input
                value={config.daily_note.template_path ?? ''}
                placeholder=".scriptor/templates/daily.md"
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    daily_note: {
                      ...current.daily_note,
                      template_path: event.target.value.trim() || null,
                    },
                  }))
                }
              />
            </label>
            <label className="settings-field">
              Templates directory
              <input
                value={config.templates_directory}
                onChange={(event) =>
                  setConfig((current) => ({ ...current, templates_directory: event.target.value }))
                }
              />
            </label>
            <h4 className="settings-subheading">Inbox workflow</h4>
            <label className="settings-checkbox">
              <input
                type="checkbox"
                checked={config.inbox?.enabled !== false}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    inbox: { ...DEFAULT_CONFIG.inbox!, ...current.inbox, enabled: event.target.checked },
                  }))
                }
              />
              Enable inbox triage (`_organized` frontmatter)
            </label>
            <label className="settings-field">
              Inbox period
              <select
                value={config.inbox?.period ?? 'all'}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    inbox: {
                      ...DEFAULT_CONFIG.inbox!,
                      ...current.inbox,
                      period: event.target.value as 'week' | 'month' | 'quarter' | 'all',
                    },
                  }))
                }
              >
                <option value="all">All time</option>
                <option value="week">Past week</option>
                <option value="month">Past month</option>
                <option value="quarter">Past quarter</option>
              </select>
            </label>
            <label className="settings-field">
              New note directory (optional)
              <input
                value={config.inbox?.new_note_directory ?? ''}
                placeholder="inbox"
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    inbox: {
                      ...DEFAULT_CONFIG.inbox!,
                      ...current.inbox,
                      new_note_directory: event.target.value.trim() || null,
                    },
                  }))
                }
              />
            </label>
            <label className="settings-checkbox">
              <input
                type="checkbox"
                checked={config.workflow?.auto_advance_inbox_after_organize === true}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    workflow: {
                      ...DEFAULT_CONFIG.workflow!,
                      ...current.workflow,
                      auto_advance_inbox_after_organize: event.target.checked,
                    },
                  }))
                }
              />
              Auto-advance to next inbox note after organize
            </label>
            <label className="settings-field">
              Note types directory
              <input
                value={config.note_types?.directory ?? 'type'}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    note_types: { directory: event.target.value },
                  }))
                }
              />
            </label>
            <h4 className="settings-subheading">Export defaults</h4>
            <p className="health-subtitle">Bibliography and CSL paths used by HTML, PDF, and DOCX profiles.</p>
            <label className="settings-field">
              Bibliography path
              <input
                value={config.export.bibliography_path}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    export: { ...current.export, bibliography_path: event.target.value },
                  }))
                }
              />
            </label>
            <label className="settings-field">
              CSL style path
              <input
                value={config.export.csl_style_path}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    export: { ...current.export, csl_style_path: event.target.value },
                  }))
                }
              />
            </label>
            <label className="diagnostics-opt-in">
              <input
                type="checkbox"
                checked={config.export.export_on_save?.enabled ?? false}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    export: {
                      ...current.export,
                      export_on_save: {
                        enabled: event.target.checked,
                        profile_id: current.export.export_on_save?.profile_id ?? 'html',
                      },
                    },
                  }))
                }
              />
              <span>Export on save (uses profile below)</span>
            </label>
            <label className="settings-field">
              Export-on-save profile id
              <input
                value={config.export.export_on_save?.profile_id ?? ''}
                placeholder="html"
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    export: {
                      ...current.export,
                      export_on_save: {
                        enabled: current.export.export_on_save?.enabled ?? false,
                        profile_id: event.target.value.trim() || null,
                      },
                    },
                  }))
                }
              />
            </label>
            <h4 className="settings-subheading">Writing targets</h4>
            <label className="settings-field">
              Daily word target
              <input
                type="number"
                min={0}
                step={50}
                value={config.writing_targets?.daily_words ?? 500}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    writing_targets: {
                      ...current.writing_targets,
                      daily_words: Number(event.target.value),
                      history_path: current.writing_targets?.history_path ?? '.scriptor/stats-history.json',
                    },
                  }))
                }
              />
            </label>
            <label className="settings-field">
              Stats history path
              <input
                value={config.writing_targets?.history_path ?? '.scriptor/stats-history.json'}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    writing_targets: {
                      daily_words: current.writing_targets?.daily_words ?? 500,
                      history_path: event.target.value.trim() || null,
                    },
                  }))
                }
              />
            </label>
            <h4 className="settings-subheading">Graph groups</h4>
            <p className="health-subtitle">Tag prefix → node color (one rule per line: prefix,color).</p>
            <textarea
              className="settings-textarea"
              rows={4}
              value={(config.graph_groups ?? []).map((group) => `${group.tag_prefix},${group.color}`).join('\n')}
              onChange={(event) => {
                const graph_groups = event.target.value
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line) => {
                    const [tag_prefix, color] = line.split(',').map((part) => part.trim())
                    return { tag_prefix: tag_prefix ?? '', color: color ?? '#888888' }
                  })
                  .filter((group) => group.tag_prefix.length > 0)
                setConfig((current) => ({ ...current, graph_groups }))
              }}
            />
            <h4 className="settings-subheading">Canvas collaboration</h4>
            <label className="diagnostics-opt-in">
              <input
                type="checkbox"
                checked={config.canvas?.crdt_enabled ?? false}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    canvas: { crdt_enabled: event.target.checked },
                  }))
                }
              />
              <span>Enable CRDT canvas sync (localStorage op log with cross-tab merge)</span>
            </label>
            <h4 className="settings-subheading">Extra scan roots</h4>
            <p className="health-subtitle">Additional folders under the vault root to include in scans (one per line).</p>
            <textarea
              className="settings-textarea"
              rows={3}
              value={(config.extra_roots ?? []).join('\n')}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  extra_roots: event.target.value
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean),
                }))
              }
            />
            <button type="button" className="primary-button" onClick={() => void saveConfig()}>
              Save vault config
            </button>
            {status && <p className="settings-status">{status}</p>}
          </div>
        )}

        <AiProviderSettings
          provider={aiProvider}
          endpoint={aiEndpoint}
          hasApiKey={aiHasApiKey}
          busy={aiBusy}
          lastError={aiLastError}
          onProviderChange={onAiProviderChange}
          onEndpointChange={onAiEndpointChange}
          onSaveApiKey={onAiSaveApiKey}
          onClearApiKey={onAiClearApiKey}
        />

        <div className="settings-section">
          <h3>Workspace chrome</h3>
          <label className="settings-field">
            Panel presentation
            <select
              value={panelPresentation}
              onChange={(event) => onPanelPresentationChange?.(event.target.value as PanelPresentation)}
            >
              <option value="modal">Centered modal</option>
              <option value="dock-right">Docked side sheet</option>
            </select>
          </label>
          {workspaceLayouts && onSaveWorkspaceLayout && onResetWorkspaceLayout ? (
            <>
              <p className="health-subtitle">
                Saved layout for <strong>{workspaceMode}</strong> mode. Switch modes in the top bar to configure each layout.
              </p>
              <label className="diagnostics-opt-in">
                <input
                  type="checkbox"
                  checked={workspaceLayouts[workspaceMode]?.splitPreview ?? false}
                  onChange={(event) =>
                    onSaveWorkspaceLayout(workspaceMode, {
                      ...workspaceLayouts[workspaceMode],
                      splitPreview: event.target.checked,
                    })
                  }
                />
                <span>Split preview</span>
              </label>
              <label className="diagnostics-opt-in">
                <input
                  type="checkbox"
                  checked={workspaceLayouts[workspaceMode]?.showStickies ?? false}
                  onChange={(event) =>
                    onSaveWorkspaceLayout(workspaceMode, {
                      ...workspaceLayouts[workspaceMode],
                      showStickies: event.target.checked,
                    })
                  }
                />
                <span>Show sticky notes layer</span>
              </label>
              <label className="settings-field">
                Graph depth
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={workspaceLayouts[workspaceMode]?.graphDepth ?? DEFAULT_WORKSPACE_LAYOUTS[workspaceMode].graphDepth}
                  onChange={(event) =>
                    onSaveWorkspaceLayout(workspaceMode, {
                      ...workspaceLayouts[workspaceMode],
                      graphDepth: Number(event.target.value),
                    })
                  }
                />
              </label>
              <button type="button" className="toolbar-button" onClick={() => onResetWorkspaceLayout(workspaceMode)}>
                Reset {workspaceMode} layout
              </button>
            </>
          ) : null}
        </div>

        {workspaceChrome && onPatchWorkspaceChrome ? (
          <div className="settings-section">
            <h3>Appearance &amp; layout</h3>
            <p className="health-subtitle">Fine-tune sidebars, toolbars, typography, and panel stats.</p>
            <div className="settings-grid settings-toggles">
              {(
                [
                  ['showFormatToolbar', 'Show format toolbar'],
                  ['showEditorAssist', 'Show editor assist chips'],
                  ['showEditorStatus', 'Show editor status bar'],
                  ['showInspectorHealth', 'Show inspector note health'],
                  ['showWorkspaceFooter', 'Show workspace footer dock'],
                  ['showLineNumbers', 'Show line numbers'],
                  ['vaultSidebarCollapsed', 'Collapse vault sidebar'],
                  ['inspectorCollapsed', 'Collapse inspector'],
                ] as const
              ).map(([key, label]) => (
                <label className="diagnostics-opt-in" key={key}>
                  <input
                    type="checkbox"
                    checked={workspaceChrome[key]}
                    onChange={(event) => onPatchWorkspaceChrome({ [key]: event.target.checked })}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <label className="settings-field">
              Editor font size (px)
              <input
                type="number"
                min={11}
                max={24}
                value={workspaceChrome.editorFontSize}
                onChange={(event) => onPatchWorkspaceChrome({ editorFontSize: Number(event.target.value) })}
              />
            </label>
            <label className="settings-field">
              Editor font family
              <select
                value={workspaceChrome.editorFontFamily}
                onChange={(event) =>
                  onPatchWorkspaceChrome({
                    editorFontFamily: event.target.value as WorkspaceChromePrefs['editorFontFamily'],
                  })
                }
              >
                {EDITOR_FONT_FAMILIES.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-field">
              Editor line height
              <input
                type="number"
                min={1.2}
                max={2.2}
                step={0.05}
                value={workspaceChrome.editorLineHeight}
                onChange={(event) => onPatchWorkspaceChrome({ editorLineHeight: Number(event.target.value) })}
              />
            </label>
            <label className="settings-field">
              Editor padding (px)
              <input
                type="number"
                min={0}
                max={48}
                value={workspaceChrome.editorPaddingPx}
                onChange={(event) => onPatchWorkspaceChrome({ editorPaddingPx: Number(event.target.value) })}
              />
            </label>
            <label className="settings-field">
              Preview max width (ch)
              <input
                type="number"
                min={48}
                max={120}
                value={workspaceChrome.previewMaxWidthCh}
                onChange={(event) => onPatchWorkspaceChrome({ previewMaxWidthCh: Number(event.target.value) })}
              />
            </label>
            <label className="settings-field">
              Default editor view
              <select
                value={workspaceChrome.editorSurfaceMode}
                onChange={(event) =>
                  onPatchWorkspaceChrome({
                    editorSurfaceMode: event.target.value as WorkspaceChromePrefs['editorSurfaceMode'],
                  })
                }
              >
                <option value="source">Source only</option>
                <option value="split">Split (source + preview)</option>
                <option value="rendered">Rendered preview (inspector)</option>
              </select>
            </label>
            {onResetWorkspaceChrome ? (
              <button type="button" className="toolbar-button" onClick={onResetWorkspaceChrome}>
                Reset appearance defaults
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="settings-section">
          <h3>Support</h3>
          <p className="health-subtitle">Star the project, report issues, or contact the maintainer.</p>
          {onOpenSupport ? (
            <button type="button" className="toolbar-button" onClick={onOpenSupport}>
              Open support panel
            </button>
          ) : null}
        </div>

        {journey && onResetJourney ? (
          <div className="settings-section">
            <ReleaseQualityPanel
              journey={journey}
              timeToFirstEditMs={timeToFirstEditMs}
              timeToFirstExportMs={timeToFirstExportMs}
              onResetJourney={onResetJourney}
            />
          </div>
        ) : null}

        <div className="settings-section">
          <h3>Diagnostics</h3>
          <label className="diagnostics-opt-in">
            <input
              type="checkbox"
              checked={diagnosticsOptIn}
              onChange={(event) => onDiagnosticsOptInChange(event.target.checked)}
            />
            <span>Store local client diagnostics in `.scriptor/diagnostics/client.jsonl`</span>
          </label>
        </div>

        <div className="settings-section">
          <h3>System</h3>
          {systemInfo ? (
            <dl className="settings-grid">
              <div>
                <dt>OS</dt>
                <dd>{systemInfo.os}</dd>
              </div>
              <div>
                <dt>Architecture</dt>
                <dd>{systemInfo.arch}</dd>
              </div>
              <div>
                <dt>Family</dt>
                <dd>{systemInfo.family}</dd>
              </div>
              <div>
                <dt>Locale</dt>
                <dd>{systemInfo.locale ?? 'unknown'}</dd>
              </div>
            </dl>
          ) : (
            <p className="empty-state">System metadata is available in the desktop shell.</p>
          )}
        </div>
    </UnifiedPanelShell>
  )
}

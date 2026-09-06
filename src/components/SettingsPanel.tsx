import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatLocalDate } from '@scriptor/core/date'
import { Settings } from 'lucide-react'

import { useI18n } from '../lib/i18n'

import { diagnosticsExportSupportBundle, exportDiscover, vaultLoadConfig, vaultSaveConfig } from '../bridge/commands'
import { planDailyNotePreview } from '../lib/knowledge/templates'
import type { AiProviderId } from '../hooks/useAiProvider'
import type { AppTheme } from '../hooks/useAppTheme'
import type { JourneySnapshot } from '../hooks/useJourneyMetrics'
import type { PanelPresentation } from '../hooks/usePanelPresentation'
import { useVaultBackup } from '../hooks/useVaultBackup'
import type {
  WorkspaceChromePrefs,
} from '../hooks/useWorkspaceChrome'
import {
  DEFAULT_WORKSPACE_LAYOUTS,
  type WorkspaceLayout,
} from '../hooks/useWorkspaceLayout'
import type { WorkspaceMode } from '../hooks/useWorkspaceMode'
import { LAYOUT_PRESETS, type LayoutPreset } from '../lib/workspace/layoutPresets'
import type { PandocDiscovery, VaultConfig } from '../types/vault'
import type { SystemInfoSnapshot } from '../types/system'
import { DEFAULT_VAULT_CONFIG } from '../lib/settingsDefaults'
import { VaultConfigSettingsSection } from './VaultConfigSettingsSection'
import { AppearanceSettingsSection } from './AppearanceSettingsSection'
import { AiProviderSettings } from './AiProviderSettings'
import { DaemonOpsPanel } from './DaemonOpsPanel'
import { ReleaseQualityPanel } from './ReleaseQualityPanel'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import { VaultBackupSettings } from './VaultBackupSettings'
import { resolveHunspellLocale, SUPPORTED_LOCALES } from '@scriptor/editor/pure'

function matchesLayout(a: WorkspaceLayout | undefined, b: WorkspaceLayout): boolean {
  if (!a) return false
  return (
    a.splitPreview === b.splitPreview &&
    a.showStickies === b.showStickies &&
    a.graphDepth === b.graphDepth &&
    a.distractionFree === b.distractionFree
  )
}

/**
 * Layout template gallery. Applying a preset routes through the existing
 * workspace-layout save path, so no new persistence surface is introduced.
 */
function LayoutPresetGallery({
  current,
  onApply,
}: {
  current: WorkspaceLayout | undefined
  onApply: (preset: LayoutPreset) => void
}) {
  return (
    <div className="settings-layout-presets">
      <h4 className="settings-subheading">Layout templates</h4>
      <p className="health-subtitle">
        Apply a template to reconfigure this mode&apos;s split preview, stickies, and graph depth in one click.
      </p>
      <ul className="layout-preset-list">
        {LAYOUT_PRESETS.map((preset) => {
          const active = matchesLayout(current, preset.layout)
          return (
            <li key={preset.id} className="layout-preset-item">
              <div className="layout-preset-copy">
                <strong>{preset.name}</strong>
                <span className="health-subtitle">{preset.description}</span>
              </div>
              <button
                type="button"
                className="toolbar-button"
                aria-label={`Apply ${preset.name} layout template`}
                aria-pressed={active}
                onClick={() => onApply(preset)}
              >
                {active ? 'Active' : 'Apply'}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
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
  aiHttpWarning?: string | null
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
  hibernateGraph?: boolean
  onHibernateGraphChange?: (enabled: boolean) => void
  hibernateMcp?: boolean
  onHibernateMcpChange?: (enabled: boolean) => void
  hibernateWatcher?: boolean
  onHibernateWatcherChange?: (enabled: boolean) => void
  hibernateGit?: boolean
  onHibernateGitChange?: (enabled: boolean) => void
  hibernateSpellcheck?: boolean
  onHibernateSpellcheckChange?: (enabled: boolean) => void
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
  theme?: AppTheme
  onThemeChange?: (theme: AppTheme) => void
  onReplayOnboarding?: () => void
  spellcheckLocale?: string
  onSpellcheckLocaleChange?: (locale: string) => void
  languageToolEndpoint?: string
  onLanguageToolEndpointChange?: (endpoint: string) => void
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
  theme = 'light',
  onThemeChange,
  onReplayOnboarding,
  spellcheckLocale = 'en-US',
  onSpellcheckLocaleChange,
  languageToolEndpoint = 'http://localhost:8010/v2/check',
  onLanguageToolEndpointChange,
}: SettingsPanelProps) {
  const { locale, t, changeLocale, supportedLocales, localeLabels } = useI18n()
  const selectedSpellcheckLocale = resolveHunspellLocale(spellcheckLocale)
  const [config, setConfig] = useState<VaultConfig>(DEFAULT_VAULT_CONFIG)
  const [status, setStatus] = useState('')
  const [supportBundleStatus, setSupportBundleStatus] = useState('')
  const [pandoc, setPandoc] = useState<PandocDiscovery | null>(null)
  const [pandocError, setPandocError] = useState<string | null>(null)
  const backup = useVaultBackup(vaultOpen && nativeReady)

  const refreshPandoc = useCallback(async () => {
    if (!nativeReady) return
    try {
      const discovered = await exportDiscover()
      setPandoc(discovered)
      setPandocError(null)
    } catch (error) {
      setPandoc(null)
      setPandocError(error instanceof Error ? error.message : 'Pandoc not found')
    }
  }, [nativeReady])

  const dailyNotePreview = useMemo(() => {
    const today = formatLocalDate()
    return planDailyNotePreview(config.daily_note, today)
  }, [config.daily_note])

  useEffect(() => {
    if (!vaultOpen || !nativeReady) return
    void vaultLoadConfig()
      .then((loaded) =>
        setConfig({
          ...DEFAULT_VAULT_CONFIG,
          ...loaded,
          daily_note: { ...DEFAULT_VAULT_CONFIG.daily_note, ...loaded.daily_note },
          export: { ...DEFAULT_VAULT_CONFIG.export, ...loaded.export },
          writing_targets: {
            daily_words: loaded.writing_targets?.daily_words ?? DEFAULT_VAULT_CONFIG.writing_targets!.daily_words,
            history_path: loaded.writing_targets?.history_path ?? DEFAULT_VAULT_CONFIG.writing_targets!.history_path,
          },
          graph_groups: loaded.graph_groups ?? DEFAULT_VAULT_CONFIG.graph_groups,
          extra_roots: loaded.extra_roots ?? DEFAULT_VAULT_CONFIG.extra_roots,
        }),
      )
      .catch(() => setConfig(DEFAULT_VAULT_CONFIG))
  }, [nativeReady, vaultOpen])

  useEffect(() => {
    if (!nativeReady) return
    let cancelled = false
    void exportDiscover()
      .then((discovered) => {
        if (cancelled) return
        setPandoc(discovered)
        setPandocError(null)
      })
      .catch((error) => {
        if (cancelled) return
        setPandoc(null)
        setPandocError(error instanceof Error ? error.message : 'Pandoc not found')
      })
    return () => {
      cancelled = true
    }
  }, [nativeReady])

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
          <p className="health-subtitle">
            Updates are distributed as signed, checksum-published release artifacts. Built-in updating remains disabled until an authenticated delivery channel is configured.
          </p>
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

        {vaultOpen && nativeReady ? (
          <VaultConfigSettingsSection
            config={config}
            setConfig={setConfig}
            dailyNotePreview={dailyNotePreview}
            status={status}
            onSave={saveConfig}
          />
        ) : null}

        {vaultOpen && nativeReady ? <VaultBackupSettings backup={backup} /> : null}

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
              <LayoutPresetGallery
                current={workspaceLayouts[workspaceMode]}
                onApply={(preset) => onSaveWorkspaceLayout(workspaceMode, preset.layout)}
              />
            </>
          ) : null}
        </div>

        {workspaceChrome && onPatchWorkspaceChrome ? (
          <AppearanceSettingsSection
            workspaceChrome={workspaceChrome}
            onPatchWorkspaceChrome={onPatchWorkspaceChrome}
            onResetWorkspaceChrome={onResetWorkspaceChrome}
            theme={theme}
            onThemeChange={onThemeChange}
            onReplayOnboarding={onReplayOnboarding}
          />
        ) : null}

        <div className="settings-section">
          <h3>Spellcheck &amp; grammar</h3>
          <label className="settings-field">
            Spellcheck locale
            <select
              value={selectedSpellcheckLocale}
              onChange={(event) => onSpellcheckLocaleChange?.(event.target.value)}
            >
              {SUPPORTED_LOCALES.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </label>
          <p className="health-subtitle">
            Hunspell dictionary loaded on demand. English (US) is the default; additional locales require the matching `.dic` file in `public/dictionaries/`.
          </p>
          <label className="settings-field">
            LanguageTool endpoint
            <input
              value={languageToolEndpoint}
              placeholder="http://localhost:8010/v2/check"
              onChange={(event) => onLanguageToolEndpointChange?.(event.target.value)}
            />
          </label>
          <p className="health-subtitle">
            Defaults to self-hosted (port 8010) for privacy. Change to <code>https://api.languagetool.org/v2/check</code> for the cloud service — note that your text will be sent to a third-party server.
          </p>
        </div>

        <div className="settings-section">
          <h3>{t('settings.language')}</h3>
          <label className="settings-field">
            <span>{t('settings.displayLanguage')}</span>
            <select value={locale} onChange={(event) => changeLocale(event.target.value as typeof locale)}>
              {supportedLocales.map((entry) => (
                <option key={entry} value={entry}>
                  {localeLabels[entry] ?? entry}
                </option>
              ))}
            </select>
          </label>
          <p className="health-subtitle">{t('settingsSection.additionalLocales')}</p>
        </div>

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
          <button
            type="button"
            className="toolbar-button"
            disabled={!vaultOpen || !nativeReady}
            onClick={() => {
              setSupportBundleStatus('Creating support bundle…')
              void diagnosticsExportSupportBundle()
                .then((path) => setSupportBundleStatus(`Support bundle created: ${path}`))
                .catch((error) =>
                  setSupportBundleStatus(
                    `Support bundle failed: ${error instanceof Error ? error.message : String(error)}`,
                  ),
                )
            }}
          >
            Export redacted support bundle
          </button>
          {supportBundleStatus ? <p className="health-subtitle">{supportBundleStatus}</p> : null}
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

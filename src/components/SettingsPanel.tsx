import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { formatLocalDate } from '@scriptor/core/date'
import { Settings } from 'lucide-react'
import '../styles/components/settings-panel.css'

import { useI18n } from '../lib/i18n'

import { vaultLoadConfig } from '../bridge/commands'
import { mutateVaultConfig } from '../lib/vaultConfigMutation'
import { planDailyNotePreview } from '../lib/knowledge/templates'
import type { AiProviderId } from '../hooks/useAiProvider'
import type { AppTheme, AppearanceMode } from '../hooks/useAppTheme'
import type { JourneySnapshot } from '../hooks/useJourneyMetrics'
import type { PanelPresentation } from '../hooks/usePanelPresentation'
import { useVaultBackup } from '../hooks/useVaultBackup'
import type { WorkspaceChromePrefs } from '../hooks/useWorkspaceChrome'
import { DEFAULT_WORKSPACE_LAYOUTS, type WorkspaceLayout } from '../hooks/useWorkspaceLayout'
import type { WorkspaceMode } from '../hooks/useWorkspaceMode'
import type { VaultConfig } from '../types/vault'
import type { SystemInfoSnapshot } from '../types/system'
import { DEFAULT_VAULT_CONFIG } from '../lib/settingsDefaults'
import { VaultConfigSettingsSection } from './VaultConfigSettingsSection'
import { AppearanceSettingsSection } from './AppearanceSettingsSection'
import { GoogleIntegrationSettingsSection } from './GoogleIntegrationSettingsSection'
import { AiProviderSettings } from './AiProviderSettings'
import { KeyboardShortcutsSettingsSection } from './KeyboardShortcutsSettingsSection'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import { MutationConfirmation } from './chrome/MutationConfirmation'
import { VaultBackupSettings } from './VaultBackupSettings'
import { LayoutPresetGallery } from './LayoutPresetGallery'
import { AdvancedSettingsSection } from './AdvancedSettingsSection'
import { WorkspaceChromeSettingsSection } from './WorkspaceChromeSettingsSection'
import { resolveHunspellLocale, SUPPORTED_LOCALES } from '@scriptor/editor/pure'

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function mergeEditedValue(current: unknown, baseline: unknown, edited: unknown): unknown {
  if (valuesEqual(edited, baseline)) return current
  if (!isPlainRecord(current) || !isPlainRecord(baseline) || !isPlainRecord(edited)) return edited

  const next: Record<string, unknown> = { ...current }
  for (const key of Object.keys(edited)) {
    next[key] = mergeEditedValue(current[key], baseline[key], edited[key])
  }
  return next
}

function mergeEditedVaultConfig(current: VaultConfig, baseline: VaultConfig, edited: VaultConfig): VaultConfig {
  return mergeEditedValue(current, baseline, edited) as VaultConfig
}

interface SettingsPanelProps {
  vaultOpen: boolean
  vaultId: string | null
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
  onOpenSupport?: () => void
  theme?: AppTheme
  appearance?: AppearanceMode
  onThemeChange?: (theme: AppTheme) => void
  onAppearanceChange?: (appearance: AppearanceMode) => void
  onManagePalettes?: () => void
  onReplayOnboarding?: () => void
  spellcheckLocale?: string
  onSpellcheckLocaleChange?: (locale: string) => void
  languageToolEndpoint?: string
  onLanguageToolEndpointChange?: (endpoint: string) => void
}

type SettingsTab = 'general' | 'appearance' | 'workspace' | 'integrations' | 'shortcuts' | 'advanced'

const SETTINGS_TABS: Array<{ id: SettingsTab; labelKey: string; helpTopic: string }> = [
  { id: 'general', labelKey: 'settingsPanel.tabs.general', helpTopic: 'settings' },
  { id: 'appearance', labelKey: 'settingsPanel.tabs.appearance', helpTopic: 'appearance' },
  { id: 'workspace', labelKey: 'settingsPanel.tabs.workspace', helpTopic: 'workspace-chrome' },
  { id: 'integrations', labelKey: 'settingsPanel.tabs.integrations', helpTopic: 'integrations' },
  { id: 'shortcuts', labelKey: 'settingsPanel.tabs.shortcuts', helpTopic: 'shortcuts' },
  { id: 'advanced', labelKey: 'settingsPanel.tabs.advanced', helpTopic: 'advanced' },
]

/** Renders the tabbed application and vault settings surface. */
function SettingsPanelImpl({
  vaultOpen,
  vaultId,
  systemInfo,
  diagnosticsOptIn,
  onDiagnosticsOptInChange,
  aiProvider,
  aiEndpoint,
  aiHasApiKey,
  aiBusy,
  aiLastError,
  aiHttpWarning = null,
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
  onOpenSupport,
  theme = 'light',
  appearance = 'system',
  onThemeChange,
  onAppearanceChange,
  onManagePalettes,
  onReplayOnboarding,
  spellcheckLocale = 'en-US',
  onSpellcheckLocaleChange,
  languageToolEndpoint = 'http://localhost:8010/v2/check',
  onLanguageToolEndpointChange,
}: SettingsPanelProps) {
  const { locale, t, changeLocale, supportedLocales, localeLabels } = useI18n()
  const selectedSpellcheckLocale = resolveHunspellLocale(spellcheckLocale)
  const settingsTabs = useMemo(() => SETTINGS_TABS.map((entry) => ({ id: entry.id, label: t(entry.labelKey), helpTopic: entry.helpTopic })), [t])
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [config, setConfig] = useState<VaultConfig>(DEFAULT_VAULT_CONFIG)
  const [configBaseline, setConfigBaseline] = useState<VaultConfig>(DEFAULT_VAULT_CONFIG)
  const [configLoadedForVaultId, setConfigLoadedForVaultId] = useState<string | null>(null)
  const [configLoadError, setConfigLoadError] = useState<{ vaultId: string; message: string } | null>(null)
  const [configReloadToken, setConfigReloadToken] = useState(0)
  const [status, setStatus] = useState('')
  const [pendingCloseVaultId, setPendingCloseVaultId] = useState<string | null>(null)
  const backup = useVaultBackup(vaultOpen && nativeReady)
  const configReady = Boolean(vaultOpen && vaultId && configLoadedForVaultId === vaultId)
  const configDirty = configReady && !valuesEqual(config, configBaseline)
  const discardPromptOpen = Boolean(configDirty && vaultId && pendingCloseVaultId === vaultId)
  const visibleConfigLoadError = configLoadError?.vaultId === vaultId ? configLoadError.message : null

  const dailyNotePreview = useMemo(() => {
    const today = formatLocalDate()
    return planDailyNotePreview(config.daily_note, today)
  }, [config.daily_note])

  useEffect(() => {
    if (!vaultOpen || !vaultId || !nativeReady) return

    let cancelled = false
    void vaultLoadConfig(vaultId)
      .then((loaded) => {
        if (cancelled) return
        const nextConfig: VaultConfig = {
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
        }
        setConfigBaseline(nextConfig)
        setConfig(nextConfig)
        setConfigLoadedForVaultId(vaultId)
        setConfigLoadError(null)
        setStatus(t('settingsPanel.configLoaded'))
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setConfigLoadedForVaultId(null)
        setConfigLoadError({
          vaultId,
          message: error instanceof Error ? error.message : t('settingsPanel.configReadFailed'),
        })
        setStatus(t('settingsPanel.configUnchanged'))
      })
    return () => {
      cancelled = true
    }
  }, [configReloadToken, nativeReady, t, vaultId, vaultOpen])

  const retryConfigLoad = () => {
    setConfigBaseline(DEFAULT_VAULT_CONFIG)
    setConfig(DEFAULT_VAULT_CONFIG)
    setConfigLoadedForVaultId(null)
    setConfigLoadError(null)
    setStatus('')
    setConfigReloadToken((value) => value + 1)
  }

  const saveConfig = async () => {
    if (!nativeReady || !configReady) return
    setStatus(t('settingsPanel.saving'))
    try {
      const baseline = configBaseline
      const saved = await mutateVaultConfig((current) => mergeEditedVaultConfig(current, baseline, config), vaultId)
      setConfigBaseline(saved)
      setConfig(saved)
      setPendingCloseVaultId(null)
      setStatus(t('settingsPanel.configSaved'))
      onConfigSaved?.()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('settingsPanel.configSaveFailed'))
    }
  }

  const handleTabChange = useCallback((tab: string) => setActiveTab(tab as SettingsTab), [])
  const requestClose = useCallback(() => {
    if (configDirty && vaultId) {
      setPendingCloseVaultId(vaultId)
      return
    }
    onClose()
  }, [configDirty, onClose, vaultId])

  return (
    <UnifiedPanelShell
      title={t('settings.title')}
      subtitle={t('settingsPanel.subtitle')}
      icon={<Settings size={18} />}
      ariaLabel={t('settings.title')}
      helpTopic="settings"
      onClose={requestClose}
      presentation="modal"
      className="settings-panel knowledge-filters-panel"
      wide
      tabs={settingsTabs}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      footer={
        discardPromptOpen ? (
          <MutationConfirmation
            ariaLabel={t('settings.unsavedConfig')}
            message={t('settings.unsavedConfigMessage')}
            confirmLabel={t('settings.discardChanges')}
            onCancel={() => setPendingCloseVaultId(null)}
            onConfirm={() => {
              setPendingCloseVaultId(null)
              onClose()
            }}
            className="settings-unsaved-confirmation"
          />
        ) : ((activeTab === 'general' || activeTab === 'integrations' || configDirty) && vaultOpen && nativeReady && configReady ? (
          <div className="settings-footer-actions">
            {configDirty || status ? (
              <span className="settings-status" role="status">
                {configDirty ? t('settings.unsavedConfig') : status}
              </span>
            ) : null}
            <button type="button" className="primary-button" onClick={() => void saveConfig()} disabled={!configDirty}>
              {t('settingsPanel.saveVaultConfig')}
            </button>
          </div>
        ) : null)
      }
    >
      <div
        className="settings-tab-pane"
        hidden={activeTab !== 'general'}
        style={activeTab !== 'general' ? { display: 'none' } : undefined}
      >
        <p className="settings-persistence-note" role="note">
            {t('settingsPanel.persistence')}
          </p>

          {vaultOpen && nativeReady ? (
            visibleConfigLoadError ? (
              <section className="settings-section" aria-labelledby="vault-config-error-heading">
                <h3 id="vault-config-error-heading">{t('settingsPanel.configUnavailable')}</h3>
                <p className="settings-status warn" role="alert">
                  {t('settingsPanel.configNotOverwritten', { error: visibleConfigLoadError })}
                </p>
                <button type="button" className="toolbar-button" onClick={retryConfigLoad}>
                  {t('settingsPanel.retryConfig')}
                </button>
              </section>
            ) : configReady ? (
              <VaultConfigSettingsSection
                config={config}
                setConfig={setConfig}
                dailyNotePreview={dailyNotePreview}
                status={status}
                onSave={saveConfig}
              />
            ) : (
              <p className="empty-state" role="status">{t('settingsPanel.loadingConfig')}</p>
            )
          ) : null}

          {vaultOpen && nativeReady ? <VaultBackupSettings backup={backup} /> : null}

          <div className="settings-section">
            <h3>{t('settingsPanel.spellcheckGrammar')}</h3>
            <label className="settings-field">
              {t('settingsPanel.spellcheckLocale')}
              <select
                value={selectedSpellcheckLocale}
                onChange={(event) => onSpellcheckLocaleChange?.(event.target.value)}
              >
                {SUPPORTED_LOCALES.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </label>
            <p className="health-subtitle">
              {t('settingsPanel.spellcheckHelp')}
            </p>
            <label className="settings-field">
              {t('settingsPanel.languageToolEndpoint')}
              <input
                value={languageToolEndpoint}
                placeholder="http://localhost:8010/v2/check"
                onChange={(event) => onLanguageToolEndpointChange?.(event.target.value)}
              />
            </label>
            <p className="health-subtitle">
              {t('settingsPanel.languageToolHelp')}
            </p>
          </div>

          <div className="settings-section">
            <h3>{t('settings.language')}</h3>
            <label className="settings-field">
              <span>{t('settings.displayLanguage')}</span>
              <select value={locale} onChange={(event) => changeLocale(event.target.value as typeof locale)}>
                {supportedLocales.map((entry) => (
                  <option key={entry} value={entry}>{localeLabels[entry] ?? entry}</option>
                ))}
              </select>
            </label>
            <p className="health-subtitle">{t('settingsSection.additionalLocales')}</p>
          </div>

          {onReplayOnboarding ? (
            <div className="settings-section">
              <h3>{t('settingsPanel.productTour')}</h3>
              <p className="health-subtitle">{t('settingsPanel.productTourHelp')}</p>
              <button type="button" className="toolbar-button" onClick={onReplayOnboarding}>
                {t('appearanceSettings.replayTour')}
              </button>
            </div>
          ) : null}

          <div className="settings-section">
            <h3>{t('settingsPanel.support')}</h3>
            <p className="health-subtitle">{t('settingsPanel.supportHelp')}</p>
            {onOpenSupport ? (
              <button type="button" className="toolbar-button" onClick={onOpenSupport}>{t('settingsPanel.openSupport')}</button>
            ) : null}
          </div>
      </div>

      <div
        className="settings-tab-pane"
        hidden={activeTab !== 'appearance'}
        style={activeTab !== 'appearance' ? { display: 'none' } : undefined}
      >
        {workspaceChrome && onPatchWorkspaceChrome ? (
          <AppearanceSettingsSection
            workspaceChrome={workspaceChrome}
            onPatchWorkspaceChrome={onPatchWorkspaceChrome}
            theme={theme}
            appearance={appearance}
            onThemeChange={onThemeChange}
            onAppearanceChange={onAppearanceChange}
            onManagePalettes={onManagePalettes}
          />
        ) : null}
      </div>

      <div
        className="settings-tab-pane"
        data-help-topic="integrations"
        hidden={activeTab !== 'integrations'}
        style={activeTab !== 'integrations' ? { display: 'none' } : undefined}
      >
        {vaultOpen && nativeReady && configReady ? (
          <GoogleIntegrationSettingsSection config={config} setConfig={setConfig} vaultId={vaultId!} />
        ) : vaultOpen && nativeReady ? (
          <p className="empty-state" role="status">{t('settingsPanel.integrationsNeedConfig')}</p>
        ) : (
          <p className="empty-state">{t('settingsPanel.integrationsNeedVault')}</p>
        )}
        <AiProviderSettings
          provider={aiProvider}
          endpoint={aiEndpoint}
          hasApiKey={aiHasApiKey}
          busy={aiBusy}
          lastError={aiLastError}
          httpWarning={aiHttpWarning}
          onProviderChange={onAiProviderChange}
          onEndpointChange={onAiEndpointChange}
          onSaveApiKey={onAiSaveApiKey}
          onClearApiKey={onAiClearApiKey}
        />
      </div>

      <div
        className="settings-tab-pane"
        hidden={activeTab !== 'workspace'}
        style={activeTab !== 'workspace' ? { display: 'none' } : undefined}
      >
          <div className="settings-section">
            <h3>{t('settingsPanel.workspaceLayout')}</h3>
            <label className="settings-field">
              {t('settingsPanel.panelPresentation')}
              <select
                value={panelPresentation}
                onChange={(event) => onPanelPresentationChange?.(event.target.value as PanelPresentation)}
              >
                <option value="modal">{t('settingsPanel.modal')}</option>
                <option value="dock-right">{t('settingsPanel.dockRight')}</option>
              </select>
            </label>
            {workspaceLayouts && onSaveWorkspaceLayout && onResetWorkspaceLayout ? (
              <>
                <p className="health-subtitle">
                  {t('settingsPanel.savedLayout', { mode: workspaceMode })}
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
                  <span>{t('settingsPanel.splitPreview')}</span>
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
                  <span>{t('settingsPanel.showStickies')}</span>
                </label>
                <label className="settings-field">
                  {t('settingsPanel.graphDepth')}
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
                  {t('settingsPanel.resetLayout', { mode: workspaceMode })}
                </button>
                <LayoutPresetGallery
                  current={workspaceLayouts[workspaceMode]}
                  onApply={(preset) => onSaveWorkspaceLayout(workspaceMode, preset.layout)}
                />
              </>
            ) : null}
          </div>

          {workspaceChrome && onPatchWorkspaceChrome ? (
            <WorkspaceChromeSettingsSection
              workspaceChrome={workspaceChrome}
              onPatchWorkspaceChrome={onPatchWorkspaceChrome}
            />
          ) : null}

      </div>

      <div
        className="settings-tab-pane"
        hidden={activeTab !== 'shortcuts'}
        style={activeTab !== 'shortcuts' ? { display: 'none' } : undefined}
      >
        <KeyboardShortcutsSettingsSection />
      </div>

      <div
        className="settings-tab-pane"
        hidden={activeTab !== 'advanced'}
        style={activeTab !== 'advanced' ? { display: 'none' } : undefined}
      >
        <AdvancedSettingsSection
          active={activeTab === 'advanced'}
          vaultOpen={vaultOpen}
          nativeReady={nativeReady}
          systemInfo={systemInfo}
          diagnosticsOptIn={diagnosticsOptIn}
          onDiagnosticsOptInChange={onDiagnosticsOptInChange}
          headlessEngine={headlessEngine}
          onHeadlessEngineChange={onHeadlessEngineChange}
          daemonVersion={daemonVersion}
          daemonError={daemonError}
          onRefreshDaemon={onRefreshDaemon}
          onStartDaemon={onStartDaemon}
          activePath={activePath}
          journey={journey}
          timeToFirstEditMs={timeToFirstEditMs}
          timeToFirstExportMs={timeToFirstExportMs}
          onResetJourney={onResetJourney}
        />

      </div>
    </UnifiedPanelShell>
  )
}

export const SettingsPanel = memo(SettingsPanelImpl)

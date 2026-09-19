import { memo, useCallback, useEffect, useState } from 'react'

import { diagnosticsExportSupportBundle, exportDiscover } from '../bridge/commands'
import type { JourneySnapshot } from '../hooks/useJourneyMetrics'
import type { SystemInfoSnapshot } from '../types/system'
import type { PandocDiscovery } from '../types/vault'
import { DaemonOpsPanel } from './DaemonOpsPanel'
import { ReleaseQualityPanel } from './ReleaseQualityPanel'
import { useI18n } from '../lib/i18n'

interface AdvancedSettingsSectionProps {
  active: boolean
  vaultOpen: boolean
  nativeReady: boolean
  systemInfo: SystemInfoSnapshot | null
  diagnosticsOptIn: boolean
  onDiagnosticsOptInChange: (enabled: boolean) => void
  headlessEngine: boolean
  onHeadlessEngineChange: (enabled: boolean) => void
  daemonVersion: string | null
  daemonError: string | null
  onRefreshDaemon: () => void
  onStartDaemon: () => void
  activePath?: string | null
  journey?: JourneySnapshot
  timeToFirstEditMs?: number | null
  timeToFirstExportMs?: number | null
  onResetJourney?: () => void
}

/** Advanced/runtime settings isolated from the everyday product-preference surface. */
export const AdvancedSettingsSection = memo(function AdvancedSettingsSection({
  active,
  vaultOpen,
  nativeReady,
  systemInfo,
  diagnosticsOptIn,
  onDiagnosticsOptInChange,
  headlessEngine,
  onHeadlessEngineChange,
  daemonVersion,
  daemonError,
  onRefreshDaemon,
  onStartDaemon,
  activePath = null,
  journey,
  timeToFirstEditMs = null,
  timeToFirstExportMs = null,
  onResetJourney,
}: AdvancedSettingsSectionProps) {
  const { t } = useI18n()
  const [pandoc, setPandoc] = useState<PandocDiscovery | null>(null)
  const [pandocError, setPandocError] = useState<string | null>(null)
  const [supportBundleStatus, setSupportBundleStatus] = useState('')

  const refreshPandoc = useCallback(async () => {
    if (!nativeReady) return
    try {
      const discovered = await exportDiscover()
      setPandoc(discovered)
      setPandocError(null)
    } catch (error) {
      setPandoc(null)
      setPandocError(error instanceof Error ? error.message : t('advancedSettings.pandocNotFound'))
    }
  }, [nativeReady, t])

  useEffect(() => {
    if (!active || !nativeReady) return
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
        setPandocError(error instanceof Error ? error.message : t('advancedSettings.pandocNotFound'))
      })
    return () => {
      cancelled = true
    }
  }, [active, nativeReady, t])

  const exportSupportBundle = () => {
    setSupportBundleStatus(t('advancedSettings.creatingBundle'))
    void diagnosticsExportSupportBundle()
      .then((path) => setSupportBundleStatus(t('advancedSettings.bundleCreated', { path })))
      .catch((error) =>
        setSupportBundleStatus(t('advancedSettings.bundleFailed', { error: error instanceof Error ? error.message : String(error) })),
      )
  }

  return (
    <>
      <section className="settings-section" aria-labelledby="desktop-engine-heading">
        <h3 id="desktop-engine-heading">{t('advancedSettings.desktopEngine')}</h3>
        <p className="health-subtitle">
          {t('advancedSettings.description')}
        </p>
        <p className={nativeReady ? 'settings-status ok' : 'settings-status warn'}>
          {nativeReady ? t('advancedSettings.desktopReady') : t('advancedSettings.browserPreview')}
        </p>
        {nativeReady ? (
          <>
            <dl className="settings-grid">
              <div>
                <dt>{t('settings.pandoc')}</dt>
                <dd>{pandoc ? pandoc.version : pandocError ? t('settings.notFound') : t('settings.checking')}</dd>
              </div>
              <div>
                <dt>{t('advancedSettings.executable')}</dt>
                <dd className="settings-path">{pandoc?.path ?? '—'}</dd>
              </div>
            </dl>
            {pandocError ? (
              <p className="settings-status warn">
                {t('advancedSettings.pandocInstall', { error: pandocError })}
              </p>
            ) : null}
            <button type="button" className="toolbar-button" onClick={() => void refreshPandoc()}>
              {t('settings.refreshPandoc')}
            </button>
            <h4 className="settings-subheading">{t('advancedSettings.backgroundEngine')}</h4>
            <label className="diagnostics-opt-in">
              <input
                type="checkbox"
                checked={headlessEngine}
                onChange={(event) => onHeadlessEngineChange(event.target.checked)}
              />
              <span>{t('advancedSettings.useBackground')}</span>
            </label>
            <p className="health-subtitle">
              {t('advancedSettings.backgroundHelp')}
            </p>
            {headlessEngine ? (
              <>
                <p className={daemonVersion ? 'settings-status ok' : 'settings-status warn'} role="status">
                  {daemonVersion
                    ? t('advancedSettings.backgroundConnected', { version: daemonVersion })
                    : daemonError
                      ? t('advancedSettings.backgroundOffline', { error: daemonError })
                      : t('advancedSettings.backgroundUnknown')}
                </p>
                <div className="settings-actions">
                  <button type="button" className="toolbar-button" onClick={onRefreshDaemon}>{t('advancedSettings.refreshStatus')}</button>
                  <button type="button" className="toolbar-button" onClick={onStartDaemon}>{t('advancedSettings.startEngine')}</button>
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
      </section>

      <section className="settings-section" aria-labelledby="updates-heading">
        <h3 id="updates-heading">{t('advancedSettings.updates')}</h3>
        <p className="health-subtitle">
          {t('advancedSettings.updatesHelp')}
        </p>
      </section>

      {journey && onResetJourney ? (
        <section className="settings-section" aria-label={t('advancedSettings.releaseQuality')}>
          <ReleaseQualityPanel
            journey={journey}
            timeToFirstEditMs={timeToFirstEditMs}
            timeToFirstExportMs={timeToFirstExportMs}
            onResetJourney={onResetJourney}
          />
        </section>
      ) : null}

      <section className="settings-section" aria-labelledby="diagnostics-heading">
        <h3 id="diagnostics-heading">{t('advancedSettings.diagnostics')}</h3>
        <label className="diagnostics-opt-in">
          <input
            type="checkbox"
            checked={diagnosticsOptIn}
            onChange={(event) => onDiagnosticsOptInChange(event.target.checked)}
          />
          <span>{t('advancedSettings.storeDiagnostics')}</span>
        </label>
        <button
          type="button"
          className="toolbar-button"
          disabled={!vaultOpen || !nativeReady}
          onClick={exportSupportBundle}
        >
          {t('advancedSettings.exportBundle')}
        </button>
        {supportBundleStatus ? <p className="health-subtitle" role="status">{supportBundleStatus}</p> : null}
      </section>

      <section className="settings-section" aria-labelledby="system-information-heading">
        <h3 id="system-information-heading">{t('advancedSettings.systemInformation')}</h3>
        {systemInfo ? (
          <dl className="settings-grid">
            <div><dt>{t('advancedSettings.os')}</dt><dd>{systemInfo.os}</dd></div>
            <div><dt>{t('advancedSettings.architecture')}</dt><dd>{systemInfo.arch}</dd></div>
            <div><dt>{t('advancedSettings.family')}</dt><dd>{systemInfo.family}</dd></div>
            <div><dt>{t('advancedSettings.locale')}</dt><dd>{systemInfo.locale ?? t('advancedSettings.unknown')}</dd></div>
          </dl>
        ) : (
          <p className="empty-state">{t('advancedSettings.systemMetadata')}</p>
        )}
      </section>
    </>
  )
})

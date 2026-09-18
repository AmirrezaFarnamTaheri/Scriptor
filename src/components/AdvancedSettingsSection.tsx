import { memo, useCallback, useEffect, useState } from 'react'

import { diagnosticsExportSupportBundle, exportDiscover } from '../bridge/commands'
import type { JourneySnapshot } from '../hooks/useJourneyMetrics'
import type { SystemInfoSnapshot } from '../types/system'
import type { PandocDiscovery } from '../types/vault'
import { DaemonOpsPanel } from './DaemonOpsPanel'
import { ReleaseQualityPanel } from './ReleaseQualityPanel'

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
      setPandocError(error instanceof Error ? error.message : 'Pandoc not found')
    }
  }, [nativeReady])

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
        setPandocError(error instanceof Error ? error.message : 'Pandoc not found')
      })
    return () => {
      cancelled = true
    }
  }, [active, nativeReady])

  const exportSupportBundle = () => {
    setSupportBundleStatus('Creating support bundle…')
    void diagnosticsExportSupportBundle()
      .then((path) => setSupportBundleStatus(`Support bundle created: ${path}`))
      .catch((error) =>
        setSupportBundleStatus(`Support bundle failed: ${error instanceof Error ? error.message : String(error)}`),
      )
  }

  return (
    <>
      <section className="settings-section" aria-labelledby="desktop-engine-heading">
        <h3 id="desktop-engine-heading">Desktop engine</h3>
        <p className="health-subtitle">
          Advanced runtime details for local integrations and export tooling. Most users do not need to change these settings.
        </p>
        <p className={nativeReady ? 'settings-status ok' : 'settings-status warn'}>
          {nativeReady ? 'Desktop integration ready' : 'Browser preview — desktop-only vault commands are unavailable'}
        </p>
        {nativeReady ? (
          <>
            <dl className="settings-grid">
              <div>
                <dt>Pandoc</dt>
                <dd>{pandoc ? pandoc.version : pandocError ? 'Not found' : 'Checking…'}</dd>
              </div>
              <div>
                <dt>Executable</dt>
                <dd className="settings-path">{pandoc?.path ?? '—'}</dd>
              </div>
            </dl>
            {pandocError ? (
              <p className="settings-status warn">
                {pandocError}. Install Pandoc or set <code>SCRIPTOR_PANDOC_PATH</code>. Windows:{' '}
                <code>winget install JohnMacFarlane.Pandoc</code> · macOS: <code>brew install pandoc</code>
              </p>
            ) : null}
            <button type="button" className="toolbar-button" onClick={() => void refreshPandoc()}>
              Refresh Pandoc discovery
            </button>
            <h4 className="settings-subheading">Background desktop engine</h4>
            <label className="diagnostics-opt-in">
              <input
                type="checkbox"
                checked={headlessEngine}
                onChange={(event) => onHeadlessEngineChange(event.target.checked)}
              />
              <span>Use the background engine for supported vault operations</span>
            </label>
            <p className="health-subtitle">
              This can move indexing, search, graph, Git status and export work out of the main app process.
            </p>
            {headlessEngine ? (
              <>
                <p className={daemonVersion ? 'settings-status ok' : 'settings-status warn'} role="status">
                  {daemonVersion
                    ? `Background engine connected — version ${daemonVersion}`
                    : daemonError
                      ? `Background engine offline — ${daemonError}`
                      : 'Background engine status unknown'}
                </p>
                <div className="settings-actions">
                  <button type="button" className="toolbar-button" onClick={onRefreshDaemon}>Refresh status</button>
                  <button type="button" className="toolbar-button" onClick={onStartDaemon}>Start engine</button>
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
        <h3 id="updates-heading">Updates</h3>
        <p className="health-subtitle">
          Updates are distributed as signed, checksum-published release artifacts. Built-in updating remains disabled until an authenticated delivery channel is configured.
        </p>
      </section>

      {journey && onResetJourney ? (
        <section className="settings-section" aria-label="Release quality">
          <ReleaseQualityPanel
            journey={journey}
            timeToFirstEditMs={timeToFirstEditMs}
            timeToFirstExportMs={timeToFirstExportMs}
            onResetJourney={onResetJourney}
          />
        </section>
      ) : null}

      <section className="settings-section" aria-labelledby="diagnostics-heading">
        <h3 id="diagnostics-heading">Diagnostics</h3>
        <label className="diagnostics-opt-in">
          <input
            type="checkbox"
            checked={diagnosticsOptIn}
            onChange={(event) => onDiagnosticsOptInChange(event.target.checked)}
          />
          <span>Store local client diagnostics in <code>.scriptor/diagnostics/client.jsonl</code></span>
        </label>
        <button
          type="button"
          className="toolbar-button"
          disabled={!vaultOpen || !nativeReady}
          onClick={exportSupportBundle}
        >
          Export redacted support bundle
        </button>
        {supportBundleStatus ? <p className="health-subtitle" role="status">{supportBundleStatus}</p> : null}
      </section>

      <section className="settings-section" aria-labelledby="system-information-heading">
        <h3 id="system-information-heading">System information</h3>
        {systemInfo ? (
          <dl className="settings-grid">
            <div><dt>OS</dt><dd>{systemInfo.os}</dd></div>
            <div><dt>Architecture</dt><dd>{systemInfo.arch}</dd></div>
            <div><dt>Family</dt><dd>{systemInfo.family}</dd></div>
            <div><dt>Locale</dt><dd>{systemInfo.locale ?? 'unknown'}</dd></div>
          </dl>
        ) : (
          <p className="empty-state">System metadata is available in the desktop shell.</p>
        )}
      </section>
    </>
  )
})

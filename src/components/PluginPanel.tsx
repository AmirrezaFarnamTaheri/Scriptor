import { useState } from 'react'
import { Box, Lock, ShieldCheck, TimerReset } from 'lucide-react'

import type { TemplatePackContribution } from '@scriptor/core/contracts/plugin'
import type { LoadedPlugin } from '@scriptor/plugin-api'
import { contributionLabels, summarizePluginContributions } from '../lib/pluginContributions'
import { summarizeLintIssues } from '../lib/vaultLintSummary'
import type { VaultHealthDiagnostics } from '../types/vault'

interface PluginPanelProps {
  plugins: LoadedPlugin[]
  templatePacks: TemplatePackContribution[]
  safeMode: boolean
  healthDiagnostics: VaultHealthDiagnostics | null
  marketplaceCatalog: Array<{ id: string; name: string; version: string; description: string }>
  onToggleSafeMode: (enabled: boolean) => void
  onTogglePlugin: (pluginId: string, enabled: boolean) => void
  onInstallMarketplace: (pluginId: string) => void
}

export function PluginPanel({
  plugins,
  templatePacks,
  safeMode,
  healthDiagnostics,
  marketplaceCatalog,
  onToggleSafeMode,
  onTogglePlugin,
  onInstallMarketplace,
}: PluginPanelProps) {
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null)
  const lintSummary = healthDiagnostics ? summarizeLintIssues(healthDiagnostics.issues) : null
  const vaultLint = plugins.find((plugin) => plugin.manifest.id === 'scriptor-vault-lint')
  const selectedPlugin = plugins.find((plugin) => plugin.manifest.id === selectedPluginId) ?? null

  return (
    <>
      <section className="widget-card">
        <header>
          <h2>Plugin Runtime</h2>
          <button
            type="button"
            className="widget-action"
            onClick={() => onToggleSafeMode(!safeMode)}
          >
            <ShieldCheck />
            {safeMode ? 'Safe mode on' : 'Safe mode off'}
          </button>
        </header>
        <div className="permission-stack">
          <div>
            <ShieldCheck />
            <span>Manifest validation</span>
            <strong>On</strong>
          </div>
          <div>
            <Lock />
            <span>Raw filesystem access</span>
            <strong>Blocked</strong>
          </div>
          <div>
            <TimerReset />
            <span>Enabled plugins</span>
            <strong>{plugins.filter((plugin) => plugin.enabled).length}</strong>
          </div>
        </div>
      </section>

      <section className="widget-card">
        <header>
          <h2>Plugin marketplace</h2>
        </header>
        <div className="plugin-list">
          {marketplaceCatalog.map((listing) => {
            const installed = plugins.some((plugin) => plugin.manifest.id === listing.id)
            return (
              <button
                type="button"
                key={listing.id}
                className={installed ? 'active' : ''}
                onClick={() => onInstallMarketplace(listing.id)}
                disabled={safeMode && !installed}
              >
                <Box />
                <span>{listing.name}</span>
                <small>{listing.description}</small>
                <em>{installed ? 'installed' : 'install'}</em>
              </button>
            )
          })}
        </div>
      </section>

      <section className="widget-card">
        <header>
          <h2>Installed plugins</h2>
        </header>
        <div className="plugin-list">
          {plugins.map((plugin) => {
            const summary = summarizePluginContributions(plugin)
            const labels = contributionLabels(summary)
            return (
            <button
              type="button"
              key={plugin.manifest.id}
              className={`${plugin.enabled ? 'active' : ''}${selectedPluginId === plugin.manifest.id ? ' selected' : ''}`}
              onClick={() => setSelectedPluginId(plugin.manifest.id)}
              disabled={safeMode}
            >
              <Box />
              <span>{plugin.manifest.name}</span>
              <small>{plugin.manifest.capabilities.join(', ')}</small>
              {labels.length > 0 ? (
                <span className="plugin-contribution-chips">
                  {labels.map((label) => (
                    <em key={label}>{label}</em>
                  ))}
                </span>
              ) : null}
              <em>{plugin.enabled ? 'enabled' : 'disabled'}</em>
            </button>
            )
          })}
        </div>
        {safeMode && <p className="mcp-hint">Safe mode disables all plugins until turned off.</p>}
        {selectedPlugin ? (
          <div className="plugin-detail-pane">
            <h3>{selectedPlugin.manifest.name}</h3>
            <p className="health-subtitle">{selectedPlugin.manifest.description ?? 'No description provided.'}</p>
            <dl className="settings-grid plugin-trust-grid">
              <div>
                <dt>Version</dt>
                <dd>{selectedPlugin.manifest.version}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{selectedPlugin.enabled ? 'enabled' : 'disabled'}</dd>
              </div>
              <div>
                <dt>Capabilities</dt>
                <dd>{selectedPlugin.manifest.capabilities.join(', ') || 'none'}</dd>
              </div>
              <div>
                <dt>Filesystem</dt>
                <dd>Blocked (sandboxed)</dd>
              </div>
              <div>
                <dt>Network</dt>
                <dd>Blocked unless declared</dd>
              </div>
            </dl>
            <div className="plugin-contribution-chips">
              {contributionLabels(summarizePluginContributions(selectedPlugin)).map((label) => (
                <em key={label}>{label}</em>
              ))}
            </div>
            <button
              type="button"
              className="toolbar-button"
              disabled={safeMode}
              onClick={() => onTogglePlugin(selectedPlugin.manifest.id, !selectedPlugin.enabled)}
            >
              {selectedPlugin.enabled ? 'Disable plugin' : 'Enable plugin'}
            </button>
          </div>
        ) : null}
      </section>

      {templatePacks.length > 0 && (
        <section className="widget-card">
          <header>
            <h2>Canvas templates</h2>
          </header>
          <ul className="template-pack-list">
            {templatePacks.map((pack) => (
              <li key={pack.id}>
                <strong>{pack.label}</strong>
                <small>{pack.categories.join(', ')}</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      {vaultLint?.enabled && lintSummary && (
        <section className="widget-card">
          <header>
            <h2>Vault Lint</h2>
          </header>
          <div className="metric-grid health-metrics">
            <div className="metric">
              <span>Broken links</span>
              <strong>{lintSummary.brokenLinks}</strong>
            </div>
            <div className="metric">
              <span>Duplicate titles</span>
              <strong>{lintSummary.duplicateTitles}</strong>
            </div>
            <div className="metric">
              <span>Orphan assets</span>
              <strong>{lintSummary.orphanAssets}</strong>
            </div>
            <div className="metric">
              <span>Missing headings</span>
              <strong>{lintSummary.missingHeadings}</strong>
            </div>
            <div className="metric">
              <span>Stale definitions</span>
              <strong>{lintSummary.staleDefinitions}</strong>
            </div>
            <div className="metric">
              <span>Total issues</span>
              <strong>{lintSummary.total}</strong>
            </div>
          </div>
        </section>
      )}
    </>
  )
}

/**
 * StorePanel
 * -----------
 * Unified marketplace for Plugins, MCP tools, and optional Features.
 *
 * Tabs:
 *  1. Plugins   — installed plugins, marketplace catalog, toggle/install
 *  2. MCP       — MCP server mode, tool list, audit log
 *  3. Features  — feature flags (LaTeX, Calendar, Reading List, etc.)
 *
 * This is the canonical inspector store surface for plugins, MCP, and layouts.
 */

import { useState } from 'react'
import {
  Box,
  Check,
  ChevronRight,
  Cpu,
  FlaskConical,
  LayoutTemplate,
  Lock,
  Package,
  ShieldAlert,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  TimerReset,
} from 'lucide-react'

import type { TemplatePackContribution } from '@scriptor/core/contracts/plugin'
import type { McpMode } from '@scriptor/core/contracts/mcp'
import type { McpToolDescriptor } from '@scriptor/core/contracts/mcp'
import type { LoadedPlugin, PluginRuntimePolicy } from '@scriptor/plugin-api'
import { contributionLabels, summarizePluginContributions } from '../lib/pluginContributions'
import { summarizeLintIssues } from '../lib/vaultLintSummary'
import { LAYOUT_PRESETS } from '../lib/workspace/layoutPresets'
import type { LayoutPreset } from '../lib/workspace/layoutPresets'
import type { VaultHealthDiagnostics } from '../types/vault'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StoreTab = 'plugins' | 'mcp' | 'features' | 'layouts'

export interface FeatureFlagEntry {
  key: string
  label: string
  description: string
  enabled: boolean
  requiresRestart?: boolean
}

export interface McpAuditEntry {
  toolName: string
  commandId: string
  outcome: 'allowed' | 'denied' | 'failed'
  timestamp?: string
}

interface StorePanelProps {
  // --- Plugin tab ---
  plugins: LoadedPlugin[]
  templatePacks: TemplatePackContribution[]
  safeMode: boolean
  healthDiagnostics: VaultHealthDiagnostics | null
  marketplaceCatalog: Array<{ id: string; name: string; version: string; description: string }>
  activeVaultId: string | null
  pluginPolicies: Record<string, PluginRuntimePolicy | null>
  onToggleSafeMode: (enabled: boolean) => void
  onTogglePlugin: (pluginId: string, enabled: boolean) => void
  onReviewConsent: (
    pluginId: string,
    permissions: PluginRuntimePolicy['grantedPermissions'],
    vaultIds: string[],
  ) => void
  onRevokeConsent: (pluginId: string) => void
  onInstallMarketplace: (pluginId: string) => void
  // --- MCP tab ---
  // Optional: hosts that do not own MCP state (e.g. the inspector rail) render
  // the tab in its empty, read-only state rather than not at all.
  mcpMode?: McpMode
  mcpTools?: McpToolDescriptor[]
  mcpAuditLog?: McpAuditEntry[]
  onSetMcpMode?: (mode: McpMode) => void
  // --- Features tab ---
  featureFlags?: FeatureFlagEntry[]
  onToggleFeature?: (key: string, enabled: boolean) => void
  // --- Layouts tab ---
  activeLayoutPresetId?: string | null
  onApplyLayoutPreset?: (preset: LayoutPreset) => void
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TabButton({
  active,
  onClick,
  icon,
  label,
  id,
  controls,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  /** DOM id so the panel can point back at its own tab. */
  id: string
  /** DOM id of the panel this tab reveals. */
  controls: string
}) {
  return (
    <button
      type="button"
      id={id}
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      // Roving tabindex: only the selected tab is in the tab order, so Tab
      // enters and leaves the tablist once and arrows move between tabs.
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={`store-tab${active ? ' active' : ''}`}
    >
      {icon}
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// MCP Tab
// ---------------------------------------------------------------------------

const MCP_MODES: Array<{ value: McpMode; label: string; description: string }> = [
  { value: 'off', label: 'Off', description: 'MCP disabled. No tools exposed.' },
  { value: 'read-only', label: 'Read-Only', description: 'Search, read, and inspect tools only.' },
  { value: 'draft', label: 'Draft', description: 'AI may propose patches; you approve.' },
  { value: 'write-approved', label: 'Write (approved)', description: 'Approved patches apply directly.' },
]

function McpTab({
  mcpMode,
  mcpTools,
  mcpAuditLog,
  onSetMcpMode,
}: Required<Pick<StorePanelProps, 'mcpMode' | 'mcpTools' | 'mcpAuditLog' | 'onSetMcpMode'>>) {
  const [showAudit, setShowAudit] = useState(false)
  const interactive = onSetMcpMode !== noopSetMcpMode

  return (
    <div className="store-stack">
      {!interactive ? (
        <p className="store-hint">
          MCP controls are unavailable in this surface. Open the dedicated MCP panel to change mode.
        </p>
      ) : null}
      {/* Mode selector */}
      <section>
        <h3
          id="mcp-mode-label"
          className="store-section-label"
        >
          MCP Mode
        </h3>
        <div
          role="radiogroup"
          aria-labelledby="mcp-mode-label"
          className="store-stack-xs"
        >
          {MCP_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={mcpMode === m.value}
              disabled={!interactive}
              onClick={() => onSetMcpMode(m.value)}
              className={`store-mode-option${mcpMode === m.value ? ' active' : ''}`}
            >
              {mcpMode === m.value
                ? <Check size={14} color="var(--accent)" />
                : <div className="store-check-spacer" />}
              <div>
                <div className="store-item-title">{m.label}</div>
                <div className="store-item-desc">{m.description}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Tool list */}
      {mcpMode !== 'off' && (
        <section>
          <h3 className="store-section-label">
            Available Tools ({mcpTools.length})
          </h3>
          <div className="store-scroll-list">
            {mcpTools.map((tool) => (
              <div
                key={tool.name}
                className="store-tool-row"
              >
                <Cpu size={12} className="store-icon-dim" />
                <span className="store-mono">{tool.name}</span>
                <span className="store-ellipsis">
                  — {tool.description}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Audit log */}
      <section>
        <button
          type="button"
          aria-expanded={showAudit}
          onClick={() => setShowAudit((s) => !s)}
          className="store-audit-toggle"
        >
          <ChevronRight size={12} />
          Audit Log ({mcpAuditLog.length} entries)
        </button>
        {showAudit && (
          <div className="store-audit-list">
            {mcpAuditLog.slice(0, 50).map((entry, i) => (
              <div
                key={i}
                className={`store-audit-row${entry.outcome === 'denied' ? ' denied' : entry.outcome === 'failed' ? ' failed' : ''}`}
              >
                <span className="store-audit-outcome">
                  {entry.outcome}
                </span>
                <span className="store-mono-dim">{entry.toolName}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Features Tab
// ---------------------------------------------------------------------------

function FeaturesTab({
  featureFlags,
  onToggleFeature,
}: Required<Pick<StorePanelProps, 'featureFlags' | 'onToggleFeature'>>) {
  const interactive = onToggleFeature !== noopToggleFeature

  return (
    <div className="store-stack-sm">
      <p className="store-hint-spaced">
        Runtime controls let you pause optional background work without uninstalling anything.
        Changes take effect immediately unless marked <em>requires restart</em>.
      </p>
      {!interactive ? (
        <p className="store-hint">
          Feature toggles are read-only in this surface.
        </p>
      ) : null}
      {featureFlags.length === 0 ? (
        <p className="store-hint">
          No feature flags are available.
        </p>
      ) : null}
      {featureFlags.map((flag) => (
        <div
          key={flag.key}
          className={`store-flag-row${flag.enabled ? ' enabled' : ''}`}
        >
          <button
            type="button"
            disabled={!interactive}
            onClick={() => onToggleFeature(flag.key, !flag.enabled)}
            aria-label={`Toggle ${flag.label}`}
            aria-pressed={flag.enabled}
            className="store-flag-toggle"
          >
            {flag.enabled
              ? <ToggleRight size={22} color="var(--accent)" />
              : <ToggleLeft size={22} color="var(--text-muted)" />}
          </button>
          <div className="store-fill-row">
            <div className="store-item-title store-title-row">
              {flag.label}
              {flag.requiresRestart && (
                <span className="store-chip-warning">
                  restart
                </span>
              )}
            </div>
            <div className="store-item-sub">
              {flag.description}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Layouts Tab
// ---------------------------------------------------------------------------

function LayoutsTab({
  activeLayoutPresetId,
  onApplyLayoutPreset,
}: Pick<StorePanelProps, 'activeLayoutPresetId' | 'onApplyLayoutPreset'>) {
  return (
    <div className="store-stack-sm">
      <p className="store-hint-spaced">
        Alternate workspace layout templates. Applying one reconfigures the current
        workspace mode — split preview, stickies, and graph depth — in a single click.
      </p>
      {LAYOUT_PRESETS.map((preset) => {
        const active = preset.id === activeLayoutPresetId
        return (
          <div
            key={preset.id}
            className={`store-preset-row${active ? ' active' : ''}`}
          >
            <LayoutTemplate size={16} className="store-icon-70" />
            <div className="store-fill-row">
              <div className="store-item-title">{preset.name}</div>
              <div className="store-item-sub">
                {preset.description}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onApplyLayoutPreset?.(preset)}
              disabled={!onApplyLayoutPreset || active}
              aria-label={`Apply ${preset.name} layout`}
              aria-current={active ? 'true' : undefined}
              className={`store-btn-apply${active ? ' active' : ''}`}
            >
              {active ? 'Active' : 'Apply'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Plugins tab
// ---------------------------------------------------------------------------

/**
 * Required (non-optional) manifest permissions, i.e. the set that
 * `PluginRegistry.canEnable` insists on before a plugin may run.
 */
function requiredPermissions(plugin: LoadedPlugin): Array<PluginRuntimePolicy['grantedPermissions'][number]> {
  return plugin.manifest.permissions.filter((entry) => !entry.optional).map((entry) => entry.permission)
}

/**
 * Mirrors `PluginRegistry.canEnable`: every required permission must be granted
 * and, when the plugin touches vault content, the active vault must be in the
 * consent's allowlist. Without this the Enable toggle is a no-op, because
 * `registry.setEnabled` silently returns false when consent is missing.
 */
function hasRequiredConsent(
  plugin: LoadedPlugin,
  policy: PluginRuntimePolicy | null,
  activeVaultId: string | null,
): boolean {
  if (!policy) return false
  const required = requiredPermissions(plugin)
  if (!required.every((permission) => policy.grantedPermissions.includes(permission))) return false
  const needsVault = required.some(
    (permission) => permission === 'read' || permission === 'write-approved',
  )
  if (needsVault && (!activeVaultId || !policy.allowedVaultIds.includes(activeVaultId))) return false
  return true
}

function PluginsTab({
  plugins,
  safeMode,
  healthDiagnostics,
  marketplaceCatalog,
  pluginPolicies,
  activeVaultId,
  onToggleSafeMode,
  onTogglePlugin,
  onReviewConsent,
  onRevokeConsent,
  onInstallMarketplace,
}: Pick<
  StorePanelProps,
  | 'plugins'
  | 'safeMode'
  | 'healthDiagnostics'
  | 'marketplaceCatalog'
  | 'pluginPolicies'
  | 'activeVaultId'
  | 'onToggleSafeMode'
  | 'onTogglePlugin'
  | 'onReviewConsent'
  | 'onRevokeConsent'
  | 'onInstallMarketplace'
>) {
  const lintSummary = healthDiagnostics ? summarizeLintIssues(healthDiagnostics.issues) : null
  const installedIds = new Set(plugins.map((p) => p.manifest.id))

  return (
    <div className="store-stack">
      {/* Safe mode banner */}
      <div className={`store-banner${safeMode ? ' danger' : ''}`}>
        {safeMode
          ? <ShieldAlert size={16} color="var(--danger)" />
          : <ShieldCheck size={16} color="var(--success)" />}
        <span className="store-banner-label">
          {safeMode ? 'Safe mode — all plugins disabled' : 'Plugins active'}
        </span>
        <button
          type="button"
          onClick={() => onToggleSafeMode(!safeMode)}
          aria-pressed={safeMode}
          className={`store-btn-outline${safeMode ? ' danger' : ' success'}`}
        >
          {safeMode ? 'Disable' : 'Enable'} safe mode
        </button>
      </div>

      {/* Installed plugins */}
      {plugins.length > 0 && (
        <section>
          <h3 className="store-section-label">
            Installed ({plugins.length})
          </h3>
          <div className="store-stack-xs">
            {plugins.map((plugin) => {
              const policy = pluginPolicies[plugin.manifest.id] ?? null
              const summary = summarizePluginContributions(plugin)
              const labels = contributionLabels(summary)
              const required = requiredPermissions(plugin)
              const consented = hasRequiredConsent(plugin, policy, activeVaultId)
              const canGrant = Boolean(activeVaultId) && !safeMode
              const consentHintId = `store-plugin-consent-${plugin.manifest.id}`
              return (
                <div
                  key={plugin.manifest.id}
                  className="store-card"
                >
                  <div className="store-card-head">
                    <Box size={16} className="store-card-icon" />
                    <div className="store-flex1">
                      <div className="store-item-title">
                        {plugin.manifest.name}
                        <span className="store-version">
                          v{plugin.manifest.version}
                        </span>
                      </div>
                      {plugin.manifest.description && (
                        <div className="store-desc-dim store-mt2">
                          {plugin.manifest.description}
                        </div>
                      )}
                      {labels.length > 0 && (
                        <div className="store-chip-row">
                          {labels.map((label) => (
                            <span
                              key={label}
                              className="store-chip"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="store-inline-actions">
                      {consented ? (
                        <Lock size={12} className="store-icon-50" />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onTogglePlugin(plugin.manifest.id, !plugin.enabled)}
                        disabled={safeMode || (!plugin.enabled && !consented)}
                        aria-pressed={plugin.enabled}
                        aria-describedby={consented ? undefined : consentHintId}
                        className={`store-plugin-toggle${plugin.enabled ? ' enabled' : ''}`}
                      >
                        {plugin.enabled ? 'Enabled' : 'Enable'}
                      </button>
                    </div>
                  </div>

                  {/*
                    Consent review. PluginRegistry.setEnabled refuses to enable a
                    plugin whose required permissions were not granted for the active
                    vault, so the store must expose the grant/revoke path itself --
                    otherwise the Enable toggle above can never turn on. None of the
                    buttons below carry aria-pressed, so the row still exposes exactly
                    one aria-pressed control (the Enable toggle) for e2e activation.
                  */}
                  <section
                    aria-label={`Permissions for ${plugin.manifest.name}`}
                    className="store-permissions"
                  >
                    <div
                      id={consentHintId}
                      className={`store-consent-hint${consented ? '' : ' unconsented'}`}
                    >
                      {consented
                        ? <ShieldCheck size={12} aria-hidden="true" />
                        : <ShieldAlert size={12} aria-hidden="true" />}
                      <span>
                        {consented
                          ? 'Permissions reviewed for this vault'
                          : activeVaultId
                            ? 'Permission review required before enabling'
                            : 'Open a vault before granting plugin access'}
                      </span>
                    </div>
                    {plugin.manifest.permissions.length > 0 ? (
                      <ul className="store-perm-list">
                        {plugin.manifest.permissions.map((entry) => (
                          <li
                            key={entry.permission}
                            title={entry.reason}
                            className="store-chip"
                          >
                            {entry.permission}
                            {entry.optional ? ' (optional)' : ''}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="store-actions-row">
                      {consented ? null : (
                        <button
                          type="button"
                          disabled={!canGrant}
                          onClick={() => {
                            // Grant, then activate. Both callbacks mutate the same
                            // registry instance synchronously, so setEnabled observes
                            // the consent recorded one statement earlier.
                            onReviewConsent(
                              plugin.manifest.id,
                              plugin.manifest.permissions.map((entry) => entry.permission),
                              activeVaultId ? [activeVaultId] : [],
                            )
                            if (required.length === 0 || activeVaultId) {
                              onTogglePlugin(plugin.manifest.id, true)
                            }
                          }}
                          className="store-btn-accent"
                        >
                          Review and grant for this vault
                        </button>
                      )}
                      {policy ? (
                        <button
                          type="button"
                          onClick={() => onRevokeConsent(plugin.manifest.id)}
                          className="store-btn-muted"
                        >
                          Revoke access
                        </button>
                      ) : null}
                    </div>
                  </section>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Lint summary */}
      {lintSummary && lintSummary.total > 0 && (
        <div className="store-lint-summary">
          <TimerReset size={12} />
          {lintSummary.total} vault health issue{lintSummary.total !== 1 ? 's' : ''}
        </div>
      )}

      {/* Marketplace */}
      {marketplaceCatalog.length > 0 && (
        <section>
          <h3 className="store-section-label">
            Available ({marketplaceCatalog.filter((p) => !installedIds.has(p.id)).length})
          </h3>
          <div className="store-stack-xs">
            {marketplaceCatalog
              .filter((p) => !installedIds.has(p.id))
              .map((catalog) => (
                <div
                  key={catalog.id}
                  className="store-card-row"
                >
                  <Package size={16} className="store-icon-dim" />
                  <div className="store-flex1">
                    <div className="store-item-title">{catalog.name}</div>
                    <div className="store-desc-dim">{catalog.description}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onInstallMarketplace(catalog.id)}
                    aria-label={`Install ${catalog.name}`}
                    className="store-btn-accent"
                  >
                    Install
                  </button>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// StorePanel
// ---------------------------------------------------------------------------

/** Tab order used for both rendering and Arrow-key navigation. */
const STORE_TABS: Array<{ id: StoreTab; label: string; icon: React.ReactNode }> = [
  { id: 'plugins', label: 'Plugins', icon: <Box size={13} /> },
  { id: 'mcp', label: 'MCP', icon: <Cpu size={13} /> },
  { id: 'features', label: 'Features', icon: <FlaskConical size={13} /> },
  { id: 'layouts', label: 'Layouts', icon: <LayoutTemplate size={13} /> },
]

const tabId = (tab: StoreTab) => `store-tab-${tab}`
const panelId = (tab: StoreTab) => `store-panel-${tab}`

// Stable empty fallbacks for hosts that do not own MCP / feature-flag state.
// Module-level constants keep the tab props referentially stable across renders.
const EMPTY_MCP_TOOLS: McpToolDescriptor[] = []
const EMPTY_MCP_AUDIT: McpAuditEntry[] = []
const EMPTY_FEATURE_FLAGS: FeatureFlagEntry[] = []
const noopSetMcpMode = () => {}
const noopToggleFeature = () => {}

export function StorePanel(props: StorePanelProps) {
  const [activeTab, setActiveTab] = useState<StoreTab>('plugins')

  /**
   * APG tablist keyboard model: Left/Right wrap around, Home/End jump to the
   * ends. Selection follows focus, which is correct here because switching a
   * tab has no side effects beyond rendering its panel.
   */
  function handleTabKeyDown(e: React.KeyboardEvent) {
    const current = STORE_TABS.findIndex((t) => t.id === activeTab)
    let next = -1
    if (e.key === 'ArrowRight') next = (current + 1) % STORE_TABS.length
    else if (e.key === 'ArrowLeft') next = (current - 1 + STORE_TABS.length) % STORE_TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = STORE_TABS.length - 1
    if (next === -1) return
    e.preventDefault()
    const target = STORE_TABS[next]
    if (target === undefined) return
    setActiveTab(target.id)
    document.getElementById(tabId(target.id))?.focus()
  }

  return (
    <div className="store-root">
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Store sections"
        onKeyDown={handleTabKeyDown}
        className="store-tablist"
      >
        {STORE_TABS.map((tab) => (
          <TabButton
            key={tab.id}
            id={tabId(tab.id)}
            controls={panelId(tab.id)}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            icon={tab.icon}
            label={tab.label}
          />
        ))}
      </div>

      {/* Tab content */}
      <div
        id={panelId(activeTab)}
        role="tabpanel"
        aria-labelledby={tabId(activeTab)}
        tabIndex={-1}
        className="store-panel-body"
      >
        {activeTab === 'plugins' && (
          <>
            <h2 className="store-h2">Plugin marketplace</h2>
            <PluginsTab
              plugins={props.plugins}
              safeMode={props.safeMode}
              healthDiagnostics={props.healthDiagnostics}
              marketplaceCatalog={props.marketplaceCatalog}
              pluginPolicies={props.pluginPolicies}
              activeVaultId={props.activeVaultId}
              onToggleSafeMode={props.onToggleSafeMode}
              onTogglePlugin={props.onTogglePlugin}
              onReviewConsent={props.onReviewConsent}
              onRevokeConsent={props.onRevokeConsent}
              onInstallMarketplace={props.onInstallMarketplace}
            />
          </>
        )}
        {activeTab === 'mcp' && (
          <McpTab
            mcpMode={props.mcpMode ?? 'off'}
            mcpTools={props.mcpTools ?? EMPTY_MCP_TOOLS}
            mcpAuditLog={props.mcpAuditLog ?? EMPTY_MCP_AUDIT}
            onSetMcpMode={props.onSetMcpMode ?? noopSetMcpMode}
          />
        )}
        {activeTab === 'features' && (
          <FeaturesTab
            featureFlags={props.featureFlags ?? EMPTY_FEATURE_FLAGS}
            onToggleFeature={props.onToggleFeature ?? noopToggleFeature}
          />
        )}
        {activeTab === 'layouts' && (
          <LayoutsTab
            activeLayoutPresetId={props.activeLayoutPresetId}
            onApplyLayoutPreset={props.onApplyLayoutPreset}
          />
        )}
      </div>
    </div>
  )
}

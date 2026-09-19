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

import { memo, useState } from 'react'
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
import { MutationConfirmation } from './chrome/MutationConfirmation'
import { useI18n } from '../lib/i18n'

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

const MCP_MODES: Array<{ value: McpMode; labelKey: string; descriptionKey: string }> = [
  { value: 'off', labelKey: 'store.mcpModes.off.label', descriptionKey: 'store.mcpModes.off.description' },
  { value: 'read-only', labelKey: 'store.mcpModes.readOnly.label', descriptionKey: 'store.mcpModes.readOnly.description' },
  { value: 'draft', labelKey: 'store.mcpModes.draft.label', descriptionKey: 'store.mcpModes.draft.description' },
  { value: 'write-approved', labelKey: 'store.mcpModes.writeApproved.label', descriptionKey: 'store.mcpModes.writeApproved.description' },
]

function McpTab({
  mcpMode,
  mcpTools,
  mcpAuditLog,
  onSetMcpMode,
}: Required<Pick<StorePanelProps, 'mcpMode' | 'mcpTools' | 'mcpAuditLog' | 'onSetMcpMode'>>) {
  const { t } = useI18n()
  const [showAudit, setShowAudit] = useState(false)
  const interactive = onSetMcpMode !== noopSetMcpMode

  return (
    <div className="store-stack">
      {!interactive ? (
        <p className="store-hint">
          {t('store.mcpUnavailable')}
        </p>
      ) : null}
      {/* Mode selector */}
      <section>
        <h3
          id="mcp-mode-label"
          className="store-section-label"
        >
          {t('store.mcpMode')}
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
                <div className="store-item-title">{t(m.labelKey)}</div>
                <div className="store-item-desc">{t(m.descriptionKey)}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Tool list */}
      {mcpMode !== 'off' && (
        <section>
          <h3 className="store-section-label">
            {t('store.availableTools', { count: mcpTools.length })}
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
          {t('store.auditLog', { count: mcpAuditLog.length })}
        </button>
        {showAudit && (
          <div className="store-audit-list">
            {mcpAuditLog.slice(0, 50).map((entry, i) => (
              <div
                key={i}
                className={`store-audit-row${entry.outcome === 'denied' ? ' denied' : entry.outcome === 'failed' ? ' failed' : ''}`}
              >
                <span className="store-audit-outcome">
                  {t(`store.auditOutcome.${entry.outcome}`)}
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
  const { t } = useI18n()
  const interactive = onToggleFeature !== noopToggleFeature

  return (
    <div className="store-stack-sm">
      <p className="store-hint-spaced">
        {t('store.featureHintBefore')} <em>{t('store.requiresRestart')}</em>{t('store.featureHintAfter')}
      </p>
      {!interactive ? (
        <p className="store-hint">
          {t('store.featuresReadOnly')}
        </p>
      ) : null}
      {featureFlags.length === 0 ? (
        <p className="store-hint">
          {t('store.noFeatureFlags')}
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
            aria-label={t('store.toggleFeatureAria', { label: flag.label })}
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
                  {t('store.restart')}
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
  const { t } = useI18n()
  return (
    <div className="store-stack-sm">
      <p className="store-hint-spaced">
        {t('store.layoutHint')}
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
              aria-label={t('store.applyLayoutAria', { name: preset.name })}
              aria-current={active ? 'true' : undefined}
              className={`store-btn-apply${active ? ' active' : ''}`}
            >
              {active ? t('store.active') : t('store.apply')}
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
  const { t } = useI18n()
  const lintSummary = healthDiagnostics ? summarizeLintIssues(healthDiagnostics.issues) : null
  const installedIds = new Set(plugins.map((p) => p.manifest.id))
  const [pendingConsentPluginId, setPendingConsentPluginId] = useState<string | null>(null)
  const [pluginView, setPluginView] = useState<'installed' | 'marketplace'>('installed')

  return (
    <div className="store-stack">
      <div className="store-plugin-subnav" role="tablist" aria-label={t('store.pluginViews')}>
        <button
          type="button"
          role="tab"
          aria-selected={pluginView === 'installed'}
          className={pluginView === 'installed' ? 'active' : undefined}
          onClick={() => setPluginView('installed')}
        >
          {t('store.manageInstalled')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pluginView === 'marketplace'}
          className={pluginView === 'marketplace' ? 'active' : undefined}
          onClick={() => setPluginView('marketplace')}
        >
          {t('store.browsePlugins')}
        </button>
      </div>

      {/* Safe mode banner */}
      <div className={`store-banner${safeMode ? ' danger' : ''}`} hidden={pluginView !== 'installed'}>
        {safeMode
          ? <ShieldAlert size={16} color="var(--danger)" />
          : <ShieldCheck size={16} color="var(--success)" />}
        <span className="store-banner-label">
          {safeMode ? t('store.safeModeDisabled') : t('store.runtimeReady')}
        </span>
        <button
          type="button"
          onClick={() => onToggleSafeMode(!safeMode)}
          aria-pressed={safeMode}
          className={`store-btn-outline${safeMode ? ' danger' : ' success'}`}
        >
          {safeMode ? t('store.leaveSafeMode') : t('store.enterSafeMode')}
        </button>
        {!safeMode ? (
          <small className="store-banner-detail">{t('store.individualApproval')}</small>
        ) : null}
      </div>

      {/* Installed plugins */}
      {plugins.length > 0 && (
        <section hidden={pluginView !== 'installed'}>
          <h3 className="store-section-label">
            {t('store.installedCount', { count: plugins.length })}
          </h3>
          <div className="store-stack-xs">
            {plugins.map((plugin) => {
              const policy = pluginPolicies[plugin.manifest.id] ?? null
              const summary = summarizePluginContributions(plugin)
              const labels = contributionLabels(summary)
              const required = requiredPermissions(plugin)
              const optional = plugin.manifest.permissions.filter((entry) => entry.optional)
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
                        title={
                          safeMode
                            ? t('store.disableSafeModeBeforeEnable')
                            : !plugin.enabled && !consented
                              ? t('store.reviewBeforeEnable')
                              : undefined
                        }
                        className={`store-plugin-toggle${plugin.enabled ? ' enabled' : ''}`}
                      >
                        {plugin.enabled ? t('store.enabled') : t('store.enable')}
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
                    aria-label={t('store.permissionsAria', { plugin: plugin.manifest.name })}
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
                          ? t('store.permissionsReviewed')
                          : activeVaultId
                            ? t('store.permissionReviewRequired')
                            : t('store.openVaultBeforeGranting')}
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
                            {entry.optional ? t('store.optionalPermission') : t('store.requiredPermission')}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="store-actions-row">
                      {consented ? null : (
                        <button
                          type="button"
                          disabled={!canGrant}
                          onClick={() => setPendingConsentPluginId(plugin.manifest.id)}
                          className="store-btn-accent"
                          aria-label={t('store.reviewGrantAria', { plugin: plugin.manifest.name })}
                        >
                          {t('store.reviewRequiredAccess')}
                        </button>
                      )}
                      {policy ? (
                        <button
                          type="button"
                          onClick={() => onRevokeConsent(plugin.manifest.id)}
                          className="store-btn-muted"
                        >
                          {consented ? t('store.revokeVault') : t('store.resetPermissions')}
                        </button>
                      ) : null}
                    </div>
                    {pendingConsentPluginId === plugin.manifest.id ? (
                      <MutationConfirmation
                        ariaLabel={t('store.confirmPermissionsAria', { plugin: plugin.manifest.name })}
                        message={
                          required.length > 0
                            ? t('store.grantRequiredMessage', {
                                permissions: required.join(', '),
                                plugin: plugin.manifest.name,
                                optional: optional.length > 0
                                  ? t('store.optionalPermissionsNote', { permissions: optional.map((entry) => entry.permission).join(', ') })
                                  : '',
                              })
                            : t('store.enablePluginMessage', {
                                plugin: plugin.manifest.name,
                                optional: optional.length > 0
                                  ? t('store.optionalPermissionsNote', { permissions: optional.map((entry) => entry.permission).join(', ') })
                                  : '',
                              })
                        }
                        confirmLabel={t('store.grantEnable')}
                        onCancel={() => setPendingConsentPluginId(null)}
                        onConfirm={() => {
                          onReviewConsent(
                            plugin.manifest.id,
                            required,
                            activeVaultId ? [activeVaultId] : [],
                          )
                          if (required.length === 0 || activeVaultId) {
                            onTogglePlugin(plugin.manifest.id, true)
                          }
                          setPendingConsentPluginId(null)
                        }}
                        confirmDisabled={!canGrant}
                        className="store-permission-confirmation"
                      />
                    ) : null}
                  </section>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Lint summary */}
      {lintSummary && lintSummary.total > 0 && (
        <div className="store-lint-summary" hidden={pluginView !== 'installed'}>
          <TimerReset size={12} />
          {t('store.healthIssues', { count: lintSummary.total })}
        </div>
      )}

      {/* Marketplace */}
      {marketplaceCatalog.length > 0 && (
        <section hidden={pluginView !== 'marketplace'}>
          <h3 className="store-section-label">
            {t('store.marketplaceAvailable', { count: marketplaceCatalog.filter((p) => !installedIds.has(p.id)).length })}
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
                    aria-label={t('store.installAria', { name: catalog.name })}
                    className="store-btn-accent"
                  >
                    {t('store.install')}
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
const STORE_TABS: Array<{ id: StoreTab; labelKey: string; icon: React.ReactNode }> = [
  { id: 'plugins', labelKey: 'store.tabs.plugins', icon: <Box size={13} /> },
  { id: 'mcp', labelKey: 'store.tabs.mcp', icon: <Cpu size={13} /> },
  { id: 'features', labelKey: 'store.tabs.features', icon: <FlaskConical size={13} /> },
  { id: 'layouts', labelKey: 'store.tabs.layouts', icon: <LayoutTemplate size={13} /> },
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

export const StorePanel = memo(function StorePanel(props: StorePanelProps) {
  const { t } = useI18n()
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
    <div className="store-root" data-help-topic="plugins">
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label={t('store.sectionsAria')}
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
            label={t(tab.labelKey)}
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
            <h2 className="store-h2">{t('store.pluginManagement')}</h2>
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
})


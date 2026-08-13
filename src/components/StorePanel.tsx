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
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        borderRadius: 'var(--radius-sm)',
        border: 'none',
        cursor: 'pointer',
        fontWeight: active ? 600 : 400,
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? 'var(--bg)' : 'var(--text-muted)',
        fontSize: 'var(--text-sm)',
        transition: 'background var(--ease-fast), color var(--ease-fast)',
      }}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!interactive ? (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>
          MCP controls are unavailable in this surface. Open the dedicated MCP panel to change mode.
        </p>
      ) : null}
      {/* Mode selector */}
      <section>
        <h3
          id="mcp-mode-label"
          style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)' }}
        >
          MCP Mode
        </h3>
        <div
          role="radiogroup"
          aria-labelledby="mcp-mode-label"
          style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          {MCP_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={mcpMode === m.value}
              disabled={!interactive}
              onClick={() => onSetMcpMode(m.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid',
                borderColor: mcpMode === m.value ? 'var(--accent)' : 'var(--border)',
                background: mcpMode === m.value ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                cursor: interactive ? 'pointer' : 'not-allowed',
                opacity: interactive ? 1 : 0.6,
                textAlign: 'left',
              }}
            >
              {mcpMode === m.value
                ? <Check size={14} color="var(--accent)" />
                : <div style={{ width: 14 }} />}
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{m.label}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{m.description}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Tool list */}
      {mcpMode !== 'off' && (
        <section>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)' }}>
            Available Tools ({mcpTools.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
            {mcpTools.map((tool) => (
              <div
                key={tool.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-raised)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <Cpu size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
                <span style={{ fontFamily: 'monospace' }}>{tool.name}</span>
                <span style={{ opacity: 0.5, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-sm)',
            padding: 0,
          }}
        >
          <ChevronRight size={12} style={{ transform: showAudit ? 'rotate(90deg)' : 'none', transition: 'transform var(--ease-fast)' }} />
          Audit Log ({mcpAuditLog.length} entries)
        </button>
        {showAudit && (
          <div style={{ marginTop: 8, maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {mcpAuditLog.slice(0, 50).map((entry, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 8,
                  fontSize: 'var(--text-xs)',
                  padding: '3px 6px',
                  borderRadius: 'var(--radius-sm)',
                  background: entry.outcome === 'denied'
                    ? 'color-mix(in srgb, var(--danger) 12%, transparent)'
                    : entry.outcome === 'failed'
                    ? 'color-mix(in srgb, var(--warning) 12%, transparent)'
                    : 'var(--surface-raised)',
                }}
              >
                <span style={{
                  color: entry.outcome === 'denied'
                    ? 'var(--danger)'
                    : entry.outcome === 'failed'
                    ? 'var(--warning)'
                    : 'var(--success)',
                  fontWeight: 600,
                  minWidth: 50,
                }}>
                  {entry.outcome}
                </span>
                <span style={{ fontFamily: 'monospace', opacity: 0.8 }}>{entry.toolName}</span>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 4 }}>
        Feature flags let you opt-in to experimental or optional capabilities without reinstalling.
        Changes take effect immediately unless marked <em>requires restart</em>.
      </p>
      {!interactive ? (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>
          Feature toggles are read-only in this surface.
        </p>
      ) : null}
      {featureFlags.length === 0 ? (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>
          No feature flags are available.
        </p>
      ) : null}
      {featureFlags.map((flag) => (
        <div
          key={flag.key}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: flag.enabled ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
          }}
        >
          <button
            type="button"
            disabled={!interactive}
            onClick={() => onToggleFeature(flag.key, !flag.enabled)}
            aria-label={`Toggle ${flag.label}`}
            aria-pressed={flag.enabled}
            style={{
              background: 'none',
              border: 'none',
              cursor: interactive ? 'pointer' : 'not-allowed',
              opacity: interactive ? 1 : 0.5,
              padding: 0,
              display: 'flex',
            }}
          >
            {flag.enabled
              ? <ToggleRight size={22} color="var(--accent)" />
              : <ToggleLeft size={22} color="var(--text-muted)" />}
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              {flag.label}
              {flag.requiresRestart && (
                <span style={{ fontSize: 'var(--text-xs)', background: 'color-mix(in srgb, var(--warning) 20%, transparent)', color: 'var(--warning)', borderRadius: 'var(--radius-sm)', padding: '1px 5px' }}>
                  restart
                </span>
              )}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 4 }}>
        Alternate workspace layout templates. Applying one reconfigures the current
        workspace mode — split preview, stickies, and graph depth — in a single click.
      </p>
      {LAYOUT_PRESETS.map((preset) => {
        const active = preset.id === activeLayoutPresetId
        return (
          <div
            key={preset.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid',
              borderColor: active ? 'var(--accent)' : 'var(--border)',
              background: active ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
            }}
          >
            <LayoutTemplate size={16} style={{ flexShrink: 0, opacity: 0.7 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{preset.name}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                {preset.description}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onApplyLayoutPreset?.(preset)}
              disabled={!onApplyLayoutPreset || active}
              aria-label={`Apply ${preset.name} layout`}
              aria-current={active ? 'true' : undefined}
              style={{
                fontSize: 'var(--text-xs)',
                padding: '3px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--accent)',
                background: active ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'transparent',
                color: 'var(--accent)',
                cursor: !onApplyLayoutPreset || active ? 'default' : 'pointer',
                opacity: !onApplyLayoutPreset ? 0.4 : 1,
              }}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Safe mode banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          borderRadius: 'var(--radius-sm)',
          background: safeMode
            ? 'color-mix(in srgb, var(--danger) 10%, transparent)'
            : 'color-mix(in srgb, var(--success) 8%, transparent)',
          border: '1px solid',
          borderColor: safeMode
            ? 'color-mix(in srgb, var(--danger) 30%, transparent)'
            : 'color-mix(in srgb, var(--success) 22%, transparent)',
        }}
      >
        {safeMode
          ? <ShieldAlert size={16} color="var(--danger)" />
          : <ShieldCheck size={16} color="var(--success)" />}
        <span style={{ flex: 1, fontSize: 'var(--text-sm)' }}>
          {safeMode ? 'Safe mode — all plugins disabled' : 'Plugins active'}
        </span>
        <button
          type="button"
          onClick={() => onToggleSafeMode(!safeMode)}
          aria-pressed={safeMode}
          style={{
            fontSize: 'var(--text-xs)',
            background: 'none',
            border: '1px solid currentColor',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 8px',
            cursor: 'pointer',
            color: safeMode ? 'var(--danger)' : 'var(--success)',
          }}
        >
          {safeMode ? 'Disable' : 'Enable'} safe mode
        </button>
      </div>

      {/* Installed plugins */}
      {plugins.length > 0 && (
        <section>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)' }}>
            Installed ({plugins.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <Box size={16} style={{ marginTop: 2, flexShrink: 0, opacity: 0.7 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                        {plugin.manifest.name}
                        <span style={{ fontSize: 'var(--text-xs)', opacity: 0.5, marginLeft: 6 }}>
                          v{plugin.manifest.version}
                        </span>
                      </div>
                      {plugin.manifest.description && (
                        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginTop: 2 }}>
                          {plugin.manifest.description}
                        </div>
                      )}
                      {labels.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                          {labels.map((label) => (
                            <span
                              key={label}
                              style={{
                                fontSize: 'var(--text-xs)',
                                background: 'var(--surface-raised)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '1px 5px',
                                opacity: 0.8,
                              }}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {consented ? (
                        <Lock size={12} style={{ opacity: 0.5 }} />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onTogglePlugin(plugin.manifest.id, !plugin.enabled)}
                        disabled={safeMode || (!plugin.enabled && !consented)}
                        aria-pressed={plugin.enabled}
                        aria-describedby={consented ? undefined : consentHintId}
                        style={{
                          fontSize: 'var(--text-xs)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          background: plugin.enabled ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'transparent',
                          cursor: safeMode || (!plugin.enabled && !consented) ? 'not-allowed' : 'pointer',
                          opacity: safeMode || (!plugin.enabled && !consented) ? 0.4 : 1,
                          color: plugin.enabled ? 'var(--accent)' : 'inherit',
                        }}
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
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      paddingTop: 8,
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <div
                      id={consentHintId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 'var(--text-xs)',
                        color: consented ? 'var(--text-muted)' : 'var(--warning)',
                      }}
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
                      <ul
                        style={{
                          listStyle: 'none',
                          margin: 0,
                          padding: 0,
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 4,
                        }}
                      >
                        {plugin.manifest.permissions.map((entry) => (
                          <li
                            key={entry.permission}
                            title={entry.reason}
                            style={{
                              fontSize: 'var(--text-xs)',
                              background: 'var(--surface-raised)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '1px 5px',
                              opacity: 0.8,
                            }}
                          >
                            {entry.permission}
                            {entry.optional ? ' (optional)' : ''}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                          style={{
                            fontSize: 'var(--text-xs)',
                            padding: '3px 10px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--accent)',
                            background: 'transparent',
                            color: 'var(--accent)',
                            cursor: canGrant ? 'pointer' : 'not-allowed',
                            opacity: canGrant ? 1 : 0.4,
                          }}
                        >
                          Review and grant for this vault
                        </button>
                      )}
                      {policy ? (
                        <button
                          type="button"
                          onClick={() => onRevokeConsent(plugin.manifest.id)}
                          style={{
                            fontSize: 'var(--text-xs)',
                            padding: '3px 10px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border)',
                            background: 'transparent',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                          }}
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
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <TimerReset size={12} />
          {lintSummary.total} vault health issue{lintSummary.total !== 1 ? 's' : ''}
        </div>
      )}

      {/* Marketplace */}
      {marketplaceCatalog.length > 0 && (
        <section>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)' }}>
            Available ({marketplaceCatalog.filter((p) => !installedIds.has(p.id)).length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {marketplaceCatalog
              .filter((p) => !installedIds.has(p.id))
              .map((catalog) => (
                <div
                  key={catalog.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <Package size={16} style={{ flexShrink: 0, opacity: 0.6 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{catalog.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>{catalog.description}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onInstallMarketplace(catalog.id)}
                    aria-label={`Install ${catalog.name}`}
                    style={{
                      fontSize: 'var(--text-xs)',
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--accent)',
                      background: 'transparent',
                      color: 'var(--accent)',
                      cursor: 'pointer',
                    }}
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: 0,
        overflow: 'hidden',
      }}
    >
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Store sections"
        onKeyDown={handleTabKeyDown}
        style={{
          display: 'flex',
          gap: 4,
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
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
        style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}
      >
        {activeTab === 'plugins' && (
          <>
            <h2 style={{ fontSize: 'var(--text-lg)', margin: '0 0 12px' }}>Plugin marketplace</h2>
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

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
 * This component wraps the existing PluginPanel logic while adding MCP
 * and Feature tabs. PluginPanel is preserved for backwards-compat; callers
 * can migrate to StorePanel progressively.
 */

import { useState } from 'react'
import {
  Box,
  Check,
  ChevronRight,
  Cpu,
  FlaskConical,
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
import type { VaultHealthDiagnostics } from '../types/vault'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StoreTab = 'plugins' | 'mcp' | 'features'

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
  mcpMode: McpMode
  mcpTools: McpToolDescriptor[]
  mcpAuditLog: McpAuditEntry[]
  onSetMcpMode: (mode: McpMode) => void
  // --- Features tab ---
  featureFlags: FeatureFlagEntry[]
  onToggleFeature: (key: string, enabled: boolean) => void
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        borderRadius: 6,
        border: 'none',
        cursor: 'pointer',
        fontWeight: active ? 600 : 400,
        background: active ? 'var(--color-accent, #6366f1)' : 'transparent',
        color: active ? '#fff' : 'var(--color-text-muted, #888)',
        fontSize: 13,
        transition: 'all 0.15s ease',
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
}: Pick<StorePanelProps, 'mcpMode' | 'mcpTools' | 'mcpAuditLog' | 'onSetMcpMode'>) {
  const [showAudit, setShowAudit] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Mode selector */}
      <section>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-muted)' }}>
          MCP Mode
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {MCP_MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => onSetMcpMode(m.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid',
                borderColor: mcpMode === m.value ? 'var(--color-accent, #6366f1)' : 'var(--color-border, #333)',
                background: mcpMode === m.value ? 'rgba(99,102,241,0.12)' : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {mcpMode === m.value
                ? <Check size={14} color="var(--color-accent, #6366f1)" />
                : <div style={{ width: 14 }} />}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{m.description}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Tool list */}
      {mcpMode !== 'off' && (
        <section>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-muted)' }}>
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
                  borderRadius: 6,
                  background: 'var(--color-surface-raised, rgba(255,255,255,0.04))',
                  fontSize: 12,
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
          onClick={() => setShowAudit((s) => !s)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
            fontSize: 12,
            padding: 0,
          }}
        >
          <ChevronRight size={12} style={{ transform: showAudit ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
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
                  fontSize: 11,
                  padding: '3px 6px',
                  borderRadius: 4,
                  background: entry.outcome === 'denied'
                    ? 'rgba(239,68,68,0.1)'
                    : entry.outcome === 'failed'
                    ? 'rgba(249,115,22,0.1)'
                    : 'var(--color-surface-raised, rgba(255,255,255,0.03))',
                }}
              >
                <span style={{
                  color: entry.outcome === 'denied' ? '#ef4444' : entry.outcome === 'failed' ? '#f97316' : '#22c55e',
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
}: Pick<StorePanelProps, 'featureFlags' | 'onToggleFeature'>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>
        Feature flags let you opt-in to experimental or optional capabilities without reinstalling.
        Changes take effect immediately unless marked <em>requires restart</em>.
      </p>
      {featureFlags.map((flag) => (
        <div
          key={flag.key}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--color-border, #333)',
            background: flag.enabled ? 'rgba(99,102,241,0.06)' : 'transparent',
          }}
        >
          <button
            onClick={() => onToggleFeature(flag.key, !flag.enabled)}
            aria-label={`Toggle ${flag.label}`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
          >
            {flag.enabled
              ? <ToggleRight size={22} color="var(--color-accent, #6366f1)" />
              : <ToggleLeft size={22} color="var(--color-text-muted, #666)" />}
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              {flag.label}
              {flag.requiresRestart && (
                <span style={{ fontSize: 10, background: 'rgba(249,115,22,0.2)', color: '#f97316', borderRadius: 4, padding: '1px 5px' }}>
                  restart
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {flag.description}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Plugins Tab (extracted from PluginPanel inline logic)
// ---------------------------------------------------------------------------

function PluginsTab({
  plugins,
  safeMode,
  healthDiagnostics,
  marketplaceCatalog,
  pluginPolicies,
  onToggleSafeMode,
  onTogglePlugin,
  onInstallMarketplace,
}: Pick<
  StorePanelProps,
  | 'plugins'
  | 'safeMode'
  | 'healthDiagnostics'
  | 'marketplaceCatalog'
  | 'pluginPolicies'
  | 'onToggleSafeMode'
  | 'onTogglePlugin'
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
          borderRadius: 8,
          background: safeMode ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.06)',
          border: '1px solid',
          borderColor: safeMode ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.2)',
        }}
      >
        {safeMode ? <ShieldAlert size={16} color="#ef4444" /> : <ShieldCheck size={16} color="#22c55e" />}
        <span style={{ flex: 1, fontSize: 12 }}>
          {safeMode ? 'Safe mode — all plugins disabled' : 'Plugins active'}
        </span>
        <button
          onClick={() => onToggleSafeMode(!safeMode)}
          style={{
            fontSize: 11,
            background: 'none',
            border: '1px solid currentColor',
            borderRadius: 4,
            padding: '2px 8px',
            cursor: 'pointer',
            color: safeMode ? '#ef4444' : '#22c55e',
          }}
        >
          {safeMode ? 'Disable' : 'Enable'} safe mode
        </button>
      </div>

      {/* Installed plugins */}
      {plugins.length > 0 && (
        <section>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-muted)' }}>
            Installed ({plugins.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {plugins.map((plugin) => {
              const policy = pluginPolicies[plugin.manifest.id] ?? null
              const summary = summarizePluginContributions(plugin)
              const labels = contributionLabels(summary)
              return (
                <div
                  key={plugin.manifest.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--color-border, #333)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <Box size={16} style={{ marginTop: 2, flexShrink: 0, opacity: 0.7 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {plugin.manifest.name}
                      <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 6 }}>
                        v{plugin.manifest.version}
                      </span>
                    </div>
                    {plugin.manifest.description && (
                      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
                        {plugin.manifest.description}
                      </div>
                    )}
                    {labels.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                        {labels.map((label) => (
                          <span
                            key={label}
                            style={{
                              fontSize: 10,
                              background: 'var(--color-surface-raised, rgba(255,255,255,0.07))',
                              borderRadius: 4,
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
                    {policy ? (
                      <Lock size={12} style={{ opacity: 0.5 }} />
                    ) : null}
                    <button
                      onClick={() => onTogglePlugin(plugin.manifest.id, !plugin.enabled)}
                      disabled={safeMode}
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 4,
                        border: '1px solid var(--color-border, #444)',
                        background: plugin.enabled ? 'rgba(99,102,241,0.15)' : 'transparent',
                        cursor: safeMode ? 'not-allowed' : 'pointer',
                        opacity: safeMode ? 0.4 : 1,
                        color: plugin.enabled ? 'var(--color-accent, #6366f1)' : 'inherit',
                      }}
                    >
                      {plugin.enabled ? 'Enabled' : 'Enable'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Lint summary */}
      {lintSummary && lintSummary.total > 0 && (
        <div style={{ fontSize: 11, color: '#f97316', display: 'flex', alignItems: 'center', gap: 6 }}>
          <TimerReset size={12} />
          {lintSummary.total} vault health issue{lintSummary.total !== 1 ? 's' : ''}
        </div>
      )}

      {/* Marketplace */}
      {marketplaceCatalog.length > 0 && (
        <section>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-muted)' }}>
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
                    borderRadius: 8,
                    border: '1px solid var(--color-border, #333)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <Package size={16} style={{ flexShrink: 0, opacity: 0.6 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{catalog.name}</div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>{catalog.description}</div>
                  </div>
                  <button
                    onClick={() => onInstallMarketplace(catalog.id)}
                    style={{
                      fontSize: 11,
                      padding: '3px 10px',
                      borderRadius: 4,
                      border: '1px solid var(--color-accent, #6366f1)',
                      background: 'transparent',
                      color: 'var(--color-accent, #6366f1)',
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

export function StorePanel(props: StorePanelProps) {
  const [activeTab, setActiveTab] = useState<StoreTab>('plugins')

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
        style={{
          display: 'flex',
          gap: 4,
          padding: '8px 12px',
          borderBottom: '1px solid var(--color-border, #2a2a2a)',
          flexShrink: 0,
        }}
      >
        <TabButton
          active={activeTab === 'plugins'}
          onClick={() => setActiveTab('plugins')}
          icon={<Box size={13} />}
          label="Plugins"
        />
        <TabButton
          active={activeTab === 'mcp'}
          onClick={() => setActiveTab('mcp')}
          icon={<Cpu size={13} />}
          label="MCP"
        />
        <TabButton
          active={activeTab === 'features'}
          onClick={() => setActiveTab('features')}
          icon={<FlaskConical size={13} />}
          label="Features"
        />
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {activeTab === 'plugins' && (
          <PluginsTab
            plugins={props.plugins}
            safeMode={props.safeMode}
            healthDiagnostics={props.healthDiagnostics}
            marketplaceCatalog={props.marketplaceCatalog}
            pluginPolicies={props.pluginPolicies}
            onToggleSafeMode={props.onToggleSafeMode}
            onTogglePlugin={props.onTogglePlugin}
            onInstallMarketplace={props.onInstallMarketplace}
          />
        )}
        {activeTab === 'mcp' && (
          <McpTab
            mcpMode={props.mcpMode}
            mcpTools={props.mcpTools}
            mcpAuditLog={props.mcpAuditLog}
            onSetMcpMode={props.onSetMcpMode}
          />
        )}
        {activeTab === 'features' && (
          <FeaturesTab
            featureFlags={props.featureFlags}
            onToggleFeature={props.onToggleFeature}
          />
        )}
      </div>
    </div>
  )
}

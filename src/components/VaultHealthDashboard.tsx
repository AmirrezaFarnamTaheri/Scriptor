import { Activity } from 'lucide-react'

import { summarizeLintIssues } from '../lib/vaultLintSummary'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import type {
  InspectorWidgetContribution,
  VaultHealthCheckContribution,
} from '@scriptor/core/contracts/plugin'

import type { VaultHealthDiagnostics, VaultHealthReport } from '../types/vault'

interface VaultHealthDashboardProps {
  diagnostics: VaultHealthDiagnostics | null
  inspectorWidgets?: InspectorWidgetContribution[]
  vaultHealthChecks?: VaultHealthCheckContribution[]
  onClose: () => void
  onOpenIssue: (path: string) => void
  onRebuildIndex?: () => void
  onFixVaultLint?: () => void
  onOpenWorkbench?: () => void
  onGenerateLinkReferences?: () => void
  isFixingVaultLint?: boolean
}

function metricRows(summary: VaultHealthReport) {
  return [
    ['Indexed notes', summary.indexed_notes],
    ['Total words', summary.total_words.toLocaleString()],
    ['Broken links', summary.broken_links],
    ['Orphan assets', summary.orphan_assets],
    ['Duplicate titles', summary.duplicate_titles],
    ['Invalid frontmatter', summary.invalid_frontmatter],
    ['Unresolved citations', summary.unresolved_citations],
    ['Slow exports', summary.slow_exports],
    ['Cache', summary.cache_status],
  ] as const
}

export function VaultHealthDashboard({
  diagnostics,
  inspectorWidgets = [],
  vaultHealthChecks = [],
  onClose,
  onOpenIssue,
  onRebuildIndex,
  onFixVaultLint,
  onOpenWorkbench,
  onGenerateLinkReferences,
  isFixingVaultLint = false,
}: VaultHealthDashboardProps) {
  const summary = diagnostics?.summary ?? null
  const lintSummary = diagnostics ? summarizeLintIssues(diagnostics.issues) : null
  const vaultWidgets = inspectorWidgets.filter((widget) => widget.placement === 'vault')
  const cacheIssues =
    diagnostics?.issues.filter((issue) =>
      ['stale_cache', 'corrupt_cache', 'cache_missing'].includes(issue.kind),
    ) ?? []

  return (
    <UnifiedPanelShell
      title="Vault health"
      subtitle="Derived index diagnostics for the open vault."
      icon={<Activity size={18} />}
      ariaLabel="Vault health dashboard"
      onClose={onClose}
      className="health-dashboard knowledge-filters-panel"
      wide
    >
        {!summary ? (
          <p className="empty-state">Open a vault to inspect health.</p>
        ) : (
          <>
            <div className="metric-grid health-metrics">
              {metricRows(summary).map(([label, value]) => (
                <div className="metric" key={label}>
                  <span>{label}</span>
                  <strong>{String(value)}</strong>
                </div>
              ))}
            </div>

            {vaultWidgets.length > 0 && lintSummary ? (
              <section className="health-plugin-widgets" aria-label="Plugin health widgets">
                {vaultWidgets.map((widget) => (
                  <div className="health-plugin-widget" key={widget.id}>
                    <strong>{widget.label}</strong>
                    <div className="metric-grid health-metrics">
                      <div className="metric">
                        <span>Total issues</span>
                        <strong>{lintSummary.total}</strong>
                      </div>
                      <div className="metric">
                        <span>Broken links</span>
                        <strong>{lintSummary.brokenLinks}</strong>
                      </div>
                      <div className="metric">
                        <span>Missing headings</span>
                        <strong>{lintSummary.missingHeadings}</strong>
                      </div>
                      <div className="metric">
                        <span>Stale definitions</span>
                        <strong>{lintSummary.staleDefinitions}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            ) : null}

            {vaultHealthChecks.length > 0 && lintSummary ? (
              <section className="health-checklist" aria-label="Plugin health checks">
                <strong>Contributed health checks</strong>
                <ul>
                  {vaultHealthChecks.map((check) => {
                    const count =
                      check.id === 'broken-links'
                        ? lintSummary.brokenLinks
                        : check.id === 'missing-heading'
                          ? lintSummary.missingHeadings
                          : check.id === 'stale-definitions'
                            ? lintSummary.staleDefinitions
                            : check.id === 'duplicate-titles'
                              ? lintSummary.duplicateTitles
                              : check.id === 'orphan-assets'
                                ? lintSummary.orphanAssets
                                : 0
                    return (
                      <li key={check.id} data-severity={check.severity}>
                        <span>{check.label}</span>
                        <strong>{count}</strong>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}

            <section className="health-repair-center" aria-label="Repair actions">
              <strong>Repair center</strong>
              <p className="health-subtitle">Guided fixes for common vault issues.</p>
              <div className="health-repair-actions">
                {onOpenWorkbench ? (
                  <button type="button" className="toolbar-button" onClick={onOpenWorkbench}>
                    Open knowledge workbench
                  </button>
                ) : null}
                {onGenerateLinkReferences ? (
                  <button type="button" className="toolbar-button" onClick={onGenerateLinkReferences}>
                    Generate link references
                  </button>
                ) : null}
                {onFixVaultLint ? (
                  <button type="button" className="toolbar-button" disabled={isFixingVaultLint} onClick={onFixVaultLint}>
                    {isFixingVaultLint ? 'Fixing…' : 'Auto-fix vault lint'}
                  </button>
                ) : null}
                {onRebuildIndex ? (
                  <button type="button" className="toolbar-button" onClick={onRebuildIndex}>
                    Rebuild index
                  </button>
                ) : null}
              </div>
            </section>

            {cacheIssues.length > 0 && onRebuildIndex ? (
              <div className="health-cache-actions">
                <p className="health-subtitle">
                  {cacheIssues.length} cache issue{cacheIssues.length === 1 ? '' : 's'} detected.
                </p>
                <button type="button" className="toolbar-button" onClick={onRebuildIndex}>
                  Rebuild index
                </button>
              </div>
            ) : null}

            <div className="health-issues">
              <strong>
                {diagnostics?.issues.length
                  ? `${diagnostics.issues.length} issue(s)`
                  : 'No issues detected'}
              </strong>
              {diagnostics && diagnostics.issues.length > 0 && (
                <ul>
                  {diagnostics.issues.map((issue) => (
                    <li key={`${issue.kind}:${issue.path}:${issue.line ?? 0}:${issue.detail}`}>
                      <button type="button" onClick={() => onOpenIssue(issue.path)}>
                        <span className="issue-kind">{issue.kind.replaceAll('_', ' ')}</span>
                        <span>{issue.path}</span>
                        <small>
                          {issue.line ? `L${issue.line} · ` : ''}
                          {issue.detail}
                        </small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
    </UnifiedPanelShell>
  )
}

import { memo, useRef } from 'react'
import { Activity, CheckCircle2 } from 'lucide-react'

import { useI18n } from '../lib/i18n'
import { cacheStatusLabel, type Translate } from '../lib/vaultHealth'
import { summarizeLintIssues } from '../lib/vaultLintSummary'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import { HealthRepairCards } from './HealthRepairCards'
import '../styles/components/health-dashboard.css'
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
  expectedVaultId?: string
  onRepairsApplied?: () => Promise<void> | void
  runSourceNoteMutation?: (path: string, action: () => Promise<void>) => Promise<boolean>
}

function metricRows(summary: VaultHealthReport, t: Translate) {
  return [
    ['Indexed notes', summary.indexed_notes],
    ['Total words', summary.total_words.toLocaleString()],
    ['Broken links', summary.broken_links],
    ['Orphan assets', summary.orphan_assets],
    ['Duplicate titles', summary.duplicate_titles],
    ['Invalid frontmatter', summary.invalid_frontmatter],
    ['Unresolved citations', summary.unresolved_citations],
    ['Slow export runs', summary.slow_exports],
    ['Cache', cacheStatusLabel(t, summary.cache_status)],
  ] as const
}

export const VaultHealthDashboard = memo(function VaultHealthDashboard({
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
  expectedVaultId,
  onRepairsApplied,
  runSourceNoteMutation,
}: VaultHealthDashboardProps) {
  const summary = diagnostics?.summary ?? null
  const { t } = useI18n()
  const healthIntroRef = useRef<HTMLDivElement>(null)
  const lintSummary = diagnostics ? summarizeLintIssues(diagnostics.issues) : null
  const vaultWidgets = inspectorWidgets.filter((widget) => widget.placement === 'vault')
  const issueCount = diagnostics?.issues.length ?? 0
  const hasIssues = issueCount > 0
  const hasMaintenanceActions = Boolean(onOpenWorkbench || onGenerateLinkReferences || onFixVaultLint || onRebuildIndex)
  const cacheIssues =
    diagnostics?.issues.filter((issue) =>
      ['stale_cache', 'corrupt_cache', 'cache_missing'].includes(issue.kind),
    ) ?? []

  const repairActions = (
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
  )

  return (
    <UnifiedPanelShell
      title="Vault health"
      subtitle="Index, link, metadata, citation, export, and cache diagnostics for the open vault."
      icon={<Activity size={18} />}
      ariaLabel="Vault health dashboard"
      helpTopic="diagnostics"
      onClose={onClose}
      className="health-dashboard knowledge-filters-panel"
      initialFocusRef={healthIntroRef}
      wide
    >
      <div
        ref={healthIntroRef}
        tabIndex={-1}
        className={`health-intro${summary ? ` health-issues${hasIssues ? ' has-issues' : ' is-healthy'}` : ''}`}
      >
        {!summary ? (
          <p className="empty-state">{expectedVaultId ? 'Vault diagnostics have not loaded yet.' : 'Open a vault to inspect health.'}</p>
        ) : (
          <>
            <strong>
              {hasIssues ? (
                `${issueCount} issue${issueCount === 1 ? '' : 's'} need attention`
              ) : (
                <>
                  <CheckCircle2 size={15} aria-hidden="true" />
                  Vault looks healthy
                </>
              )}
            </strong>
            {!hasIssues ? <p>No broken health checks were found in the current diagnostic snapshot.</p> : null}
            {hasIssues && diagnostics ? (
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
            ) : null}
          </>
        )}
      </div>
      {summary ? (
        <>
          <div className="metric-grid health-metrics">
            {metricRows(summary, t).map(([label, value]) => (
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
                    <div className="metric"><span>Total issues</span><strong>{lintSummary.total}</strong></div>
                    <div className="metric"><span>Broken links</span><strong>{lintSummary.brokenLinks}</strong></div>
                    <div className="metric"><span>Missing headings</span><strong>{lintSummary.missingHeadings}</strong></div>
                    <div className="metric"><span>Stale definitions</span><strong>{lintSummary.staleDefinitions}</strong></div>
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

          {hasMaintenanceActions && hasIssues ? (
            <section className="health-repair-center" aria-label="Repair actions">
              <strong>Repair actions</strong>
              <p className="health-subtitle">Use these tools after reviewing the issues above.</p>
              {repairActions}
            </section>
          ) : hasMaintenanceActions ? (
            <details className="health-repair-center health-maintenance-details">
              <summary>Maintenance tools</summary>
              <p className="health-subtitle">Optional maintenance; no repair is currently required.</p>
              {repairActions}
            </details>
          ) : null}

          {expectedVaultId && diagnostics?.summary.vault_id === expectedVaultId ? <HealthRepairCards expectedVaultId={expectedVaultId} issues={diagnostics.issues} onRepairsApplied={onRepairsApplied} runSourceNoteMutation={runSourceNoteMutation} /> : null}

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
        </>
      ) : null}
    </UnifiedPanelShell>
  )
})

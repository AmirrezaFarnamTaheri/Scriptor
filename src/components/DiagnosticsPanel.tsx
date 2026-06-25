import { X } from 'lucide-react'

import type { ClientDiagnosticEvent } from '../hooks/useDiagnosticsSettings'
import type { EditorLintMessage } from '@scriptor/editor'
import type { ExternalChangeConflict, GitChangedFile, HealthIssue } from '../types/vault'

const CACHE_ISSUE_KINDS = new Set(['stale_cache', 'corrupt_cache', 'cache_missing'])
const FIXABLE_LINT_KINDS = new Set(['missing_heading', 'stale_definitions'])

interface DiagnosticsPanelProps {
  issues: HealthIssue[]
  gitConflicts: GitChangedFile[]
  externalChange?: ExternalChangeConflict | null
  clientEvents?: ClientDiagnosticEvent[]
  editorLintMessages?: EditorLintMessage[]
  activeNotePath?: string | null
  onClose: () => void
  onOpenIssue: (path: string, line?: number | null) => void
  onOpenEditorLint?: (line: number) => void
  onGenerateLinkReferences?: () => void
  onReloadExternalChange?: () => void
  onKeepEditingExternalChange?: () => void
  onRebuildIndex?: () => void
  onFixVaultLint?: () => void
  isFixingVaultLint?: boolean
}

export function DiagnosticsPanel({
  issues,
  gitConflicts,
  externalChange = null,
  clientEvents = [],
  editorLintMessages = [],
  activeNotePath = null,
  onClose,
  onOpenIssue,
  onOpenEditorLint,
  onGenerateLinkReferences,
  onReloadExternalChange,
  onKeepEditingExternalChange,
  onRebuildIndex,
  onFixVaultLint,
  isFixingVaultLint = false,
}: DiagnosticsPanelProps) {
  const cacheIssues = issues.filter((issue) => CACHE_ISSUE_KINDS.has(issue.kind))
  const vaultIssues = issues.filter((issue) => !CACHE_ISSUE_KINDS.has(issue.kind))
  const fixableLintCount = vaultIssues.filter((issue) => FIXABLE_LINT_KINDS.has(issue.kind)).length
  const missingLinkRefs = editorLintMessages.filter((message) => message.ruleId === 'foam-missing-reference').length
  const total =
    issues.length +
    gitConflicts.length +
    clientEvents.length +
    editorLintMessages.length +
    (externalChange ? 1 : 0)

  return (
    <section className="diagnostics-panel" aria-label="Diagnostics">
      <header>
        <strong>Problems ({total})</strong>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close diagnostics">
          <X />
        </button>
      </header>

      {total === 0 ? (
        <p className="empty-state">No vault, Git, or client problems detected.</p>
      ) : (
        <div className="diagnostics-groups">
          {externalChange ? (
            <section>
              <h3>External changes</h3>
              <ul>
                <li>
                  <div className="client-diagnostic-row">
                    <span className="issue-kind">conflict</span>
                    <span>{externalChange.path}</span>
                    <small>Modified on disk while you have unsaved edits</small>
                  </div>
                  <div className="external-change-banner-actions">
                    <button type="button" className="toolbar-button" onClick={onReloadExternalChange}>
                      Reload from disk
                    </button>
                    <button type="button" className="toolbar-button" onClick={onKeepEditingExternalChange}>
                      Keep editing
                    </button>
                  </div>
                </li>
              </ul>
            </section>
          ) : null}

          {cacheIssues.length > 0 && (
            <section>
              <h3>Index cache</h3>
              <ul>
                {cacheIssues.map((issue) => (
                  <li key={`${issue.kind}:${issue.path}:${issue.detail}`}>
                    <div className="client-diagnostic-row">
                      <span className="issue-kind">{issue.kind.replaceAll('_', ' ')}</span>
                      <span>{issue.path}</span>
                      <small>{issue.detail}</small>
                    </div>
                  </li>
                ))}
              </ul>
              {onRebuildIndex ? (
                <button type="button" className="toolbar-button" onClick={onRebuildIndex}>
                  Rebuild index
                </button>
              ) : null}
            </section>
          )}

          {gitConflicts.length > 0 && (
            <section>
              <h3>Git conflicts</h3>
              <ul>
                {gitConflicts.map((file) => (
                  <li key={file.path}>
                    <button type="button" onClick={() => onOpenIssue(file.path)}>
                      <span className="issue-kind">conflict</span>
                      <span>{file.path}</span>
                      <small>Resolve manually before pull or push</small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {clientEvents.length > 0 && (
            <section>
              <h3>Client diagnostics</h3>
              <ul>
                {clientEvents.map((event) => (
                  <li key={event.id}>
                    <div className="client-diagnostic-row">
                      <span className="issue-kind">{event.type}</span>
                      <span>{event.message}</span>
                      {event.detail ? <small>{event.detail}</small> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {editorLintMessages.length > 0 && (
            <section>
              <div className="diagnostics-section-header">
                <h3>Editor lint</h3>
                {missingLinkRefs > 0 && onGenerateLinkReferences ? (
                  <button type="button" className="toolbar-button" onClick={onGenerateLinkReferences}>
                    Generate link references
                  </button>
                ) : null}
              </div>
              <ul>
                {editorLintMessages.map((message, index) => (
                  <li key={`${message.ruleId}:${message.line}:${message.column}:${index}`}>
                    <button
                      type="button"
                      onClick={() => onOpenEditorLint?.(message.line)}
                    >
                      <span className={`issue-kind issue-${message.severity}`}>{message.ruleId}</span>
                      <span>{activeNotePath ?? 'Active note'}</span>
                      <small>
                        L{message.line}:{message.column} · {message.message}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {vaultIssues.length > 0 && (
            <section>
              <div className="diagnostics-section-header">
                <h3>Vault lint</h3>
                {fixableLintCount > 0 && onFixVaultLint ? (
                  <button
                    type="button"
                    className="toolbar-button"
                    disabled={isFixingVaultLint}
                    onClick={onFixVaultLint}
                  >
                    {isFixingVaultLint ? 'Fixing…' : `Fix ${fixableLintCount} issue${fixableLintCount === 1 ? '' : 's'}`}
                  </button>
                ) : null}
              </div>
              <ul>
                {vaultIssues.map((issue) => (
                  <li key={`${issue.kind}:${issue.path}:${issue.line ?? 0}:${issue.detail}`}>
                    <button type="button" onClick={() => onOpenIssue(issue.path, issue.line)}>
                      <span className="issue-kind">{issue.kind.replaceAll('_', ' ')}</span>
                      <span>{issue.path}</span>
                      <small>
                        {issue.line ? `L${issue.line} · ` : ''}
                        {issue.detail}
                        {FIXABLE_LINT_KINDS.has(issue.kind) ? ' · fixable' : ''}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * PublishDiffView — W1-7
 *
 * Renders the four-bucket publish plan (new_items, changed, unchanged, orphaned)
 * and lets the user select which items to apply.  No publish may occur without
 * the user first seeing this view (enforced by the parent's state machine: the
 * plan prop is only set after `plan_publish_cmd` completes).
 *
 * Acceptance criteria (plan W1-7):
 * - No publish without a plan the user saw.
 * - Orphan deletion requires an explicit per-item checkbox — no bulk action.
 * - requireFrontmatterOptIn = true is surfaced in a notice.
 */
import { useCallback, useMemo, useState } from 'react'
import { CheckCircle2, Circle, FilePlus, FilePen, FileX, Eye, AlertTriangle } from 'lucide-react'

import type { PublishCandidate, PublishPlan } from '../types/vault'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PublishDiffViewProps {
  plan: PublishPlan
  /** Whether the plan was produced with requireFrontmatterOptIn = true (default). */
  requireFrontmatterOptIn: boolean
  /** Called when the user confirms which items to apply. */
  onApply: (selectedPaths: string[], deleteOrphans: string[]) => void
  /** Called to discard the plan and re-run a fresh scan. */
  onReplan: () => void
  /** Disabled while an apply is in-flight. */
  applying: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function basename(path: string): string {
  return path.split('/').pop() ?? path
}

function dirPart(path: string): string {
  const parts = path.split('/')
  return parts.length > 1 ? parts.slice(0, -1).join('/') + '/' : ''
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface CandidateRowProps {
  candidate: PublishCandidate
  checked: boolean
  onChange: (path: string, checked: boolean) => void
  icon: React.ReactNode
  rowClass: string
}

function CandidateRow({ candidate, checked, onChange, icon, rowClass }: CandidateRowProps) {
  return (
    <li className={`publish-diff-row ${rowClass}`}>
      <label className="publish-diff-label">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(candidate.rel_path, e.target.checked)}
          className="publish-diff-checkbox"
          aria-label={`Include ${candidate.rel_path}`}
        />
        <span className="publish-diff-icon" aria-hidden="true">{icon}</span>
        <span className="publish-diff-path">
          <span className="publish-diff-dir">{dirPart(candidate.rel_path)}</span>
          <span className="publish-diff-name">{basename(candidate.rel_path)}</span>
        </span>
      </label>
    </li>
  )
}

interface OrphanRowProps {
  path: string
  checked: boolean
  onChange: (path: string, checked: boolean) => void
}

function OrphanRow({ path, checked, onChange }: OrphanRowProps) {
  return (
    <li className="publish-diff-row publish-diff-orphan">
      <label className="publish-diff-label">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(path, e.target.checked)}
          className="publish-diff-checkbox"
          aria-label={`Delete orphaned file ${path}`}
        />
        <span className="publish-diff-icon" aria-hidden="true">
          <FileX size={14} />
        </span>
        <span className="publish-diff-path">
          <span className="publish-diff-dir">{dirPart(path)}</span>
          <span className="publish-diff-name">{basename(path)}</span>
        </span>
      </label>
      <span className="publish-diff-badge publish-diff-badge-orphan">delete</span>
    </li>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PublishDiffView({
  plan,
  requireFrontmatterOptIn,
  onApply,
  onReplan,
  applying,
}: PublishDiffViewProps) {
  // All new + changed items are selected by default.
  const allActionable = useMemo(
    () => [...plan.new_items, ...plan.changed].map((c) => c.rel_path),
    [plan],
  )

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(
    () => new Set(allActionable),
  )
  const [deleteOrphans, setDeleteOrphans] = useState<Set<string>>(
    // No orphan is pre-checked — deletion requires deliberate action.
    () => new Set<string>(),
  )

  const handleItemToggle = useCallback((path: string, checked: boolean) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      if (checked) next.add(path)
      else next.delete(path)
      return next
    })
  }, [])

  const handleOrphanToggle = useCallback((path: string, checked: boolean) => {
    setDeleteOrphans((prev) => {
      const next = new Set(prev)
      if (checked) next.add(path)
      else next.delete(path)
      return next
    })
  }, [])

  const handleApply = useCallback(() => {
    onApply(Array.from(selectedPaths), Array.from(deleteOrphans))
  }, [onApply, selectedPaths, deleteOrphans])

  const hasAnything =
    selectedPaths.size > 0 || deleteOrphans.size > 0

  const isClean = plan.new_items.length === 0
    && plan.changed.length === 0
    && plan.orphaned.length === 0

  return (
    <section className="publish-diff-view" aria-label="Publish plan review">
      {/* Header notices */}
      {!requireFrontmatterOptIn && (
        <div className="publish-diff-notice publish-diff-notice-warning" role="note">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>
            <strong>Frontmatter opt-in is disabled.</strong> All notes matching the
            include globs will be published regardless of their frontmatter.
          </span>
        </div>
      )}

      {isClean ? (
        <div className="publish-diff-notice publish-diff-notice-clean" role="status">
          <CheckCircle2 size={14} aria-hidden="true" />
          <span>Nothing to publish — site is already up to date.</span>
        </div>
      ) : null}

      {/* New items */}
      {plan.new_items.length > 0 && (
        <div className="publish-diff-bucket">
          <h4 className="publish-diff-bucket-heading">
            <FilePlus size={14} aria-hidden="true" />
            New
            <span className="publish-diff-count">{plan.new_items.length}</span>
          </h4>
          <ul className="publish-diff-list" aria-label="New notes to publish">
            {plan.new_items.map((c) => (
              <CandidateRow
                key={c.rel_path}
                candidate={c}
                checked={selectedPaths.has(c.rel_path)}
                onChange={handleItemToggle}
                icon={<FilePlus size={14} />}
                rowClass="publish-diff-new"
              />
            ))}
          </ul>
        </div>
      )}

      {/* Changed items */}
      {plan.changed.length > 0 && (
        <div className="publish-diff-bucket">
          <h4 className="publish-diff-bucket-heading">
            <FilePen size={14} aria-hidden="true" />
            Changed
            <span className="publish-diff-count">{plan.changed.length}</span>
          </h4>
          <ul className="publish-diff-list" aria-label="Changed notes to publish">
            {plan.changed.map((c) => (
              <CandidateRow
                key={c.rel_path}
                candidate={c}
                checked={selectedPaths.has(c.rel_path)}
                onChange={handleItemToggle}
                icon={<FilePen size={14} />}
                rowClass="publish-diff-changed"
              />
            ))}
          </ul>
        </div>
      )}

      {/* Orphaned items — deletion requires explicit per-item opt-in */}
      {plan.orphaned.length > 0 && (
        <div className="publish-diff-bucket">
          <h4 className="publish-diff-bucket-heading publish-diff-bucket-heading-orphan">
            <FileX size={14} aria-hidden="true" />
            Orphaned
            <span className="publish-diff-count">{plan.orphaned.length}</span>
          </h4>
          <p className="publish-diff-orphan-notice">
            These files are in the site output but no longer in the vault.
            Check the ones you want to <strong>permanently delete</strong>.
          </p>
          <ul className="publish-diff-list" aria-label="Orphaned files (optional deletion)">
            {plan.orphaned.map((path) => (
              <OrphanRow
                key={path}
                path={path}
                checked={deleteOrphans.has(path)}
                onChange={handleOrphanToggle}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Unchanged — collapsed summary only */}
      {plan.unchanged.length > 0 && (
        <details className="publish-diff-unchanged">
          <summary className="publish-diff-unchanged-summary">
            <Eye size={13} aria-hidden="true" />
            {plan.unchanged.length} unchanged (no action)
          </summary>
          <ul className="publish-diff-list publish-diff-list-muted" aria-label="Unchanged notes">
            {plan.unchanged.map((c) => (
              <li key={c.rel_path} className="publish-diff-row publish-diff-unchanged-row">
                <span className="publish-diff-icon" aria-hidden="true">
                  <Circle size={13} />
                </span>
                <span className="publish-diff-path">
                  <span className="publish-diff-dir">{dirPart(c.rel_path)}</span>
                  <span className="publish-diff-name">{basename(c.rel_path)}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Action bar */}
      <div className="publish-diff-actions">
        <button
          type="button"
          className="toolbar-button"
          onClick={onReplan}
          disabled={applying}
        >
          Re-scan
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={handleApply}
          disabled={applying || !hasAnything || isClean}
          aria-busy={applying}
        >
          {applying ? 'Applying…' : `Apply (${selectedPaths.size + deleteOrphans.size})`}
        </button>
      </div>
    </section>
  )
}

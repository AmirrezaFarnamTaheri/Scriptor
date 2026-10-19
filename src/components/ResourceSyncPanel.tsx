import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  CopyCheck,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'

import {
  resourceApplyPlan,
  resourceCreateDedupPlan,
  resourceCreatePlan,
  resourceInventory,
  type ResourceApplyResult,
  type ResourceInstance,
  type ResourceInventory,
  type ResourceSyncPlan,
  type ResourceTarget,
} from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'
import '../styles/components/resource-sync.css'

function targetStatusLabel(status: ResourceTarget['status']): string {
  switch (status) {
    case 'confirmed': return 'Installed'
    case 'configured': return 'Found in settings'
    case 'partial': return 'Partly installed'
    case 'available': return 'Available'
    case 'conflicted': return 'Needs attention'
  }
}

function targetCanReceiveResources(target: ResourceTarget): boolean {
  if (target.supportLevel === 'inventory_only' || target.resourceRoots.length === 0) return false
  return target.id === 'universal' || target.status === 'confirmed'
}

function changeLabel(kind: ResourceSyncPlan['operations'][number]['kind']): string {
  switch (kind) {
    case 'install': return 'Add copy'
    case 'update': return 'Update copy'
    case 'noop': return 'Already up to date'
    case 'quarantine_duplicate': return 'Move extra copy aside'
  }
}

function shortHash(value: string): string {
  return value.slice(0, 10)
}

function describeEvidence(target: ResourceTarget): string[] {
  return target.evidence.map((evidence) => {
    if (evidence.kind === 'executable') {
      return `${evidence.version ?? 'Executable confirmed'} at ${evidence.path}`
    }
    if (evidence.kind === 'application') {
      return `Application identity ${evidence.identity} at ${evidence.path}`
    }
    if (evidence.kind === 'extension') {
      return `${evidence.extensionId}${evidence.version ? ` ${evidence.version}` : ''} in ${evidence.host}`
    }
    if (evidence.kind === 'config_root') {
      return evidence.exists
        ? `${evidence.resourceCount} resource(s) in ${evidence.path}`
        : `No configuration at ${evidence.path}`
    }
    return evidence.message
  })
}

export function ResourceSyncPanel() {
  const nativeAvailable = isNativeBridgeAvailable()
  const [inventory, setInventory] = useState<ResourceInventory | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState('')
  const [selectedTargetIds, setSelectedTargetIds] = useState<Set<string>>(new Set())
  const [plan, setPlan] = useState<ResourceSyncPlan | null>(null)
  const [applyResult, setApplyResult] = useState<ResourceApplyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!nativeAvailable) return
    setLoading(true)
    setError(null)
    setPlan(null)
    setApplyResult(null)
    try {
      const next = await resourceInventory()
      setInventory(next)
      setSelectedSourceId((current) => {
        if (next.resources.some((resource) => resource.id === current && resource.kind === 'skill' && resource.valid)) {
          return current
        }
        return next.resources.find((resource) => resource.managed && resource.kind === 'skill' && resource.valid)?.id
          ?? next.resources.find((resource) => resource.kind === 'skill' && resource.valid)?.id
          ?? ''
      })
      setSelectedTargetIds((current) => {
        const valid = new Set(
          next.targets
            .filter(targetCanReceiveResources)
            .map((target) => target.id),
        )
        const preserved = new Set([...current].filter((targetId) => valid.has(targetId)))
        return preserved
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not check connected apps and files.')
      setInventory(null)
    } finally {
      setLoading(false)
    }
  }, [nativeAvailable])

  useEffect(() => {
    if (!nativeAvailable) return undefined

    const frame = window.requestAnimationFrame(() => {
      void refresh()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [nativeAvailable, refresh])

  const source = useMemo<ResourceInstance | null>(
    () => inventory?.resources.find((resource) => resource.id === selectedSourceId) ?? null,
    [inventory, selectedSourceId],
  )

  const buildPlan = async () => {
    if (!source || selectedTargetIds.size === 0) return
    setPlanning(true)
    setError(null)
    setPlan(null)
    setApplyResult(null)
    try {
      setPlan(await resourceCreatePlan(source.id, [...selectedTargetIds]))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not preview these changes. Try again.')
    } finally {
      setPlanning(false)
    }
  }


  const buildDedupPlan = async (canonicalInstanceId: string) => {
    setPlanning(true)
    setError(null)
    setPlan(null)
    setApplyResult(null)
    try {
      setPlan(await resourceCreateDedupPlan(canonicalInstanceId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not prepare the duplicate cleanup. Try again.')
    } finally {
      setPlanning(false)
    }
  }

  const applyPlan = async () => {
    if (!plan) return
    setApplying(true)
    setError(null)
    setApplyResult(null)
    try {
      const result = await resourceApplyPlan(plan.id, 3)
      if (result.receipts.length > 0) {
        await refresh()
      }
      setApplyResult(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sync could not finish. Check which changes completed.')
    } finally {
      setApplying(false)
    }
  }

  // Batch selection only edits the draft; applying still needs a native
  // preview and an explicit approved apply action.
  const selectTargets = (selectAll: boolean) => {
    setPlan(null)
    setApplyResult(null)
    setSelectedTargetIds(new Set(
      selectAll ? inventory?.targets.filter(targetCanReceiveResources).map((target) => target.id) ?? [] : [],
    ))
  }

  const toggleTarget = (targetId: string) => {
    setPlan(null)
    setApplyResult(null)
    setSelectedTargetIds((current) => {
      const next = new Set(current)
      if (next.has(targetId)) next.delete(targetId)
      else next.add(targetId)
      return next
    })
  }

  if (!nativeAvailable) {
    return (
      <section className="resource-sync-empty" aria-label="Sharing and sync">
        <Boxes size={30} aria-hidden="true" />
        <h3>Sharing and sync requires the desktop app</h3>
        <p>
          Open Scriptor for desktop to check installed apps and share files. This browser preview cannot access files on your computer.
        </p>
      </section>
    )
  }

  const eligibleTargets = inventory?.targets.filter(targetCanReceiveResources).length ?? 0
  const confirmedTargets = inventory?.targets.filter((target) => target.status === 'confirmed').length ?? 0
  const managedResources = inventory?.resources.filter((resource) => resource.managed).length ?? 0
  const redundantDuplicates = inventory?.duplicates.filter((group) => group.kind === 'redundant').length ?? 0

  return (
    <section className="resource-sync-panel" data-help-topic="resource-sync" aria-label="Sharing and sync">
      <header className="resource-sync-heading">
        <div>
          <p className="resource-sync-eyebrow">Installed tools and shared files</p>
          <h3>Sharing and sync</h3>
          <p>
            See what's installed and where. Compare copies and review changes before syncing.
          </p>
        </div>
        <button type="button" className="toolbar-button" onClick={() => void refresh()} disabled={loading || planning || applying}>
          {loading ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}
          Rescan
        </button>
      </header>

      {error ? (
        <div className="resource-sync-message error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="resource-sync-stats" aria-label="Resource inventory summary">
        <div><strong>{confirmedTargets}</strong><span>apps found</span></div>
        <div><strong>{inventory?.resources.length ?? 0}</strong><span>items found</span></div>
      </div>
      <details className="resource-sync-inventory-details">
        <summary>More inventory details</summary>
        <p>{managedResources} managed items · {redundantDuplicates} extra copy groups</p>
      </details>

      {loading && !inventory ? (
        <div className="resource-sync-loading" role="status">
          <LoaderCircle className="spin" size={20} />
          Checking installed apps and shared files…
        </div>
      ) : null}

      {inventory ? (
        <>
          <section className="resource-sync-section">
            <div className="resource-sync-section-heading">
              <div>
                <h4>Applications, IDEs, and CLIs</h4>
                <p>Verified apps were found on this device. Entries found only in settings are marked separately.</p>
              </div>
            </div>
            <div className="resource-target-selection" role="group" aria-label="Sync destinations">
              <span role="status">{selectedTargetIds.size} of {eligibleTargets} compatible apps selected</span>
              <button type="button" className="toolbar-button"
                disabled={eligibleTargets === 0 || loading || planning || applying}
                onClick={() => selectTargets(true)}
              >Select compatible apps</button>
              <button type="button" className="toolbar-button"
                disabled={selectedTargetIds.size === 0 || loading || planning || applying}
                onClick={() => selectTargets(false)}
              >Clear selection</button>
            </div>
            <div className="resource-target-grid">
              {inventory.targets.map((target) => {
                const canReceive = targetCanReceiveResources(target)
                const selected = selectedTargetIds.has(target.id)
                return (
                  <article className="resource-target-card" key={target.id}>
                    <div className="resource-target-title">
                      <div>
                        <strong>{target.label}</strong>
                        <span className={`resource-badge ${target.status}`}>{targetStatusLabel(target.status)}</span>
                      </div>
                      <label>
                        <input
                          type="checkbox"
                          aria-label={`Sync ${target.label}`}
                          checked={selected}
                          disabled={!canReceive || loading || planning || applying}
                          onChange={() => toggleTarget(target.id)}
                        />
                        <span aria-hidden="true">Sync</span>
                      </label>
                    </div>
                    <p className="resource-target-support">
                      <span>{target.installations.length} installation{target.installations.length === 1 ? '' : 's'}</span>
                      {target.supportLevel === 'native'
                        ? 'Can receive shared files'
                        : target.supportLevel === 'compatible'
                          ? 'Can receive shared files (compatible)'
                          : 'View only — cannot sync'}
                    </p>
                    <details>
                      <summary>Detection evidence</summary>
                      <ul>
                        {describeEvidence(target).map((line, index) => <li key={`${target.id}-${index}`}>{line}</li>)}
                      </ul>
                    </details>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="resource-sync-section">
            <div className="resource-sync-section-heading">
              <div>
                <h4>Found on this device</h4>
                <p>Choose the copy you want to share. Nothing is changed until you approve.</p>
              </div>
            </div>
            {inventory.resources.length === 0 ? (
              <p className="resource-sync-empty-row">No shared items found in the locations Scriptor checks.</p>
            ) : (
              <div className="resource-table-wrap">
                <table className="resource-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>App</th>
                      <th>Status</th>
                      <th>Share this copy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.resources.map((resource) => (
                      <tr key={resource.id}>
                        <td>
                          <strong>{resource.name}</strong>
                          <span>{resource.logicalId}</span>
                        </td>
                        <td>
                          <span>{inventory.targets.find(target => target.id === resource.targetId)?.label ?? resource.targetId}</span>
                          <small>{resource.scope}</small>
                        </td>
                        <td>
                          <span className={`resource-badge ${resource.managed ? 'managed' : 'unmanaged'}`}>
                            {resource.managed ? 'Managed by Scriptor' : 'Found locally'}
                          </span>
                          <span className={`resource-badge ${resource.valid ? 'valid' : 'invalid'}`}>
                            {resource.valid ? 'Ready' : 'Needs attention'}
                          </span>
                          {resource.symlinked ? <small>Linked from another location</small> : null}
                          {resource.issues.map((issue) => <small key={issue}>{issue}</small>)}
                          <details className="resource-copy-details">
                            <summary>Content details</summary>
                            <dl>
                              <dt>Content check</dt><dd><code>{shortHash(resource.contentHash)}</code></dd>
                              <dt>File path</dt><dd><code>{resource.path}</code></dd>
                            </dl>
                          </details>
                        </td>
                        <td>
                          <input
                            type="radio"
                            name="resource-sync-source"
                            aria-label={`Use ${resource.name} from ${resource.targetId} as source`}
                            checked={selectedSourceId === resource.id}
                            disabled={resource.kind !== 'skill' || !resource.valid || loading || planning || applying}
                            onChange={() => {
                              setSelectedSourceId(resource.id)
                              setPlan(null)
                              setApplyResult(null)
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {inventory.duplicates.length > 0 ? (
          <section className="resource-sync-section">
            <div className="resource-sync-section-heading">
              <div>
                <h4>Compare duplicates</h4>
                <p>Compare identical and changed copies. Nothing is deleted automatically.</p>
              </div>
            </div>
            {inventory.duplicates.length === 0 ? (
              <p className="resource-sync-empty-row">No duplicate copies found.</p>
            ) : (
              <ul className="resource-duplicate-list">
                {inventory.duplicates.map((group) => {
                  const canonicalId = group.instanceIds[0]
                  const description = group.kind === 'exact_mirror'
                    ? 'These copies match across apps. Keep each one if the app needs it.'
                    : group.kind === 'redundant'
                      ? 'This app has two identical copies.'
                      : 'Copies with the same name contain different text. Compare them before replacing either.'
                  return (
                    <li key={`${group.logicalId}-${group.kind}-${group.instanceIds.join('-')}`}>
                      {group.kind === 'diverged' ? <AlertTriangle size={16} /> : <CopyCheck size={16} />}
                      <div>
                        <strong>{group.logicalId}</strong>
                        <span>{description}</span>
                        <small>{group.targetIds.join(' · ')}</small>
                      </div>
                      {group.kind === 'redundant' && canonicalId ? (
                        <button
                          type="button"
                          className="toolbar-button"
                          disabled={planning || applying}
                          onClick={() => void buildDedupPlan(canonicalId)}
                        >
                          Review extra copies
                        </button>
                      ) : (
                        <span className="resource-badge protected">
                          {group.kind === 'exact_mirror' ? 'same content' : 'copies differ'}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
          ) : null}

          <section className="resource-sync-section resource-plan-builder">
            <div>
              <h4>Review changes before syncing</h4>
              <p>
                If a source or destination changes after review, syncing stops until you review again.
              </p>
            </div>
            <button
              type="button"
              className="primary-button"
              disabled={!source || !source.valid || selectedTargetIds.size === 0 || planning || applying}
              onClick={() => void buildPlan()}
            >
              {planning ? <LoaderCircle className="spin" size={15} /> : <ShieldCheck size={15} />}
              Preview changes
            </button>
          </section>

          {plan ? (
            <section className="resource-sync-section resource-plan" aria-label="Synchronization plan">
              <p className="resource-plan-expiry">Review before <time>{new Date(plan.expiresAtMs).toLocaleTimeString()}</time>.</p>
              <details className="resource-plan-technical">
                <summary>Technical details</summary>
                <div className="resource-plan-meta">
                  <div><span>Plan ID</span><code>{plan.id}</code></div>
                  <div><span>Inventory check</span><code>{shortHash(plan.inventoryFingerprint)}</code></div>
                  <div><span>Plan check</span><code>{shortHash(plan.planFingerprint)}</code></div>
                </div>
              </details>
              <ol>
                {plan.operations.map((operation) => (
                  <li key={operation.id}>
                    <span className={`resource-badge ${operation.kind}`}>{changeLabel(operation.kind)}</span>
                    <div>
                      <strong>{operation.summary}</strong>
                      <small>{operation.destinationPath}</small>
                    </div>
                  </li>
                ))}
              </ol>
              {plan.warnings.length > 0 ? (
                <ul className="resource-plan-warnings">
                  {plan.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}
                </ul>
              ) : null}
              <button type="button" className="primary-button" disabled={applying} onClick={() => void applyPlan()}>
                {applying ? <LoaderCircle className="spin" size={15} /> : <CheckCircle2 size={15} />}
                Apply these changes
              </button>
            </section>
          ) : null}

          {applyResult ? (
            <section className={`resource-sync-message ${applyResult.status}`} role="status">
              <CheckCircle2 size={17} aria-hidden="true" />
              <div>
                <strong>{applyResult.status === 'completed' ? 'Sync finished' : applyResult.status === 'partial' ? 'Sync partly finished' : 'Sync could not finish'}</strong>
                <span>{applyResult.receipts.length} steps confirmed · {applyResult.failures.length} failed</span>
                {applyResult.failures.map((failure) => (
                  <small key={failure.operationId}>{failure.targetId}: {failure.message}</small>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

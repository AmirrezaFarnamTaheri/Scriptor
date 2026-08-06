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

function targetCanReceiveResources(target: ResourceTarget): boolean {
  if (target.supportLevel === 'inventory_only' || target.resourceRoots.length === 0) return false
  return target.id === 'universal' || target.status === 'confirmed'
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
        return preserved.size > 0 ? preserved : valid
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not inventory agent resources')
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
      setError(cause instanceof Error ? cause.message : 'Could not create a reviewed sync plan')
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
      setError(cause instanceof Error ? cause.message : 'Could not create a reviewed deduplication plan')
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
      setError(cause instanceof Error ? cause.message : 'Could not apply the approved sync plan')
    } finally {
      setApplying(false)
    }
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
          Browser preview cannot inspect local applications or modify agent resources. Open the unified Scriptor desktop app to continue.
        </p>
      </section>
    )
  }

  const confirmedTargets = inventory?.targets.filter((target) => target.status === 'confirmed').length ?? 0
  const managedResources = inventory?.resources.filter((resource) => resource.managed).length ?? 0
  const redundantDuplicates = inventory?.duplicates.filter((group) => group.kind === 'redundant').length ?? 0

  return (
    <section className="resource-sync-panel" aria-label="Sharing and sync">
      <header className="resource-sync-heading">
        <div>
          <p className="resource-sync-eyebrow">AgentStack-managed resources</p>
          <h3>Sharing and sync</h3>
          <p>
            Inventory what is contained and installed, compare canonical identities, and review every connection or synchronization change before it runs.
          </p>
        </div>
        <button type="button" className="toolbar-button" onClick={() => void refresh()} disabled={loading}>
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
        <div><strong>{confirmedTargets}</strong><span>confirmed apps and CLIs</span></div>
        <div><strong>{inventory?.resources.length ?? 0}</strong><span>installed resources</span></div>
        <div><strong>{managedResources}</strong><span>AgentStack-managed</span></div>
        <div><strong>{redundantDuplicates}</strong><span>redundant duplicate groups</span></div>
      </div>

      {loading && !inventory ? (
        <div className="resource-sync-loading" role="status">
          <LoaderCircle className="spin" size={20} />
          Identifying executables, configuration roots, scopes, and resource fingerprints…
        </div>
      ) : null}

      {inventory ? (
        <>
          <section className="resource-sync-section">
            <div className="resource-sync-section-heading">
              <div>
                <h4>Applications, IDEs, and CLIs</h4>
                <p>“Confirmed” requires executable, application, or installed-extension identity. Configuration-only evidence remains explicitly labeled.</p>
              </div>
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
                        <span className={`resource-badge ${target.status}`}>{target.status}</span>
                      </div>
                      <label title={canReceive ? 'Include in the next reviewed plan' : 'This target is inventory-only or not confirmed'}>
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={!canReceive}
                          onChange={() => toggleTarget(target.id)}
                        />
                        Sync
                      </label>
                    </div>
                    <p className="resource-target-support">
                      <span>{target.installations.length} confirmed installation{target.installations.length === 1 ? '' : 's'}</span>
                      {target.supportLevel === 'native'
                        ? 'Native resource target'
                        : target.supportLevel === 'compatible'
                          ? 'Reviewed compatibility adapter'
                          : 'Inventory only'}
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
                <h4>Already installed or contained</h4>
                <p>Each physical instance keeps its target, scope, path, ownership, and normalized content hash.</p>
              </div>
            </div>
            {inventory.resources.length === 0 ? (
              <p className="resource-sync-empty-row">No validated skills were found in the known resource roots.</p>
            ) : (
              <div className="resource-table-wrap">
                <table className="resource-table">
                  <thead>
                    <tr>
                      <th>Canonical resource</th>
                      <th>Target</th>
                      <th>State</th>
                      <th>Fingerprint</th>
                      <th>Select source</th>
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
                          <span>{resource.targetId}</span>
                          <small>{resource.scope}</small>
                        </td>
                        <td>
                          <span className={`resource-badge ${resource.managed ? 'managed' : 'unmanaged'}`}>
                            {resource.managed ? 'managed' : 'unmanaged'}
                          </span>
                          <span className={`resource-badge ${resource.valid ? 'valid' : 'invalid'}`}>
                            {resource.valid ? 'valid' : 'invalid'}
                          </span>
                          {resource.symlinked ? <small>linked</small> : <small>contained copy</small>}
                          {resource.issues.map((issue) => <small key={issue}>{issue}</small>)}
                        </td>
                        <td><code>{shortHash(resource.contentHash)}</code></td>
                        <td>
                          <input
                            type="radio"
                            name="resource-sync-source"
                            aria-label={`Use ${resource.name} from ${resource.targetId} as source`}
                            checked={selectedSourceId === resource.id}
                            disabled={resource.kind !== 'skill' || !resource.valid}
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

          <section className="resource-sync-section">
            <div className="resource-sync-section-heading">
              <div>
                <h4>Duplicate analysis</h4>
                <p>Exact and diverged resources are separated. Nothing is deleted automatically.</p>
              </div>
            </div>
            {inventory.duplicates.length === 0 ? (
              <p className="resource-sync-empty-row">No duplicate logical identities were found.</p>
            ) : (
              <ul className="resource-duplicate-list">
                {inventory.duplicates.map((group) => {
                  const canonicalId = group.instanceIds[0]
                  const description = group.kind === 'exact_mirror'
                    ? 'Verified mirror across targets; keep it installed where each target needs it'
                    : group.kind === 'redundant'
                      ? 'Redundant exact copy inside the same target and scope'
                      : 'Same logical identity with divergent content; manual merge required'
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
                          Review dedup plan
                        </button>
                      ) : (
                        <span className="resource-badge protected">
                          {group.kind === 'exact_mirror' ? 'synced mirror' : 'review required'}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="resource-sync-section resource-plan-builder">
            <div>
              <h4>Reviewed synchronization plan</h4>
              <p>
                Plans are bound to the current inventory fingerprint. If any source or destination changes, application stops and requires a new review.
              </p>
            </div>
            <button
              type="button"
              className="primary-button"
              disabled={!source || !source.valid || selectedTargetIds.size === 0 || planning || applying}
              onClick={() => void buildPlan()}
            >
              {planning ? <LoaderCircle className="spin" size={15} /> : <ShieldCheck size={15} />}
              Build reviewed plan
            </button>
          </section>

          {plan ? (
            <section className="resource-sync-section resource-plan" aria-label="Synchronization plan">
              <div className="resource-plan-meta">
                <div><span>Plan</span><code>{plan.id}</code></div>
                <div><span>Inventory</span><code>{shortHash(plan.inventoryFingerprint)}</code></div>
                <div><span>Plan fingerprint</span><code>{shortHash(plan.planFingerprint)}</code></div>
                <div><span>Expires</span><time>{new Date(plan.expiresAtMs).toLocaleTimeString()}</time></div>
              </div>
              <ol>
                {plan.operations.map((operation) => (
                  <li key={operation.id}>
                    <span className={`resource-badge ${operation.kind}`}>{operation.kind}</span>
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
                Approve and apply once
              </button>
            </section>
          ) : null}

          {applyResult ? (
            <section className={`resource-sync-message ${applyResult.status}`} role="status">
              <CheckCircle2 size={17} aria-hidden="true" />
              <div>
                <strong>Plan {applyResult.status}</strong>
                <span>{applyResult.receipts.length} operation(s) verified; {applyResult.failures.length} failure(s).</span>
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

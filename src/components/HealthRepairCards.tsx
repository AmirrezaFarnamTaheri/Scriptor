import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { healthRepairApply, healthRepairPlan, healthRepairReceipts, healthRepairRestore } from '../bridge/commands/health_repair'
import { missingNoteSuggestion, type HealthRepairPlan, type HealthRepairReceipt, type HealthRepairRequest } from '../lib/healthRepair'
import type { HealthIssue } from '../types/vault'
import { isNativeBridgeAvailable } from '../bridge/platform'
import '../styles/components/health-repair-cards.css'

interface Props {
  expectedVaultId: string
  issues: HealthIssue[]
  onRepairsApplied?: () => Promise<void> | void
  runSourceNoteMutation?: (path: string, action: () => Promise<void>) => Promise<boolean>
}
const descriptions = {
  create_note: 'Create a missing Markdown note without replacing an existing file.',
  normalize_tags: 'Lowercase tags in one note while preserving code and URL fragments.',
  prune_asset: 'Move an unreferenced asset into verified recovery storage after a complete reference scan.',
}
const labels = { create_note: 'Create missing note', normalize_tags: 'Normalize tag case', prune_asset: 'Recoverably prune asset' }

export function HealthRepairCards({ expectedVaultId, issues, onRepairsApplied, runSourceNoteMutation }: Props) {
  const [kind, setKind] = useState<HealthRepairRequest['kind']>('create_note')
  const [path, setPath] = useState('')
  const [plan, setPlan] = useState<HealthRepairPlan | null>(null)
  const [receipts, setReceipts] = useState<HealthRepairReceipt[]>([])
  const [restore, setRestore] = useState<HealthRepairReceipt | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const generation = useRef(0)
  const vault = useRef(expectedVaultId)
  useLayoutEffect(() => { vault.current = expectedVaultId }, [expectedVaultId])
  const native = isNativeBridgeAvailable()
  useEffect(() => {
    const token = ++generation.current
    let mounted = true
    queueMicrotask(() => { if (mounted) { setPlan(null); setRestore(null); setReceipts([]); setPath(''); setConfirmed(false); setBusy(false); setError(''); setMessage('') } })
    if (native) void healthRepairReceipts(expectedVaultId).then(rows => { if (mounted && token === generation.current && vault.current === expectedVaultId) setReceipts(rows) }).catch(reason => { if (mounted && token === generation.current) setError(String(reason)) })
    return () => { mounted = false; generation.current += 1 }
  }, [expectedVaultId, native])

  function resetReview() { generation.current += 1; setPlan(null); setRestore(null); setConfirmed(false); setMessage(''); setError('') }
  async function run(action: () => Promise<void>) {
    const token = ++generation.current, origin = expectedVaultId
    setBusy(true); setError(''); setMessage('')
    try { await action() } catch (reason) { if (token === generation.current && vault.current === origin) setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { if (token === generation.current && vault.current === origin) setBusy(false) }
  }
  async function review() {
    const request = { kind, path: path.trim() }, origin = expectedVaultId
    await run(async () => {
      const token = generation.current
      const result = await healthRepairPlan(origin, request)
      if (token === generation.current && vault.current === origin) { setPlan(result); setConfirmed(false); setRestore(null) }
    })
  }
  async function apply() {
    if (!plan || !confirmed) return
    const reviewed = plan, origin = expectedVaultId
    await run(async () => {
      const token = generation.current
      const outcome: { receipt?: HealthRepairReceipt } = {}
      const action = async () => { outcome.receipt = await healthRepairApply(reviewed) }
      const didMutate = runSourceNoteMutation && reviewed.request.kind !== 'prune_asset'
        ? await runSourceNoteMutation(reviewed.request.path, action) : (await action(), true)
      if (token !== generation.current || vault.current !== origin) return
      if (!didMutate) { setConfirmed(false); setMessage('Repair was not applied. Finish saving the note, then review the plan again.'); return }
      const receipt = outcome.receipt
      if (!receipt) throw new Error('Repair completed without a recovery receipt. Reload recovery history before continuing.')
      setReceipts(rows => [receipt, ...rows.filter(row => row.id !== receipt.id)]); setPlan(null); setConfirmed(false); setMessage('Repair applied. A verified recovery copy is available below.')
      await onRepairsApplied?.()
    })
  }
  async function restoreFile() {
    if (!restore || !confirmed) return
    const reviewed = restore, origin = expectedVaultId
    await run(async () => {
      const token = generation.current
      const action = () => healthRepairRestore(reviewed)
      const didMutate = runSourceNoteMutation && reviewed.path.endsWith('.md')
        ? await runSourceNoteMutation(reviewed.path, action) : (await action(), true)
      if (token !== generation.current || vault.current !== origin) return
      if (!didMutate) { setConfirmed(false); setMessage('Restoration was not applied. Finish saving the note, then review restoration again.'); return }
      setRestore(null); setConfirmed(false); setMessage('Original content restored. The recovery copy remains available; later edits are protected.')
      await onRepairsApplied?.()
    })
  }
  async function reloadRecovery() {
    const origin = expectedVaultId
    await run(async () => {
      const token = generation.current
      const rows = await healthRepairReceipts(origin)
      if (token === generation.current && vault.current === origin) setReceipts(rows)
    })
  }
  const suggestions = [...new Set(issues.flatMap(issue => kind === 'create_note' ? [missingNoteSuggestion(issue.detail)].filter((value): value is string => value !== null) : kind === 'prune_asset' && issue.kind === 'orphan_asset' ? [issue.path] : kind === 'normalize_tags' && issue.path.endsWith('.md') ? [issue.path] : []))].slice(0, 20)
  return <section className="health-repair-cards" aria-label="Reviewed vault repairs">
    <h3>Reviewed vault repairs</h3>
    {!native ? <p>Open the desktop application to review and apply repairs.</p> : null}
    <div className="health-repair-kind-row">{Object.entries(labels).map(([value, label]) => <button type="button" key={value} className="toolbar-button" aria-pressed={kind === value} disabled={busy} onClick={() => { resetReview(); setKind(value as HealthRepairRequest['kind']); setPath('') }}>{label}</button>)}</div>
    <p>{descriptions[kind]}</p>
    <label>Vault-relative {kind === 'prune_asset' ? 'asset' : 'note'} path<input value={path} disabled={busy || !native} placeholder={kind === 'prune_asset' ? 'assets/image.png' : 'Research/New note.md'} onChange={event => { resetReview(); setPath(event.target.value) }} /></label>
    {suggestions.length ? <div className="health-repair-suggestions" aria-label="Paths from current diagnostics">{suggestions.map(value => <button type="button" className="toolbar-button" key={value} disabled={busy || !native} onClick={() => { resetReview(); setPath(value) }}>{value}</button>)}</div> : null}
    <button type="button" className="toolbar-button" disabled={!native || busy || !path.trim()} onClick={() => void review()}>{busy ? 'Working…' : 'Review repair plan'}</button>
    {plan ? <section className="health-repair-preview" aria-label="Repair plan">
      <strong>{labels[plan.request.kind]}: {plan.request.path}</strong>
      <p>{plan.request.kind === 'prune_asset' ? `${plan.changes[0].bytes.toLocaleString()} bytes will be removed from the working vault and retained in recovery. ${plan.scan?.notes ?? 0} notes were included in the complete reference scan.` : 'Review the exact content before applying. Changed sources require a new plan.'}</p>
      {plan.request.kind !== 'prune_asset' ? <div className="health-repair-diff"><label>Before<pre>{plan.changes[0].before || '(Missing note)'}</pre></label><label>After<pre>{plan.changes[0].after}</pre></label></div> : null}
      <details><summary>Source verification</summary><code>{plan.fingerprint}</code></details>
      <label className="health-repair-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />I reviewed this repair and its recovery consequences.</label>
      <button type="button" className="toolbar-button" disabled={busy || !confirmed} onClick={() => void apply()}>Apply reviewed repair</button>
      <button type="button" className="toolbar-button" disabled={busy} onClick={resetReview}>Cancel plan</button>
    </section> : null}
    {error ? <p role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
    <details className="health-repair-recovery"><summary>Recovery copies ({receipts.length})</summary>
      <button type="button" className="toolbar-button" disabled={busy || !native} onClick={() => void reloadRecovery()}>Reload recovery history</button>
      <p>Restoration verifies the stored content and protects any file changed since the repair. Recovery copies are retained.</p>
      {!receipts.length ? <p>No repair recovery copies yet.</p> : <ul>{receipts.map(receipt => <li key={receipt.id}><span>{receipt.path} · {receipt.bytes.toLocaleString()} bytes</span><button type="button" className="toolbar-button" disabled={busy} onClick={() => { resetReview(); setRestore(receipt) }}>Review restoration</button></li>)}</ul>}
      {restore ? <section aria-label="Review restoration"><strong>Restore original content: {restore.path}</strong><p>For a newly created note, restoring removes that note only if its content is unchanged. Pruned assets are restored only into a missing destination.</p><label className="health-repair-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />I reviewed this restoration.</label><button type="button" className="toolbar-button" disabled={busy || !confirmed} onClick={() => void restoreFile()}>Restore reviewed content</button><button type="button" className="toolbar-button" disabled={busy} onClick={resetReview}>Cancel restoration</button></section> : null}
    </details>
  </section>
}

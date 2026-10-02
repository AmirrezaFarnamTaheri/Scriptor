import { useEffect, useMemo, useRef, useState } from 'react'
import { MarkdownPreview } from '@scriptor/renderer'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import { PublishDiffView } from './PublishDiffView'
import { vaultFrontmatterSet, vaultListViewNotes, vaultPublishApplyStarlight, vaultPublishPlanStarlight, vaultReadNote } from '../bridge/commands/vault'
import { publishingCancelJob, publishingConfigureDomain, publishingRunJob } from '../bridge/commands/publishing'
import { publicationRows, redactPublishingLog, validateDeploymentTarget } from '../lib/publishingStudio'
import type { NoteDocument, StarlightPublishPlanOutput, ViewNoteHit } from '../types/vault'
import '../styles/components/publishing-studio.css'

export interface PublishingStudioPanelProps { vaultId: string; onClose(): void; onOpenNote(path: string): void; runSourceNoteMutation(sourcePath: string, runMutation: () => Promise<void>): Promise<boolean> }
export function PublishingStudioPanel({ vaultId, onClose, onOpenNote, runSourceNoteMutation }: PublishingStudioPanelProps) {
  const [notes, setNotes] = useState<ViewNoteHit[]>([])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [output, setOutput] = useState('')
  const [review, setReview] = useState<{ requested: string; site: StarlightPublishPlanOutput } | null>(null)
  const [preview, setPreview] = useState<NoteDocument | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [logs, setLogs] = useState('')
  const [accountId, setAccountId] = useState('')
  const [project, setProject] = useState('')
  const [domain, setDomain] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [runningJob, setRunningJob] = useState<string | null>(null)
  const currentJob = useRef<string | null>(null)
  const occupied = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    let active = true
    void vaultListViewNotes('{}').then(rows => { if (active) setNotes(rows) }).catch(reason => { if (active) setError(String(reason)) })
    return () => { active = false; mounted.current = false; if (currentJob.current) void publishingCancelJob(currentJob.current, vaultId).catch(() => undefined) }
  }, [vaultId])
  const site = review?.requested === output.trim() ? review.site : null
  const rows = useMemo(() => site ? publicationRows(notes, site.plan) : [], [notes, site])
  const filtered = rows.filter(note => `${note.path} ${note.title}`.toLowerCase().includes(query.toLowerCase()))
  const visible = filtered.slice(page * 50, (page + 1) * 50)
  async function action(work: () => Promise<void>) {
    if (occupied.current) return
    occupied.current = true; setBusy(true); setError(''); setStatus('')
    try { await work() }
    catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { occupied.current = false; if (mounted.current) setBusy(false) }
  }
  async function replan() {
    const requested = output.trim()
    if (!requested) throw new Error('Choose a local site folder')
    const next = await vaultPublishPlanStarlight(requested)
    if (mounted.current) setReview({ requested, site: next })
  }
  async function read(path: string) {
    const document = await vaultReadNote(path)
    if (document.metadata.vault_id !== vaultId) throw new Error('Vault changed; reopen Publishing Studio')
    return document
  }
  async function toggle(path: string, publish: boolean, plannedHash: string | null) {
    const changed = await runSourceNoteMutation(path, async () => {
      const document = await read(path)
      await vaultFrontmatterSet(path, 'publish', publish ? 'true' : 'false', plannedHash ?? document.metadata.content_hash, vaultId)
    })
    if (!changed) throw new Error('The editor could not save its changes. Save the note, refresh the publication plan, and try again.')
    const saved = await read(path)
    if (mounted.current) setPreview(saved)
    await replan()
    if (mounted.current) setStatus(publish ? 'Publication field updated. Review eligibility and any policy exclusions in the refreshed plan.' : 'Note excluded from the next publication plan. Review removal of any previously published copy.')
  }
  async function runJob(deploy: boolean) {
    if (!site) throw new Error('Review a current publication plan first')
    const target = deploy ? validateDeploymentTarget({ accountId, project, domain }) : undefined
    const id = crypto.randomUUID(); currentJob.current = id; setRunningJob(id)
    const secret = apiToken
    try {
      const result = await publishingRunJob(site.output, id, vaultId, target, secret)
      if (mounted.current) {
        setLogs(redactPublishingLog(`${result.stdout}\n${result.stderr}`, secret))
        setStatus(result.exitCode === 0 && !result.timedOut ? (deploy ? 'Deployment completed.' : 'Local build completed.') : `Action ended with exit code ${result.exitCode}${result.timedOut ? ' after its time limit' : ''}. Review the output.`)
        if (result.truncated) setStatus(previous => `${previous} Output reached its display limit.`)
      }
    } finally { currentJob.current = null; if (mounted.current) { setRunningJob(null); if (deploy) setApiToken('') } }
  }
  return <UnifiedPanelShell title="Publishing studio" ariaLabel="Publishing studio" helpTopic="export" onClose={onClose} wide className="publishing-studio">
    <p>Only notes explicitly opted in with an unambiguous <code>publish: true</code> field enter the local publication plan. Review writes and removals before generating the site.</p>
    <div className="research-controls">
      <label>Local site folder<input value={output} disabled={busy} maxLength={4096} placeholder="Absolute folder path" onChange={event => setOutput(event.target.value)} /></label>
      <button disabled={busy || !output.trim()} onClick={() => void action(replan)}>Review publication plan</button>
    </div>
    {site && <>
      <label>Find a note<input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} /></label>
      <table><caption>Plan eligibility and publication field actions for indexed notes. Eligibility also depends on publication filters; an excluded note may still have publish: true. Opt in and Opt out explicitly update that field.</caption><thead><tr><th>Note</th><th>Included in plan</th><th>Review</th></tr></thead><tbody>{visible.map(row => <tr key={row.path}>
        <td><bdi>{row.path}</bdi></td><td><p>{row.eligible ? 'Included in the current plan' : 'Excluded by the current plan'}</p><button aria-label={`Opt in ${row.path}`} disabled={busy} onClick={() => void action(() => toggle(row.path, true, row.contentHash))}>Opt in</button><button aria-label={`Opt out ${row.path}`} disabled={busy} onClick={() => void action(() => toggle(row.path, false, row.contentHash))}>Opt out</button></td>
        <td><button disabled={busy} onClick={() => void action(async () => { const document = await read(row.path); if (mounted.current) setPreview(document) })}>Preview</button><button onClick={() => onOpenNote(row.path)}>Open note</button></td>
      </tr>)}</tbody></table>
      <div className="research-controls"><button disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page + 1} · {filtered.length} indexed notes</span><button disabled={(page + 1) * 50 >= filtered.length} onClick={() => setPage(value => value + 1)}>Next</button></div>
      {preview && <details open><summary>Local note preview: <bdi>{preview.metadata.path}</bdi></summary><MarkdownPreview markdown={preview.markdown} /></details>}
      <PublishDiffView plan={site.plan} requireFrontmatterOptIn applying={busy} onReplan={() => void action(replan)} onApply={(paths, orphans) => void action(async () => {
        const candidates = [...site.plan.new_items, ...site.plan.changed, ...site.plan.unchanged].filter(candidate => paths.includes(candidate.rel_path))
        const result = await vaultPublishApplyStarlight(site.output, candidates, orphans)
        if (mounted.current) setStatus(`Local site updated: ${result.written.length} writes, ${result.deleted.length} reviewed removals.`)
        await replan()
      })} />
      <div className="research-controls"><button disabled={busy} onClick={() => void action(() => runJob(false))}>Build local site</button>{busy && runningJob && <button onClick={() => void publishingCancelJob(runningJob, vaultId).catch(reason => setError(String(reason)))}>Cancel build or deployment</button>}</div>
      <details><summary>Cloudflare Pages deployment and custom domain</summary>
        <p>Use an existing Pages project and installed Wrangler. The token stays in memory for this action. Domain attachment reports provider status; DNS remains a separate configuration step.</p>
        <div className="research-controls">
          <label>Account ID<input value={accountId} maxLength={32} disabled={busy} onChange={event => setAccountId(event.target.value.trim())} /></label>
          <label>Project name<input value={project} maxLength={63} disabled={busy} onChange={event => setProject(event.target.value.trim())} /></label>
          <label>Custom domain<input value={domain} maxLength={253} disabled={busy} onChange={event => setDomain(event.target.value.trim())} /></label>
          <label>API token<input type="password" value={apiToken} maxLength={512} disabled={busy} autoComplete="off" onChange={event => setApiToken(event.target.value)} /></label>
          <button disabled={busy || !apiToken} onClick={() => void action(() => runJob(true))}>Deploy reviewed build</button>
          <button disabled={busy || !apiToken || !domain} onClick={() => void action(async () => {
            const result = await publishingConfigureDomain({ accountId, project, domain }, apiToken, vaultId)
            if (mounted.current) { setStatus(`Domain ${result.domain}: ${result.status}. For a subdomain, configure its CNAME to ${result.cname_target}; an apex domain requires the provider's zone setup.`); setApiToken('') }
          })}>Attach custom domain</button>
        </div>
      </details>
    </>}
    {logs && <details open><summary>Bounded build or deployment output</summary><pre>{logs}</pre></details>}
    {error && <p role="alert">{error}</p>}{status && <p role="status">{status}</p>}
  </UnifiedPanelShell>
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { alignReviewedSource, sourceLineEndingStyle } from '../lib/reviewDiff'
import { overleafRead, overleafPush } from '../bridge/commands/overleaf'
import { sourceFileRead, sourceFileSave } from '../bridge/commands/source_files'
import { type SourceDocument } from '../lib/sourceFile'
import { type OverleafSnapshot, overleafProjectId, overleafFilePath } from '../lib/overleaf'
import { autoSyncPreferenceKey, readAutoSyncEnabled, writeAutoSyncEnabled, decideAutoSync } from '../lib/autoSyncPreference'
import { overleafBindingKey, readOverleafBinding, saveOverleafBinding, forgetOverleafBinding } from '../lib/overleafBinding'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import '../styles/components/overleaf.css'
export interface OverleafPanelProps { document: SourceDocument; onClose: () => void; onApplied: (document: SourceDocument) => void }
export function OverleafPanel({ document, onClose, onApplied }: OverleafPanelProps) {
  const bindingKey = useMemo(() => {
    try { return overleafBindingKey(document.vault_id, document.path) }
    catch { return null }
  }, [document.vault_id, document.path])
  const [linked] = useState(() => bindingKey ? readOverleafBinding(localStorage, bindingKey) : null)
  const [project, setProject] = useState(linked?.projectId ?? '')
  const [remotePath, setRemotePath] = useState(linked?.remotePath ?? document.path)
  const [snapshot, setSnapshot] = useState<OverleafSnapshot | null>(null); const [reviewed, setReviewed] = useState('')
  const [busy, setBusy] = useState(false); const [accepted, setAccepted] = useState(false)
  const [status, setStatus] = useState('Fetch a remote preview to compare it with the saved local source.'); const [error, setError] = useState<string | null>(null)
  const [previousShare, setPreviousShare] = useState<string | null>(null)
  const dialog = useRef<HTMLDivElement>(null); const generation = useRef(0); const pending = useRef(false)
  const baseline = useRef<{ key: string; content: string } | null>(null)
  const reviewEdited = useRef(false)
  const [autoChoice, setAutoChoice] = useState<{ key: string; enabled: boolean } | null>(null)
  const autoTarget = useMemo(() => {
    try {
      const projectId = overleafProjectId(project)
      overleafFilePath(remotePath)
      return { projectId, key: autoSyncPreferenceKey('overleaf', document.vault_id, projectId, remotePath) }
    } catch { return null }
  }, [project, remotePath, document.vault_id])
  const autoEnabled = Boolean(autoTarget && (autoChoice?.key === autoTarget.key ? autoChoice.enabled : readAutoSyncEnabled(localStorage, autoTarget.key)))
  const autoEnabledRef = useRef(autoEnabled)
  useEffect(() => { autoEnabledRef.current = autoEnabled }, [autoEnabled])
  useFocusTrap(dialog, { active: true }); useEscapeToClose(true, onClose)
  useEffect(() => { const epoch = generation; epoch.current++; return () => { epoch.current++ } }, [document.vault_id, document.path, document.content_hash])
  useEffect(() => {
    const preventPendingSwitch = (event: Event) => {
      if (pending.current) (event as CustomEvent<{ waitUntil: (decision: Promise<boolean>) => void }>).detail?.waitUntil(Promise.resolve(false))
    }
    window.addEventListener('scriptor:vault-change-starting', preventPendingSwitch)
    return () => window.removeEventListener('scriptor:vault-change-starting', preventPendingSwitch)
  }, [])
  const run = async (action: () => Promise<void>, operation: 'preview' | 'local' | 'share' = 'preview') => {
    if (pending.current) return
    pending.current = true
    const current = generation.current
    setBusy(true)
    setError(null)
    setStatus(operation === 'share' ? 'Checking current share attempt…' : operation === 'local' ? 'Saving reviewed source locally…' : 'Fetching latest remote preview…')
    try { await action() }
    catch (failure) {
      if (current === generation.current) {
        const detail = failure instanceof Error ? failure.message : String(failure)
        const stale = operation === 'share' && /changed since review|stale|revision conflict/i.test(detail)
        setStatus(stale ? 'Latest share was not pushed. Fetch the remote revision again before sharing.' :
          operation === 'share' ? 'Latest share not confirmed; check the remote project before retrying.' : 'Latest operation did not complete.')
        // A rejected or uncertain share invalidates the previous review. Native
        // CAS remains authoritative, and the UI must not offer a blind retry.
        if (operation === 'share') { setAccepted(false); setSnapshot(null) }
        setError(stale ? `Latest share was not pushed: ${detail}` : detail)
      }
    } finally {
      pending.current = false
      if (current === generation.current) setBusy(false)
    }
  }
  const guard = async () => {
    const current = await sourceFileRead(document.vault_id, document.path)
    if (current.content_hash !== document.content_hash) throw new Error('Local source changed since this panel opened. Close and reopen to review the saved version.')
    return current
  }
  const changeTarget = () => { generation.current++; baseline.current = null; reviewEdited.current = false; setSnapshot(null); setAccepted(false); setReviewed(''); setError(null); setPreviousShare(null) }
  const fetchRemote = () => void run(async () => {
    const current = generation.current
    const local = await guard()
    const result = await overleafRead(document.vault_id, project, remotePath)
    if (current !== generation.current) return
    setSnapshot(result)
    if (bindingKey && autoTarget) { try { saveOverleafBinding(localStorage, bindingKey, autoTarget.projectId, remotePath) } catch { /* Keep a working session even when preference storage is full. */ } }
    baseline.current = autoTarget && result.content === local.content ? { key: autoTarget.key, content: local.content } : null
    reviewEdited.current = false
    setReviewed(result.content ?? document.content)
    setAccepted(false)
    setStatus(result.content === null ? 'Remote file does not exist. Sharing creates it; applying a remote copy is unavailable.' : 'Remote preview loaded. Compare both copies and explicitly review the merged source.')
  })
  useEffect(() => {
    if (!autoEnabled || !autoTarget) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const epoch = generation.current
    const current = () => !stopped && autoEnabledRef.current && epoch === generation.current
    const schedule = (delay: number) => { if (current()) timer = setTimeout(() => { void tick() }, delay) }
    const tick = async () => {
      if (!current()) return
      if (window.document.hidden || pending.current) { schedule(30_000); return }
      pending.current = true
      try {
        const local = await sourceFileRead(document.vault_id, document.path)
        if (!current()) return
        const remote = await overleafRead(document.vault_id, project, remotePath)
        if (!current()) return
        if (bindingKey) { try { saveOverleafBinding(localStorage, bindingKey, autoTarget.projectId, remotePath) } catch { /* Sync remains available even when optional link storage fails. */ } }
        const common = baseline.current?.key === autoTarget.key ? baseline.current.content : null
        const direction = decideAutoSync(common, local.content, remote.content)
        if (reviewEdited.current) {
          setSnapshot(remote); setAccepted(false)
          setStatus('Auto-sync detected the latest remote state while you were editing a review. Check both copies before applying.')
          return
        }
        if (direction === 'equal') {
          baseline.current = { key: autoTarget.key, content: local.content }
          setSnapshot(remote); setReviewed(local.content); setAccepted(false)
          setStatus('Auto-sync active: the saved local and Overleaf copies match.')
        } else if (direction === 'pull' && remote.content !== null) {
          if (!current()) return
          const updated = await sourceFileSave(local, remote.content)
          if (!current()) return
          baseline.current = { key: autoTarget.key, content: remote.content }
          setStatus('Auto-sync imported an unchanged-base update from Overleaf.')
          onApplied(updated)
        } else if (direction === 'push' && remote.content !== null) {
          if (!current()) return
          const result = await overleafPush(document.vault_id, project, remotePath, local.content, remote)
          if (!current()) return
          baseline.current = { key: autoTarget.key, content: local.content }
          setSnapshot(result); setReviewed(local.content); setAccepted(false)
          setStatus('Auto-sync shared saved local changes with Overleaf.')
        } else {
          setSnapshot(remote); setReviewed(remote.content ?? local.content); setAccepted(false)
          setStatus('Auto-sync found different local and remote content. Review before applying or sharing; neither copy was overwritten.')
        }
      } catch (caught) {
        if (current()) {
          const detail = caught instanceof Error ? caught.message : String(caught)
          setError(`Auto-sync paused: ${detail}`)
          setStatus('Auto-sync paused after a provider or authorization error. Refresh manually or turn auto-sync off and on to retry.')
          stopped = true
        }
      } finally {
        pending.current = false
        if (current()) schedule(30_000)
      }
    }
    const resumed = () => {
      if (!window.document.hidden && current()) {
        if (timer) clearTimeout(timer)
        schedule(1_000)
      }
    }
    window.document.addEventListener('visibilitychange', resumed)
    schedule(1_000)
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      window.document.removeEventListener('visibilitychange', resumed)
    }
  }, [autoEnabled, autoTarget, bindingKey, document.vault_id, document.path, project, remotePath, onApplied])
  const comparison = snapshot ? alignReviewedSource(document.content, snapshot.content ?? '') : null
  const localEndings = sourceLineEndingStyle(document.content)
  const remoteEndings = snapshot?.content === null || !snapshot ? null : sourceLineEndingStyle(snapshot.content)
  return <div className="modal-backdrop"><section className="modal-card overleaf-panel" ref={dialog} role="dialog" aria-modal="true" aria-label="Overleaf source sync" data-help-topic="git">
    <header><h2>Overleaf source sync</h2><button type="button" aria-label="Close Overleaf sync" title="Close" onClick={onClose}><X aria-hidden="true" size={18} /></button></header>
    <div className="overleaf-panel-body" dir="auto">
    <p>Compare this saved source file with Overleaf before applying or sharing changes. Only this file is synchronized; the rest of the project stays untouched.</p>
    <details className="overleaf-requirements">
      <summary>Connection requirements and limits</summary>
      <p>Overleaf Cloud Git access requires an eligible paid plan and a Git token stored in your operating-system credential manager with username “git”. Scriptor does not import browser sessions or passwords.</p>
      <p>Only the selected UTF-8 .tex, .ltx or .bib file is exchanged. Figures, included files, and compiler settings remain in their projects. Existing remote edits are never force-pushed.</p>
    </details>
    <h3 className="overleaf-step-heading">1. Choose the remote file</h3>
    <p>Saved local source: <bdi>{document.path}</bdi></p>
    <label>Overleaf project ID or official URL<input value={project} disabled={busy} autoComplete="off" onChange={event => { changeTarget(); setProject(event.target.value) }}/></label>
    <label>Remote project source path<input value={remotePath} disabled={busy} autoComplete="off" onChange={event => { changeTarget(); setRemotePath(event.target.value) }}/></label>
    {bindingKey && project && <button type="button" className="toolbar-button" disabled={busy} onClick={() => {
      try { forgetOverleafBinding(localStorage, bindingKey) } catch { /* Re-entering a project is still possible. */ }
      changeTarget(); setProject(''); setRemotePath(document.path)
      setStatus('Saved Overleaf project link cleared. Select a project to connect again.')
    }}>Forget saved Overleaf link</button>}
    {autoTarget && <label className="overleaf-auto-sync-toggle"><input type="checkbox" checked={autoEnabled} onChange={event => {
      try {
        const enabled = event.target.checked
        writeAutoSyncEnabled(localStorage, autoTarget.key, enabled)
        autoEnabledRef.current = enabled
        setAutoChoice({ key: autoTarget.key, enabled })
        if (!enabled) setStatus('Overleaf auto-sync is off for this project file. Manual review and sharing remain available.')
      } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)) }
    }} />Auto-sync this Overleaf source (on by default)</label>}
    {autoTarget && <p className="health-subtitle">Checks this source while this panel is open. Only changes with a known, unchanged shared base sync automatically; concurrent edits require review. Turning Off is remembered for this project.</p>}
    <button type="button" disabled={busy || !project.trim() || !remotePath.trim()} onClick={fetchRemote}>Fetch remote source preview</button>
    {!error && <p role="status" className="overleaf-current-status">{status}</p>}
    {error && <div className="overleaf-operation-error" role="alert">
      <strong dir="auto">{error}</strong>
      <button type="button" disabled={busy || !project.trim() || !remotePath.trim()} onClick={fetchRemote} aria-label="Fetch latest remote preview">Fetch latest remote preview</button>
    </div>}
    {error && previousShare && <details className="overleaf-previous-share">
      <summary>Previous successful share</summary>
      <p>Earlier reviewed source was shared at <time>{previousShare}</time>. This does not confirm the latest attempt.</p>
    </details>}
    {snapshot && <>
      <h3 className="overleaf-step-heading">2. Compare and review changes</h3>
      <p className="overleaf-diff-legend">Aligned line review · {comparison?.summary.added ?? 0} added · {comparison?.summary.removed ?? 0} removed · {comparison?.summary.changed ?? 0} changed. Local content check <code>{document.content_hash.slice(0, 10)}</code> · Remote revision <code>{snapshot.head.slice(0, 10)}</code>. {comparison?.simplified ? 'Large comparison: simplified alignment; review both full copies before sharing.' : null}</p>
      {remoteEndings && localEndings !== 'none' && remoteEndings !== 'none' && localEndings !== remoteEndings ? <p className="overleaf-diff-legend" role="note">Line-ending formats differ: saved source uses {localEndings}, remote source uses {remoteEndings}. Line counts describe visible text; preserving the chosen source formatting requires checking the exact source.</p> : null}
      <div className="overleaf-comparison">
        <section aria-label="Saved local source"><h3>Saved local source</h3><pre>{comparison?.rows.map((row, index) => <span key={index} className={`overleaf-diff-line${row.kind === 'equal' ? '' : ' is-changed'}${row.local === null ? ' is-placeholder' : ''}`}>{row.local ?? '\u00a0'}</span>)}</pre></section>
        <section aria-label="Reviewed remote source"><h3>Remote source</h3><pre>{snapshot.content === null ? 'File absent from remote project.' : comparison?.rows.map((row, index) => <span key={index} className={`overleaf-diff-line${row.kind === 'equal' ? '' : ' is-changed'}${row.remote === null ? ' is-placeholder' : ''}`}>{row.remote ?? '\u00a0'}</span>)}</pre></section>
      </div>
      <label>Reviewed source to apply locally or share<textarea aria-label="Reviewed source to apply locally or share" value={reviewed} disabled={busy} spellCheck={false} onChange={event => { reviewEdited.current = true; setReviewed(event.target.value); setAccepted(false) }}/></label>
      <div className="overleaf-action-footer">
      <label className="overleaf-consent"><input type="checkbox" checked={accepted} disabled={busy} onChange={event => setAccepted(event.target.checked)}/><span>I compared both copies and reviewed this source for the selected action</span></label>
      <div className="overleaf-review-actions">
      <button type="button" disabled={busy || !accepted || snapshot.content === null} onClick={() => void run(async () => {
        const current = generation.current; const local = await guard(); const updated = await sourceFileSave(local, reviewed)
        if (current !== generation.current) return
        setStatus('Reviewed source saved locally. Remote source remains unchanged.'); onApplied(updated)
      }, 'local')} aria-label="Apply reviewed source locally"><span className="overleaf-action-full">Apply reviewed source locally</span><span className="overleaf-action-compact" aria-hidden="true">Save locally</span></button>
      <button type="button" disabled={busy || !accepted} onClick={() => void run(async () => {
        const current = generation.current; await guard(); const result = await overleafPush(document.vault_id, project, remotePath, reviewed, snapshot)
        if (current !== generation.current) return
        baseline.current = autoTarget && result.content === document.content ? { key: autoTarget.key, content: document.content } : null
        setSnapshot(result); setAccepted(false); setPreviousShare(new Date().toLocaleString()); setStatus('Reviewed source shared with Overleaf. Local source remains unchanged.')
      }, 'share')} aria-label="Share reviewed source with Overleaf"><span className="overleaf-action-full">Share reviewed source with Overleaf</span><span className="overleaf-action-compact" aria-hidden="true">Share with Overleaf</span></button>
      </div>
      </div>
    </>}
    {busy && <p>The submitted operation is pending. Closing discards its display result; an already submitted share or local save may still complete.</p>}
    </div>
  </section></div>
}

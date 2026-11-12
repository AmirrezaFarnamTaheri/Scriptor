import { useEffect, useRef, useState } from 'react'
import { overleafRead, overleafPush } from '../bridge/commands/overleaf'
import { sourceFileRead, sourceFileSave } from '../bridge/commands/source_files'
import { type SourceDocument } from '../lib/sourceFile'
import { type OverleafSnapshot } from '../lib/overleaf'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import '../styles/components/overleaf.css'
/** Highlight the source lines that differ in the other reviewed copy. */
function comparedLines(content: string, other: string) {
  const otherLines = other.split(/\r?\n/)
  return content.split(/\r?\n/).map((line, index) => (
    <span key={index} className={line === otherLines[index] ? 'overleaf-diff-line' : 'overleaf-diff-line is-changed'}>{line || '\u00a0'}</span>
  ))
}
export interface OverleafPanelProps { document: SourceDocument; onClose: () => void; onApplied: (document: SourceDocument) => void }
export function OverleafPanel({ document, onClose, onApplied }: OverleafPanelProps) {
  const [project, setProject] = useState(''); const [remotePath, setRemotePath] = useState(document.path)
  const [snapshot, setSnapshot] = useState<OverleafSnapshot | null>(null); const [reviewed, setReviewed] = useState('')
  const [busy, setBusy] = useState(false); const [accepted, setAccepted] = useState(false)
  const [status, setStatus] = useState('Fetch a remote preview to compare it with the saved local source.'); const [error, setError] = useState<string | null>(null)
  const [previousShare, setPreviousShare] = useState<string | null>(null)
  const dialog = useRef<HTMLDivElement>(null); const generation = useRef(0); const pending = useRef(false)
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
  const changeTarget = () => { generation.current++; setSnapshot(null); setAccepted(false); setReviewed(''); setError(null); setPreviousShare(null) }
  const fetchRemote = () => void run(async () => {
    const current = generation.current
    await guard()
    const result = await overleafRead(document.vault_id, project, remotePath)
    if (current !== generation.current) return
    setSnapshot(result)
    setReviewed(result.content ?? document.content)
    setAccepted(false)
    setStatus(result.content === null ? 'Remote file does not exist. Sharing creates it; applying a remote copy is unavailable.' : 'Remote preview loaded. Compare both copies and explicitly review the merged source.')
  })
  return <div className="modal-backdrop"><section className="modal-card overleaf-panel" ref={dialog} role="dialog" aria-modal="true" aria-label="Overleaf source sync" data-help-topic="git">
    <header><h2>Overleaf source sync</h2><button type="button" aria-label="Close Overleaf sync" onClick={onClose}>Close</button></header>
    <div className="overleaf-panel-body">
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
    <button type="button" disabled={busy || !project.trim() || !remotePath.trim()} onClick={fetchRemote}>Fetch remote source preview</button>
    {!error && <p role="status" className="overleaf-current-status">{status}</p>}
    {error && <div className="overleaf-operation-error" role="alert">
      <strong>{error}</strong>
      <button type="button" disabled={busy || !project.trim() || !remotePath.trim()} onClick={fetchRemote} aria-label="Fetch latest remote preview">Fetch latest remote preview</button>
    </div>}
    {error && previousShare && <details className="overleaf-previous-share">
      <summary>Previous successful share</summary>
      <p>Earlier reviewed source was shared at <time>{previousShare}</time>. This does not confirm the latest attempt.</p>
    </details>}
    {snapshot && <>
      <h3 className="overleaf-step-heading">2. Compare and review changes</h3>
      <p className="overleaf-diff-legend">Changed lines are highlighted. Local content check <code>{document.content_hash.slice(0, 10)}</code> · Remote revision <code>{snapshot.head.slice(0, 10)}</code>.</p>
      <div className="overleaf-comparison"><section aria-label="Saved local source"><h3>Saved local source</h3><pre>{comparedLines(document.content, snapshot.content ?? '')}</pre></section><section aria-label="Reviewed remote source"><h3>Remote source</h3><pre>{snapshot.content === null ? 'File absent from remote project.' : comparedLines(snapshot.content, document.content)}</pre></section></div>
      <label>Reviewed source to apply locally or share<textarea aria-label="Reviewed source to apply locally or share" value={reviewed} disabled={busy} spellCheck={false} onChange={event => { setReviewed(event.target.value); setAccepted(false) }}/></label>
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
        setSnapshot(result); setAccepted(false); setPreviousShare(new Date().toLocaleString()); setStatus('Reviewed source shared with Overleaf. Local source remains unchanged.')
      }, 'share')} aria-label="Share reviewed source with Overleaf"><span className="overleaf-action-full">Share reviewed source with Overleaf</span><span className="overleaf-action-compact" aria-hidden="true">Share with Overleaf</span></button>
      </div>
      </div>
    </>}
    {busy && <p>The submitted operation is pending. Closing discards its display result; an already submitted share or local save may still complete.</p>}
    </div>
  </section></div>
}

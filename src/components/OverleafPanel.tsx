import { useEffect, useRef, useState } from 'react'
import { overleafRead, overleafPush } from '../bridge/commands/overleaf'
import { sourceFileRead, sourceFileSave } from '../bridge/commands/source_files'
import { type SourceDocument } from '../lib/sourceFile'
import { type OverleafSnapshot } from '../lib/overleaf'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import '../styles/components/overleaf.css'
export interface OverleafPanelProps { document: SourceDocument; onClose: () => void; onApplied: (document: SourceDocument) => void }
export function OverleafPanel({ document, onClose, onApplied }: OverleafPanelProps) {
  const [project, setProject] = useState(''); const [remotePath, setRemotePath] = useState(document.path)
  const [snapshot, setSnapshot] = useState<OverleafSnapshot | null>(null); const [reviewed, setReviewed] = useState('')
  const [busy, setBusy] = useState(false); const [accepted, setAccepted] = useState(false)
  const [status, setStatus] = useState('Fetch a remote preview to compare it with the saved local source.'); const [error, setError] = useState<string | null>(null)
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
  const run = async (action: () => Promise<void>) => {
    if (pending.current) return
    pending.current = true; const current = generation.current; setBusy(true); setError(null)
    try { await action() } catch (failure) { if (current === generation.current) setError(String(failure)) } finally { pending.current = false; if (current === generation.current) setBusy(false) }
  }
  const guard = async () => {
    const current = await sourceFileRead(document.vault_id, document.path)
    if (current.content_hash !== document.content_hash) throw new Error('Local source changed since this panel opened. Close and reopen to review the saved version.')
    return current
  }
  const changeTarget = () => { generation.current++; setSnapshot(null); setAccepted(false); setReviewed('') }
  return <div className="modal-backdrop"><section className="modal-card overleaf-panel" ref={dialog} role="dialog" aria-modal="true" aria-label="Overleaf source sync" data-help-topic="git">
    <header><h2>Overleaf source sync</h2><button type="button" onClick={onClose}>Close Overleaf sync</button></header>
    <div className="overleaf-panel-body">
    <p>Sync this saved source file through the official Overleaf Cloud Git bridge. Git access requires eligible premium access and a token saved in your operating-system Git credential manager using username “git”. No browser session is imported.</p>
    <p>Only the selected UTF-8 .tex, .ltx or .bib file is synchronized. Figures, included files and compiler settings stay in their respective projects. Set the main document in Overleaf if needed. Review each action; existing remote edits are never force-pushed.</p>
    <p>Local source: <bdi>{document.path}</bdi></p>
    <label>Overleaf project ID or official URL<input value={project} disabled={busy} autoComplete="off" onChange={event => { changeTarget(); setProject(event.target.value) }}/></label>
    <label>Remote project source path<input value={remotePath} disabled={busy} autoComplete="off" onChange={event => { changeTarget(); setRemotePath(event.target.value) }}/></label>
    <button type="button" disabled={busy || !project.trim() || !remotePath.trim()} onClick={() => void run(async () => {
      const current = generation.current; await guard(); const result = await overleafRead(document.vault_id, project, remotePath)
      if (current !== generation.current) return
      setSnapshot(result); setReviewed(result.content ?? document.content); setAccepted(false); setStatus(result.content === null ? 'Remote file does not exist. Sharing creates it; applying a remote copy is unavailable.' : 'Remote preview loaded. Compare both copies and explicitly review the merged source.')
    })}>Fetch remote source preview</button>
    <p role="status">{status}</p>{error && <p role="alert">{error}</p>}
    {snapshot && <>
      <div className="overleaf-comparison"><section aria-label="Saved local source"><h3>Saved local source</h3><pre>{document.content}</pre></section><section aria-label="Reviewed remote source"><h3>Remote source</h3><pre>{snapshot.content ?? 'File absent from remote project.'}</pre></section></div>
      <label>Reviewed source to apply locally or share<textarea aria-label="Reviewed source to apply locally or share" value={reviewed} disabled={busy} spellCheck={false} onChange={event => { setReviewed(event.target.value); setAccepted(false) }}/></label>
      <label className="overleaf-consent"><input type="checkbox" checked={accepted} disabled={busy} onChange={event => setAccepted(event.target.checked)}/><span>I compared both copies and reviewed this source for the selected action</span></label>
      <button type="button" disabled={busy || !accepted || snapshot.content === null} onClick={() => void run(async () => {
        const current = generation.current; const local = await guard(); const updated = await sourceFileSave(local, reviewed)
        if (current !== generation.current) return
        setStatus('Reviewed source saved locally. Remote source remains unchanged.'); onApplied(updated)
      })}>Apply reviewed source locally</button>
      <button type="button" disabled={busy || !accepted} onClick={() => void run(async () => {
        const current = generation.current; await guard(); const result = await overleafPush(document.vault_id, project, remotePath, reviewed, snapshot)
        if (current !== generation.current) return
        setSnapshot(result); setAccepted(false); setStatus('Reviewed source shared with Overleaf. Local source remains unchanged.')
      })}>Share reviewed source with Overleaf</button>
    </>}
    {busy && <p>The submitted operation is pending. Closing discards its display result; an already submitted share or local save may still complete.</p>}
    </div>
  </section></div>
}

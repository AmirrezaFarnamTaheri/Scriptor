import { useEffect, useRef, useState } from 'react'
import { collaborationAppend, collaborationConnect, collaborationDisconnect, collaborationList, collaborationRead, vaultReadNote, vaultSaveNote } from '../bridge/commands'
import { hasUnresolvedSharedConflict, mergeSharedRevision, type SharedRevision } from '../lib/collaboration'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'

export interface CollaborationPanelProps {
  path: string | null
  vaultId: string | null
  onClose(): void
  onApplied(): void | Promise<void>
}

/** Every remote transfer is authorized by the native broker; previews never write notes. */
export default function CollaborationPanel({ path, vaultId, onClose, onApplied }: CollaborationPanelProps) {
  const [clientId, setClientId] = useState('')
  const [folderId, setFolderId] = useState('')
  const [account, setAccount] = useState('')
  const [rows, setRows] = useState<Array<{ id: string; name: string }>>([])
  const [pageToken, setPageToken] = useState<string>()
  const [preview, setPreview] = useState<{ record: SharedRevision; markdown: string; hash: string; conflict: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const epoch = useRef(0)
  const base = useRef<{ path: string; markdown: string } | null>(null)
  const peer = useRef(crypto.randomUUID())
  useEffect(() => {
    epoch.current++
    base.current = null
  }, [path, vaultId, folderId])
  useEffect(() => () => { epoch.current++ }, [])
  async function run(action: (current: number) => Promise<void>) {
    if (busy) return
    const current = epoch.current
    setBusy(true); setError(''); setMessage('')
    try { await action(current) }
    catch (reason) { if (epoch.current === current) setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }
  async function list(current: number, next?: string) {
    const result = await collaborationList(folderId, next)
    if (epoch.current !== current) return
    setRows(previous => next ? [...previous, ...result.files].slice(0, 1000) : result.files)
    setPageToken(result.nextPageToken)
  }
  return <UnifiedPanelShell title="Drive collaboration" ariaLabel="Drive collaboration" helpTopic="integrations" onClose={onClose} wide>
    <div className="collaboration-panel">
      <p>Share immutable Markdown revisions in a Google Drive folder. Review incoming changes before applying them. Overlapping edits retain local, base and remote text for resolution.</p>
      <p>The Google sign-in requests Drive access. Scriptor confines these transfers to the folder you enter. Your credentials stay in the operating-system keychain.</p>
      <label>Google OAuth desktop client ID<input value={clientId} onChange={event => setClientId(event.target.value)} disabled={busy} autoComplete="off" /></label>
      <div className="collaboration-actions">
        <button disabled={busy || !clientId.trim()} onClick={() => void run(async current => { const value = await collaborationConnect(clientId.trim()); if (current === epoch.current) setAccount(value) })}>Connect Google Drive</button>
        <button disabled={busy} onClick={() => void run(async () => { await collaborationDisconnect(); setAccount(''); setMessage('Local credential removed. To revoke Google access, use your Google account permissions.') })}>Remove saved credential</button>
      </div>
      {account && <p>Connected: {account}</p>}
      <label>Shared folder ID<input value={folderId} onChange={event => {
        setFolderId(event.target.value.trim()); setPreview(null); setRows([]); setPageToken(undefined)
      }} disabled={busy} autoComplete="off" /></label>
      <p>Mapped local note: <bdi>{path ?? 'Select a note'}</bdi></p>
      <div className="collaboration-actions">
        <button disabled={busy || !folderId || !path || !vaultId} onClick={() => void run(async current => {
          const note = await vaultReadNote(path!)
          if (current !== epoch.current) return
          const record: SharedRevision = { schema: 'scriptor.collaboration.v1', id: crypto.randomUUID(), document: path!, peer_id: peer.current,
            base_markdown: base.current?.path === path ? base.current.markdown : note.markdown, markdown: note.markdown, created_at: new Date().toISOString() }
          await collaborationAppend(folderId, record)
          if (current === epoch.current) { base.current = { path: path!, markdown: note.markdown }; setMessage('Revision shared. Local note was unchanged.') }
        })}>Share current saved revision</button>
        <button disabled={busy || !folderId || !vaultId} onClick={() => void run(current => list(current))}>Refresh shared revisions</button>
        {pageToken && <button disabled={busy || rows.length >= 1000} onClick={() => void run(current => list(current, pageToken))}>Load next page</button>}
      </div>
      <ul>{rows.map(row => <li key={row.id}><button disabled={busy || !path} onClick={() => void run(async current => {
        const record = await collaborationRead(folderId, row.id)
        if (record.document !== path) throw new Error(`This revision maps to ${record.document}. Select that local note to review it.`)
        const local = await vaultReadNote(path!)
        if (current !== epoch.current) return
        const merged = mergeSharedRevision(record.base_markdown, local.markdown, record.markdown)
        setPreview({ record, ...merged, hash: local.metadata.content_hash })
      })}><bdi>{row.name}</bdi></button></li>)}</ul>
      {rows.length >= 1000 && pageToken && <p>Listing reached 1,000 revisions. Use a smaller shared folder.</p>}
      {preview && <>
        <p>{preview.conflict ? 'Resolve every conflict marker before applying.' : 'Merge preview is ready.'} Shared {preview.record.created_at} by <bdi>{preview.record.peer_id}</bdi>.</p>
        <label>Reviewed merge<textarea rows={16} value={preview.markdown} disabled={busy} onChange={event => setPreview({ ...preview, markdown: event.target.value })} /></label>
        <button disabled={busy || !vaultId || hasUnresolvedSharedConflict(preview.markdown)} onClick={() => void run(async current => {
          if (preview.record.document !== path) throw new Error('Selected note changed; review again.')
          await vaultSaveNote(path!, preview.markdown, preview.hash, false, vaultId!)
          if (current === epoch.current) {
            base.current = { path: path!, markdown: preview.markdown }
            setPreview(null); setMessage('Reviewed merge saved.'); await onApplied()
          }
        })}>Apply reviewed merge</button>
      </>}
      {busy && <p role="status">Working…</p>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  </UnifiedPanelShell>
}

import { useEffect, useRef, useState } from 'react'
import { collaborationAppend, collaborationConnect, collaborationDisconnect, collaborationList, collaborationRead, vaultReadNote, vaultSaveNote } from '../bridge/commands'
import { hasUnresolvedSharedConflict, mergeSharedRevision, sharedRevisionBase, parseCollaborationMapping, collaborationMappingKey, type SharedRevision } from '../lib/collaboration'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import { collaborationReadDocs, collaborationCreateDocs } from '../bridge/commands/collaboration'
import type { CollaborationTransport } from '../bridge/commands/collaboration'
import { translateGoogleDoc, docsPlainTextExport } from '../lib/collaborationDocs'
import { useCollaborationPolling } from '../hooks/useCollaborationPolling'

export interface CollaborationPanelProps {
  path: string | null
  vaultId: string | null
  onClose(): void
  onApplied(): void | Promise<void>
  runSourceNoteMutation(sourcePath: string, runMutation: () => Promise<void>): Promise<boolean>
}

/** Every remote transfer is authorized by the native broker; previews never write notes. */
export default function CollaborationPanel({ path, vaultId, onClose, onApplied, runSourceNoteMutation }: CollaborationPanelProps) {
  const [clientId, setClientId] = useState('')
  const [folderId, setFolderId] = useState('')
  const [account, setAccount] = useState('')
  const [rows, setRows] = useState<Array<{ id: string; name: string }>>([])
  const [pageToken, setPageToken] = useState<string>()
  const [preview, setPreview] = useState<{ record: SharedRevision; markdown: string; hash: string; conflict: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pollConsent, setPollConsent] = useState(false)
  const [docsId, setDocsId] = useState('')
  const [docsConsent, setDocsConsent] = useState(false)
  const [docsPreview, setDocsPreview] = useState<{ markdown: string; hash: string; warnings: string[]; title: string } | null>(null)
  const [transport, setTransport] = useState<CollaborationTransport>('drive_json')
  const polling = useCollaborationPolling(folderId, vaultId, path, transport, result => { setRows(result.files); setPageToken(result.nextPageToken) })
  const epoch = useRef(0)
  const base = useRef<{ path: string; markdown: string } | null>(null)
  const peer = useRef<string>(crypto.randomUUID())
  const occupied = useRef(false)
  useEffect(() => {
    epoch.current++
    base.current = null
    peer.current = crypto.randomUUID()
    if (!vaultId || !folderId || !path) return
    const current = epoch.current
    void Promise.resolve().then(() => {
      if (current !== epoch.current) return
      const saved = localStorage.getItem(collaborationMappingKey(vaultId, folderId, path))
      if (saved) {
        const mapping = parseCollaborationMapping(saved, vaultId, folderId, path)
        base.current = { path, markdown: mapping.markdown }; peer.current = mapping.peerId
      }
    }).catch(() => {
      if (current === epoch.current) setError('The saved collaboration ancestor could not be loaded. Incoming differences will require explicit review; no shared content will be discarded.')
    })
  }, [path, vaultId, folderId])
  useEffect(() => () => { epoch.current++ }, [])
  function remember(markdown: string): string {
    if (!path || !vaultId) return ''
    base.current = { path, markdown }
    try {
      const raw = JSON.stringify({ schema: 'scriptor.collaboration.mapping.v1', vaultId, folderId, path, peerId: peer.current, markdown })
      parseCollaborationMapping(raw, vaultId, folderId, path)
      localStorage.setItem(collaborationMappingKey(vaultId, folderId, path), raw)
      return ''
    } catch { return ' The action completed, but its ancestor could not be cached on this device. Review incoming differences explicitly after reopening.' }
  }
  async function run(action: (current: number) => Promise<void>) {
    if (occupied.current) return
    occupied.current = true
    const current = epoch.current
    setBusy(true); setError(''); setMessage('')
    try { await action(current) }
    catch (reason) { if (epoch.current === current) setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { occupied.current = false; if (epoch.current === current) setBusy(false) }
  }
  async function list(current: number, next?: string) {
    const result = await collaborationList(vaultId!, folderId, next, transport)
    if (epoch.current !== current) return
    setRows(previous => next ? [...previous, ...result.files].slice(0, 1000) : result.files)
    setPageToken(result.nextPageToken)
  }
  return <UnifiedPanelShell title="Drive collaboration" ariaLabel="Drive collaboration" helpTopic="integrations" onClose={onClose} wide>
    <div className="collaboration-panel">
      <p>Share immutable Markdown revisions in a Google Drive folder. Review incoming changes before applying them. Overlapping edits retain local, base and remote text for resolution.</p>
      <p>The Google sign-in requests Drive access. Scriptor confines these transfers to the folder you enter. Your credentials stay in the operating-system keychain.</p>
      <p>The last shared ancestor and this note’s peer identity are cached on this device, scoped to this vault and Drive folder. This cache includes note text; it is separate from your Markdown files and credentials.</p>
      <label>Revision transport<select aria-label="Revision transport" value={transport} disabled={busy || polling.starting} onChange={event => { polling.stop(); setTransport(event.target.value as CollaborationTransport); setPollConsent(false); setRows([]); setPageToken(undefined); setPreview(null) }}><option value="drive_json">Drive JSON revision records</option><option value="google_docs">Google Docs as an opaque Markdown tunnel</option></select></label>
      {transport === 'google_docs' && <p>Google Docs hosts schema-marked, checksum-verified copies of the Markdown revision bytes. Scriptor creates new records and never edits previous records. Do not edit their encoded bodies in Google Docs: edited markers, checksums, extra tabs or non-text blocks are rejected. Local Markdown remains the writing surface. Embedded asset files are not synchronized by this transport.</p>}
      <label>Google OAuth desktop client ID<input value={clientId} onChange={event => setClientId(event.target.value)} disabled={busy} autoComplete="off" /></label>
      <div className="collaboration-actions">
        <button disabled={busy || polling.active || polling.starting || !clientId.trim()} onClick={() => void run(async current => { const value = await collaborationConnect(clientId.trim()); if (current === epoch.current) setAccount(value) })}>Connect Google Drive</button>
        <button disabled={busy || polling.starting} onClick={() => void run(async () => { polling.stop(); await collaborationDisconnect(); setAccount(''); setMessage('Local credential removed. To revoke Google access, use your Google account permissions.') })}>Remove saved credential</button>
      </div>
      <section aria-label="Shared revision polling">
        <p>Optional automatic checks read the newest 100 revision records, at most once every 30 seconds, for up to 15 minutes or 30 checks. Checks stop when this panel closes, its note or vault changes, the window is hidden, or three checks fail. Existing merge previews and local notes remain unchanged.</p>
        <label><input type="checkbox" checked={pollConsent} disabled={polling.active || polling.starting} onChange={event => setPollConsent(event.target.checked)} />Allow this bounded read-only polling session for the selected folder</label>
        <button disabled={busy || polling.active || polling.starting || !pollConsent || !folderId || !vaultId} onClick={() => void polling.start()}>Start automatic checks</button>
        {(polling.active || polling.starting) && <button onClick={polling.stop}>Stop automatic checks</button>}
        {polling.status && <p role="status">{polling.status}</p>}{polling.error && <p role="alert">{polling.error}</p>}
      </section>
      {account && <p>Connected: {account}</p>}
      <label>Shared folder ID<input value={folderId} onChange={event => {
        setFolderId(event.target.value.trim()); setPreview(null); setRows([]); setPageToken(undefined)
        setPollConsent(false); setDocsConsent(false); setDocsPreview(null)
      }} disabled={busy} autoComplete="off" /></label>
      <p>Mapped local note: <bdi>{path ?? 'Select a note'}</bdi></p>
      <div className="collaboration-actions">
        <button disabled={busy || !folderId || !path || !vaultId} onClick={() => void run(async current => {
          const note = await vaultReadNote(path!)
          if (note.metadata.vault_id !== vaultId) throw new Error('Vault changed; reopen collaboration.')
          if (current !== epoch.current) return
          const record: SharedRevision = { schema: 'scriptor.collaboration.v1', id: crypto.randomUUID(), document: path!, peer_id: peer.current,
            base_markdown: sharedRevisionBase(base.current, path!), markdown: note.markdown, created_at: new Date().toISOString() }
          await collaborationAppend(vaultId!, folderId, record, transport)
          if (current === epoch.current) setMessage(`Revision shared. Local note was unchanged.${remember(note.markdown)}`)
        })}>Share current saved revision</button>
        <button disabled={busy || !folderId || !vaultId} onClick={() => void run(current => list(current))}>Refresh shared revisions</button>
        {pageToken && <button disabled={busy || rows.length >= 1000} onClick={() => void run(current => list(current, pageToken))}>Load next page</button>}
      </div>
      <ul>{rows.map(row => <li key={row.id}><button disabled={busy || !path} onClick={() => void run(async current => {
        const record = await collaborationRead(vaultId!, folderId, row.id, transport)
        if (record.document !== path) throw new Error(`This revision maps to ${record.document}. Select that local note to review it.`)
        const local = await vaultReadNote(path!)
        if (local.metadata.vault_id !== vaultId) throw new Error('Vault changed; reopen collaboration.')
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
          const applied = await runSourceNoteMutation(path!, async () => {
            await vaultSaveNote(path!, preview.markdown, preview.hash, false, vaultId!)
          })
          if (!applied) throw new Error('The editor could not save its draft. Save it and review the incoming revision again.')
          if (current === epoch.current) {
            const warning = remember(preview.markdown)
            setPreview(null); setMessage(`Reviewed merge saved.${warning}`); await onApplied()
          }
        })}>Apply reviewed merge</button>
      </>}
      <details><summary>Optional Google Docs text translation</summary>
        <p>Import a reviewed text copy from a Google document in this folder, or create a new plain-text Google document from the saved Markdown. This preserves text, not rich document fidelity. Comments, suggestions, history, layout, embedded media and access permissions do not transfer. Markdown syntax remains literal in exported plain-text copies. Existing Google documents are never overwritten.</p>
        <label>Google document ID<input value={docsId} disabled={busy} onChange={event => { setDocsId(event.target.value.trim()); setDocsPreview(null); setDocsConsent(false) }} autoComplete="off" /></label>
        <button disabled={busy || !folderId || !docsId || !path || !vaultId} onClick={() => void run(async current => {
          const translated = translateGoogleDoc(await collaborationReadDocs(vaultId!, folderId, docsId))
          const local = await vaultReadNote(path!)
          if (local.metadata.vault_id !== vaultId) throw new Error('Vault changed; reopen collaboration.')
          if (current !== epoch.current) return
          const merged = mergeSharedRevision(sharedRevisionBase(base.current, path!), local.markdown, translated.markdown)
          setDocsConsent(false); setDocsPreview({ ...translated, markdown: merged.markdown, hash: local.metadata.content_hash })
        })}>Preview translated Google document</button>
        {docsPreview && <><h3><bdi>{docsPreview.title}</bdi></h3><ul>{docsPreview.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul><label>Reviewed translated merge<textarea rows={12} value={docsPreview.markdown} disabled={busy} onChange={event => setDocsPreview({ ...docsPreview, markdown: event.target.value })} /></label></>}
        <label><input type="checkbox" checked={docsConsent} disabled={busy} onChange={event => setDocsConsent(event.target.checked)} />I reviewed and accept the text conversion losses for this action</label>
        {docsPreview && <button disabled={busy || !docsConsent || !path || !vaultId || hasUnresolvedSharedConflict(docsPreview.markdown)} onClick={() => void run(async current => {
          const applied = await runSourceNoteMutation(path!, () => vaultSaveNote(path!, docsPreview.markdown, docsPreview.hash, false, vaultId!).then(() => undefined))
          if (!applied) throw new Error('Save the editor draft and preview this translation again.')
          if (current === epoch.current) { setMessage(`Reviewed Google Docs translation saved.${remember(docsPreview.markdown)}`); setDocsPreview(null); setDocsConsent(false); await onApplied() }
        })}>Apply reviewed translated merge</button>}
        <button disabled={busy || !docsConsent || !folderId || !path || !vaultId} onClick={() => void run(async current => {
          const local = await vaultReadNote(path!)
          if (local.metadata.vault_id !== vaultId) throw new Error('Vault changed; reopen collaboration.')
          if (current !== epoch.current) return
          const result = await collaborationCreateDocs(vaultId!, folderId, `${path} — text copy`, docsPlainTextExport(local.markdown))
          if (current === epoch.current) { setDocsConsent(false); setMessage(`Created new Google document “${result.name}”. Existing documents and local note were unchanged.`) }
        })}>Create new Google Docs text copy</button>
      </details>
      {busy && <p role="status">Working…</p>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  </UnifiedPanelShell>
}

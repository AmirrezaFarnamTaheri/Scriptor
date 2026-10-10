import { useEffect, useRef, useState } from 'react'
import { collaborationAppend, collaborationConnect, collaborationDisconnect, collaborationList, collaborationRead, vaultReadNote, vaultSaveNote } from '../bridge/commands'
import { hasUnresolvedSharedConflict, mergeSharedRevision, sharedRevisionBase, parseCollaborationMapping, preparePendingSharedRevision, pendingSharedRevisionKey, type SharedRevision } from '../lib/collaboration'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import { collaborationReadDocs, collaborationCreateDocs, collaborationGenerateRevisionId } from '../bridge/commands/collaboration'
import type { CollaborationTransport } from '../bridge/commands/collaboration'
import { translateGoogleDoc, docsPlainTextExport } from '../lib/collaborationDocs'
import { useCollaborationPolling } from '../hooks/useCollaborationPolling'
import { collaborationCreateFolder, collaborationGetAccount, collaborationListDocs, collaborationListFolders } from '../bridge/commands/collaboration'
import { acceptGoogleResourcePage, appendGoogleResources, GOOGLE_COLLABORATION_COPY, googleCollaborationMappingKey, parseGoogleCollaborationSetup, type GoogleResource } from '../lib/googleCollaborationSetup'
import { useI18n } from '../lib/i18n'
import { mutateVaultConfig } from '../lib/vaultConfigMutation'
import { DEFAULT_VAULT_CONFIG } from '../lib/settingsDefaults'
import type { VaultConfig } from '../types/vault'
import { CollaborationResources } from './CollaborationResources'

export interface CollaborationPanelProps {
  path: string | null
  vaultId: string | null
  googleConfig?: VaultConfig['calendar_sync']
  onClose(): void
  onApplied(): void | Promise<void>
  runSourceNoteMutation(sourcePath: string, runMutation: () => Promise<void>): Promise<boolean>
}

/** Every remote transfer is authorized by the native broker; previews never write notes. */
export default function CollaborationPanel({ path, vaultId, googleConfig, onClose, onApplied, runSourceNoteMutation }: CollaborationPanelProps) {
  const { locale } = useI18n()
  const copy = GOOGLE_COLLABORATION_COPY[locale]
  const [initial] = useState(() => {
    try { return { ...parseGoogleCollaborationSetup(googleConfig), error: '' } }
    catch (caught) { return { folderId: '', transport: 'drive_json' as const, error: caught instanceof Error ? caught.message : String(caught) } }
  })
  const [clientId, setClientId] = useState(googleConfig?.google_client_id ?? '')
  const [folderId, setFolderId] = useState(initial.folderId)
  const [account, setAccount] = useState('')
  const [rows, setRows] = useState<Array<{ id: string; name: string }>>([])
  const [pageToken, setPageToken] = useState<string>()
  const [preview, setPreview] = useState<{ record: SharedRevision; markdown: string; hash: string; conflict: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initial.error)
  const [message, setMessage] = useState('')
  const [pollConsent, setPollConsent] = useState(false)
  const [docsId, setDocsId] = useState('')
  const [docsConsent, setDocsConsent] = useState(false)
  const [docsPreview, setDocsPreview] = useState<{ markdown: string; hash: string; warnings: string[]; title: string } | null>(null)
  const [transport, setTransport] = useState<CollaborationTransport>(initial.transport)
  const [folders, setFolders] = useState<GoogleResource[] | null>(null)
  const [folderPage, setFolderPage] = useState<string>()
  const [documents, setDocuments] = useState<GoogleResource[] | null>(null)
  const [documentPage, setDocumentPage] = useState<string>()
  const [newFolderName, setNewFolderName] = useState('')
  const folderTokens = useRef(new Set<string>())
  const documentTokens = useRef(new Set<string>())
  const revisionTokens = useRef(new Set<string>())
  const polling = useCollaborationPolling(folderId, vaultId, path, transport, result => {
    revisionTokens.current.clear(); revisionTokens.current.add('')
    setRows(appendGoogleResources([], result.files)); setPageToken(result.nextPageToken)
  })
  const epoch = useRef(0)
  const base = useRef<{ path: string; markdown: string } | null>(null)
  const peer = useRef<string>(crypto.randomUUID())
  const occupied = useRef(false)
  const operation = useRef(0)
  const accountReadGeneration = useRef(0)
  const accountOrigin = useRef<object>({})
  const setupVault = useRef(vaultId)
  // These resets invalidate provider previews when their owning vault changes.
  // They must finish before another operation can consume the previous context.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (setupVault.current === vaultId) return
    setupVault.current = vaultId
    epoch.current++; operation.current++; occupied.current = false; setBusy(false)
    setFolders(null); setFolderPage(undefined); folderTokens.current.clear()
    setNewFolderName(''); setClientId(googleConfig?.google_client_id ?? '')
    try {
      const saved = parseGoogleCollaborationSetup(googleConfig)
      setFolderId(saved.folderId); setTransport(saved.transport); setError(''); setMessage('')
    } catch (caught) {
      setFolderId(''); setTransport('drive_json')
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }, [vaultId, googleConfig])
  /* eslint-enable react-hooks/set-state-in-effect */
  const stopPolling = polling.stop
  useEffect(() => {
    let mounted = true
    const loadAccount = () => {
      const generation = ++accountReadGeneration.current
      void collaborationGetAccount().then(email => { if (mounted && generation === accountReadGeneration.current) setAccount(email ?? '') }).catch(caught => {
        if (mounted && generation === accountReadGeneration.current) setError(caught instanceof Error ? caught.message : String(caught))
      })
    }
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<{ service?: string; origin?: unknown }>).detail
      if (detail?.service !== 'drive' || detail.origin === accountOrigin.current) return
      epoch.current++
      operation.current++; occupied.current = false
      stopPolling()
      setAccount(''); setRows([]); setPreview(null); setDocsPreview(null); setBusy(false)
      setFolders(null); setFolderPage(undefined); setDocuments(null); setDocumentPage(undefined)
      setPageToken(undefined); setDocsId(''); setPollConsent(false); setDocsConsent(false)
      folderTokens.current.clear(); documentTokens.current.clear(); revisionTokens.current.clear()
      base.current = null; peer.current = crypto.randomUUID()
      setMessage(copy.accountChanged)
      loadAccount()
    }
    loadAccount()
    window.addEventListener('scriptor:google-account-changed', changed)
    return () => { mounted = false; window.removeEventListener('scriptor:google-account-changed', changed) }
  }, [stopPolling, copy.accountChanged])
  // Discard note/folder-owned state as one synchronous context transition.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    epoch.current++
    operation.current++; occupied.current = false; setBusy(false)
    setRows([]); setPageToken(undefined); setPreview(null); setDocsPreview(null)
    setDocuments(null); setDocumentPage(undefined); setDocsId(''); setDocsConsent(false); setPollConsent(false)
    documentTokens.current.clear(); revisionTokens.current.clear()
    base.current = null
    peer.current = crypto.randomUUID()
  }, [path, vaultId, folderId])
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    let live = true
    base.current = null
    peer.current = crypto.randomUUID()
    if (!vaultId || !folderId || !path || !account) return
    const current = epoch.current
    void Promise.resolve().then(() => {
      if (!live || current !== epoch.current) return
      const saved = localStorage.getItem(googleCollaborationMappingKey(account, vaultId, folderId, path))
      if (saved) {
        const mapping = parseCollaborationMapping(saved, vaultId, folderId, path)
        base.current = { path, markdown: mapping.markdown }; peer.current = mapping.peerId
      }
    }).catch(() => {
      if (live && current === epoch.current) setError('The saved collaboration ancestor could not be loaded. Incoming differences will require explicit review; no shared content will be discarded.')
    })
    return () => { live = false }
  }, [path, vaultId, folderId, account])
  useEffect(() => () => { epoch.current++ }, [])
  function remember(markdown: string): string {
    if (!path || !vaultId) return ''
    base.current = { path, markdown }
    try {
      const raw = JSON.stringify({ schema: 'scriptor.collaboration.mapping.v1', vaultId, folderId, path, peerId: peer.current, markdown })
      parseCollaborationMapping(raw, vaultId, folderId, path)
      localStorage.setItem(googleCollaborationMappingKey(account, vaultId, folderId, path), raw)
      return ''
    } catch { return ' The action completed, but its ancestor could not be cached on this device. Review incoming differences explicitly after reopening.' }
  }
  async function run(action: (current: number) => Promise<void>) {
    if (occupied.current) return
    occupied.current = true
    const serial = ++operation.current
    const current = epoch.current
    setBusy(true); setError(''); setMessage('')
    try { await action(current) }
    catch (reason) { if (epoch.current === current) setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { if (serial === operation.current) { occupied.current = false; if (epoch.current === current) setBusy(false) } }
  }
  async function list(current: number, next?: string) {
    if (!next) revisionTokens.current.clear()
    const result = await collaborationList(vaultId!, folderId, next, transport)
    if (epoch.current !== current) return
    try { acceptGoogleResourcePage(next, result.nextPageToken, revisionTokens.current) }
    catch (caught) { setPageToken(undefined); throw new Error(caught instanceof Error && caught.message.includes('ten pages') ? copy.pageLimit : copy.repeatedPage, { cause: caught }) }
    setRows(previous => appendGoogleResources(next ? previous : [], result.files))
    setPageToken(result.nextPageToken)
  }
  function selectFolder(id: string) {
    if (id === folderId) return
    epoch.current++; operation.current++; occupied.current = false; setBusy(false)
    polling.stop()
    setFolderId(id); setPreview(null); setRows([]); setPageToken(undefined)
    setPollConsent(false); setDocsConsent(false); setDocsPreview(null); setDocsId('')
    setDocuments(null); setDocumentPage(undefined); documentTokens.current.clear()
  }
  async function browseResources(current: number, kind: 'folders' | 'docs', next: boolean) {
    const token = next ? kind === 'folders' ? folderPage : documentPage : undefined
    const seen = kind === 'folders' ? folderTokens.current : documentTokens.current
    if (!next) seen.clear()
    const result = kind === 'folders' ? await collaborationListFolders(vaultId!, token) : await collaborationListDocs(vaultId!, folderId, token)
    if (epoch.current !== current) return
    try { acceptGoogleResourcePage(token, result.nextPageToken, seen) }
    catch (caught) {
      if (kind === 'folders') setFolderPage(undefined); else setDocumentPage(undefined)
      throw new Error(caught instanceof Error && caught.message.includes('ten pages') ? copy.pageLimit : copy.repeatedPage, { cause: caught })
    }
    if (kind === 'folders') { setFolders(previous => appendGoogleResources(next ? previous ?? [] : [], result.files)); setFolderPage(result.nextPageToken) }
    else { setDocuments(previous => appendGoogleResources(next ? previous ?? [] : [], result.files)); setDocumentPage(result.nextPageToken) }
  }
  async function persistSetup() {
    if (!vaultId) throw new Error(copy.openVault)
    parseGoogleCollaborationSetup({ google_drive_folder_id: folderId, google_drive_transport: transport })
    await mutateVaultConfig(current => ({ ...current, calendar_sync: { ...DEFAULT_VAULT_CONFIG.calendar_sync!, ...current.calendar_sync, google_client_id: clientId.trim() || current.calendar_sync?.google_client_id || null, google_drive_folder_id: folderId || null, google_drive_transport: transport } }), vaultId)
  }
  return <UnifiedPanelShell title="Drive collaboration" ariaLabel="Drive collaboration" helpTopic="integrations" onClose={onClose} wide>
    <div className="collaboration-panel">
      <p>Share immutable Markdown revisions in a Google Drive folder. Review incoming changes before applying them. Overlapping edits retain local, base and remote text for resolution.</p>
      <p>The Google sign-in requests Drive access. Scriptor confines these transfers to the folder you enter. Your credentials stay in the operating-system keychain.</p>
      <p>The last shared ancestor and this note’s peer identity are cached on this device, scoped to the confirmed Google account, vault and Drive folder. This cache includes note text; it is separate from your Markdown files and credentials.</p>
      <label>Revision transport<select aria-label="Revision transport" value={transport} disabled={busy || polling.starting} onChange={event => { polling.stop(); setTransport(event.target.value as CollaborationTransport); setPollConsent(false); setRows([]); setPageToken(undefined); setPreview(null) }}><option value="drive_json">Drive JSON revision records</option><option value="google_docs">Google Docs as an opaque Markdown tunnel</option></select></label>
      {transport === 'google_docs' && <p>Google Docs hosts schema-marked, checksum-verified copies of the Markdown revision bytes. Scriptor creates new records and never edits previous records. Do not edit their encoded bodies in Google Docs: edited markers, checksums, extra tabs or non-text blocks are rejected. Local Markdown remains the writing surface. Embedded asset files are not synchronized by this transport.</p>}
      <label>Google OAuth desktop client ID<input value={clientId} onChange={event => setClientId(event.target.value)} disabled={busy} autoComplete="off" /></label>
      <div className="collaboration-actions">
        <button disabled={busy || polling.active || polling.starting || !clientId.trim()} onClick={() => void run(async current => {
          const value = await collaborationConnect(clientId.trim())
          accountReadGeneration.current++
          window.dispatchEvent(new CustomEvent('scriptor:google-account-changed', { detail: { service: 'drive', origin: current === epoch.current ? accountOrigin.current : {} } }))
          if (current !== epoch.current) return
          setAccount(value)
          setRows([]); setPageToken(undefined); setPreview(null); setDocsPreview(null)
          setFolders(null); setFolderPage(undefined); setDocuments(null); setDocumentPage(undefined); setDocsId('')
          setPollConsent(false); setDocsConsent(false)
          folderTokens.current.clear(); documentTokens.current.clear(); revisionTokens.current.clear()
          base.current = null; peer.current = crypto.randomUUID()
          await persistSetup()
          if (current === epoch.current) { setMessage(copy.saved); await onApplied() }
        })}>Connect Google Drive</button>
        <button disabled={busy || polling.starting} onClick={() => void run(async current => {
          polling.stop(); await collaborationDisconnect()
          accountReadGeneration.current++
          window.dispatchEvent(new CustomEvent('scriptor:google-account-changed', { detail: { service: 'drive', origin: current === epoch.current ? accountOrigin.current : {} } }))
          if (current !== epoch.current) return
          setAccount(''); setRows([]); setPreview(null); setDocsPreview(null); setFolders(null); setDocuments(null)
          setFolderPage(undefined); setDocumentPage(undefined); setPageToken(undefined); setDocsId('')
          setPollConsent(false); setDocsConsent(false); folderTokens.current.clear(); documentTokens.current.clear(); revisionTokens.current.clear()
          base.current = null; peer.current = crypto.randomUUID()
          setMessage(copy.removed)
        })}>Remove saved credential</button>
      </div>
      <section aria-label="Shared revision polling">
        <p>Optional automatic checks read the newest 100 revision records, at most once every 30 seconds, for up to 15 minutes or 30 checks. Checks stop when this panel closes, its note or vault changes, the window is hidden, or three checks fail. Existing merge previews and local notes remain unchanged.</p>
        <label><input type="checkbox" checked={pollConsent} disabled={polling.active || polling.starting} onChange={event => setPollConsent(event.target.checked)} />Allow this bounded read-only polling session for the selected folder</label>
        <button disabled={busy || polling.active || polling.starting || !pollConsent || !folderId || !vaultId || !account} onClick={() => void polling.start()}>Start automatic checks</button>
        {(polling.active || polling.starting) && <button onClick={polling.stop}>Stop automatic checks</button>}
        {polling.status && <p role="status">{polling.status}</p>}{polling.error && <p role="alert">{polling.error}</p>}
      </section>
      {account && <p>Connected: {account}</p>}
      <CollaborationResources kind="folders" resources={folders} selectedId={folderId} busy={busy || !vaultId} canAccess={Boolean(account)} hasMore={Boolean(folderPage)} onSelect={selectFolder}
        onBrowse={next => void run(current => browseResources(current, 'folders', next))} newFolderName={newFolderName} onNameChange={setNewFolderName}
        onCreate={() => void run(async current => {
          const folder = await collaborationCreateFolder(vaultId!, newFolderName.trim())
          if (current !== epoch.current) return
          setFolders(previous => appendGoogleResources(previous ?? [], [folder])); setNewFolderName(''); setBusy(false)
          selectFolder(folder.id); setMessage(copy.folderCreated)
        })}
        onSave={() => void run(async current => { await persistSetup(); if (current === epoch.current) { setMessage(copy.bindingSaved); await onApplied() } })} />
      <p>Mapped local note: <bdi>{path ?? 'Select a note'}</bdi></p>
      <div className="collaboration-actions">
        <button disabled={busy || !folderId || !path || !vaultId || !account} onClick={() => void run(async current => {
          const note = await vaultReadNote(path!)
          if (note.metadata.vault_id !== vaultId) throw new Error('Vault changed; reopen collaboration.')
          if (current !== epoch.current) return
          const pendingKey = pendingSharedRevisionKey(account, vaultId!, folderId, path!, transport)
          const existingPending = localStorage.getItem(pendingKey)
          const allocatedId = existingPending === null && transport === 'drive_json'
            ? await collaborationGenerateRevisionId(vaultId!, folderId)
            : crypto.randomUUID()
          if (current !== epoch.current) return
          const candidate: SharedRevision = { schema: 'scriptor.collaboration.v1', id: allocatedId, document: path!, peer_id: peer.current,
            base_markdown: sharedRevisionBase(base.current, path!), markdown: note.markdown, created_at: new Date().toISOString() }
          const record = preparePendingSharedRevision(localStorage, pendingKey, candidate)
          // Account/vault/folder/path ownership is encoded in the storage key.
          // Preserve the same peer and revision UUID on retries after timeouts.
          peer.current = record.peer_id
          await collaborationAppend(vaultId!, folderId, record, transport)
          localStorage.removeItem(pendingKey)
          if (current === epoch.current) setMessage(`Revision shared. Local note was unchanged.${remember(note.markdown)}`)
        })}>Share current saved revision</button>
        <button disabled={busy || !folderId || !vaultId || !account} onClick={() => void run(current => list(current))}>Refresh shared revisions</button>
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
        {folderId && <CollaborationResources kind="docs" resources={documents} selectedId={docsId} busy={busy || !vaultId} canAccess={Boolean(account)} hasMore={Boolean(documentPage)} onSelect={id => { setDocsId(id); setDocsPreview(null); setDocsConsent(false) }} onBrowse={next => void run(current => browseResources(current, 'docs', next))} />}
        <p>Import a reviewed text copy from a Google document in this folder, or create a new plain-text Google document from the saved Markdown. This preserves text, not rich document fidelity. Comments, suggestions, history, layout, embedded media and access permissions do not transfer. Markdown syntax remains literal in exported plain-text copies. Existing Google documents are never overwritten.</p>
        <label>Google document ID<input value={docsId} disabled={busy} onChange={event => { setDocsId(event.target.value.trim()); setDocsPreview(null); setDocsConsent(false) }} autoComplete="off" /></label>
        <button disabled={busy || !folderId || !docsId || !path || !vaultId || !account} onClick={() => void run(async current => {
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
        <button disabled={busy || !docsConsent || !folderId || !path || !vaultId || !account} onClick={() => void run(async current => {
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

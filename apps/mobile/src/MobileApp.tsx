import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import * as bridge from './bridge'
import { draftKey, parseDraft } from './storage'
import type { Metadata, PdfExport } from './storage'

const MarkdownEditor = lazy(() => import('@scriptor/editor/codemirror').then(module => ({ default: module.MarkdownEditor })))

export function MobileApp() {
  const [notes, setNotes] = useState<Metadata[]>([])
  const [query, setQuery] = useState('')
  const [path, setPath] = useState<string | null>(null)
  const [newPath, setNewPath] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [hash, setHash] = useState('<missing>')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Opening offline workspace…')
  const [truncated, setTruncated] = useState(false)
  const [revisions, setRevisions] = useState<bridge.Revision[]>([])
  const [selectedRevision, setSelectedRevision] = useState('')
  const [revisionText, setRevisionText] = useState('')
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const historyDialog = useRef<HTMLDialogElement>(null)
  const licensesDialog = useRef<HTMLDialogElement>(null)
  const exporting = useRef(false)
  const [pdfResult, setPdf] = useState<{ result: PdfExport; path: string; hash: string } | null>(null)
  const pdf = pdfResult?.path === path && pdfResult.hash === hash ? pdfResult.result : null
  const [licenses, setLicenses] = useState('')
  const sequence = useRef(0)
  const ready = useRef(false)
  const queryRef = useRef(query)
  const pending = useRef(0)
  const invalidate = useCallback(() => { ++sequence.current }, [])
  useEffect(() => { queryRef.current = query }, [query])

  const run = useCallback(async (action: () => Promise<void>) => {
    ++pending.current; setError(''); setBusy(true)
    try { await action() } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { --pending.current; setBusy(pending.current > 0) }
  }, [])

  const refresh = useCallback(async (searchQuery: string) => {
    const current = ++sequence.current
    const result = await bridge.search(searchQuery)
    if (current !== sequence.current) return
    setNotes(result.notes); setTruncated(result.truncated); setStatus('Offline workspace ready')
  }, [])

  useEffect(() => {
    let mounted = true
    void run(async () => { await bridge.lifecycle(true); ready.current = true; if (mounted) await refresh('') })
    const visibility = () => {
      ++sequence.current
      void bridge.lifecycle(document.visibilityState === 'visible').then(() => {
        if (mounted && document.visibilityState === 'visible') void run(() => refresh(queryRef.current))
      }).catch(cause => { if (mounted) setError(String(cause)) })
    }
    document.addEventListener('visibilitychange', visibility)
    return () => { mounted = false; document.removeEventListener('visibilitychange', visibility); invalidate() }
  }, [refresh, run, invalidate])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const changed = () => setDark(media.matches)
    media.addEventListener('change', changed)
    return () => media.removeEventListener('change', changed)
  }, [])
  useEffect(() => {
    if (!ready.current) return
    const timer = window.setTimeout(() => void run(() => refresh(query)), 200)
    return () => window.clearTimeout(timer)
  }, [query, refresh, run])

  const edit = (text: string) => {
    setMarkdown(text); setDirty(true)
    if (!path) return
    try {
      localStorage.setItem(draftKey(path), JSON.stringify({ markdown: text, baseHash: hash }))
      setStatus('Recovery draft saved on this device')
    } catch { setError('Device draft storage is full. Save this note before leaving the app.') }
  }

  const open = (notePath: string) => run(async () => {
    const note = await bridge.read(notePath)
    const draft = parseDraft(localStorage.getItem(draftKey(notePath)))
    setPath(notePath); setMarkdown(draft?.markdown ?? note.markdown)
    setHash(draft?.baseHash ?? note.metadata.content_hash); setDirty(Boolean(draft))
    setStatus(draft ? 'Recovered an unsaved draft. Save checks for newer disk changes.' : 'Saved on this device')
  })

  const save = () => run(async () => {
    if (!path) return
    const text = markdown
    const result = await bridge.save(path, text, hash)
    setHash(result.content_hash)
    // Editor is read-only during save, so the saved body is the displayed body.
    setDirty(false); localStorage.removeItem(draftKey(path)); setStatus('Saved on this device')
  })

  const create = () => run(async () => {
    if (!newPath.trim()) throw new Error('Enter a Markdown filename, such as Research/paper.md')
    const result = await bridge.save(newPath.trim(), '# New note\n', '<missing>')
    setNewPath(''); setPath(result.path); setMarkdown('# New note\n'); setHash(result.content_hash); setDirty(false); setStatus('Created on this device')
  })

  const exportPdf = async () => {
    if (!path || dirty || busy || exporting.current) return
    exporting.current = true
    setPdf(null)
    try { await run(async () => { setPdf({ result: await bridge.exportPdf(path, hash), path, hash }) }) }
    finally { exporting.current = false }
  }

  return <div className="mobile-app">
    <header><h1>Scriptor</h1><span>Offline writing</span></header>
    <main>
      {!path ? <section aria-label="Notes">
        <label htmlFor="mobile-search">Search Markdown</label>
        <input id="mobile-search" type="search" value={query} onChange={event => setQuery(event.target.value)} maxLength={512} />
        <form onSubmit={event => { event.preventDefault(); void create() }}>
          <label htmlFor="mobile-new">New note path</label>
          <div className="mobile-create"><input id="mobile-new" dir="auto" value={newPath} onChange={event => setNewPath(event.target.value)} placeholder="Research/paper.md" maxLength={1024} /><button disabled={busy} type="submit">Create</button></div>
        </form>
        <ul className="mobile-notes">{notes.map(note => <li key={note.path}><button disabled={busy} onClick={() => void open(note.path)}><strong dir="auto">{note.title}</strong><small dir="auto">{note.path}</small></button></li>)}</ul>
        {!busy && notes.length === 0 && <p>{query ? 'No matching Markdown notes.' : 'Create your first note. Files stay on this device.'}</p>}
        {truncated && <p role="status">Search reached the mobile scan limit. Narrow your search or organize this vault on desktop.</p>}
      </section> : <section className="mobile-editor" aria-label="Writing workspace">
        <div className="mobile-editor-bar"><button disabled={busy} onClick={() => { setPath(null); void run(() => refresh(query)) }}>Notes</button><strong dir="auto">{path}</strong><button disabled={busy || !dirty} onClick={() => void save()}>Save</button></div>
        <p className="mobile-note-state">{dirty ? 'Unsaved changes · recovery draft retained' : 'Saved Markdown'}</p>
        <Suspense fallback={<p role="status">Opening editor…</p>}><MarkdownEditor value={markdown} onChange={edit} readOnly={busy} showLineNumbers={false} spellcheck languageTool={false} editorTheme={dark ? 'dark' : 'light'} /></Suspense>
        <button disabled={busy || dirty} title={dirty ? 'Save the current draft before viewing history' : undefined} onClick={() => void run(async () => { setRevisions(await bridge.history(path)); setSelectedRevision(''); setRevisionText(''); setConfirmRestore(false); historyDialog.current?.showModal() })}>Revision history</button>
        <section aria-label="PDF export">
          <div className="mobile-pdf-actions"><button disabled={busy || dirty} onClick={() => void exportPdf()}>Save PDF</button><button disabled={busy} onClick={() => void run(async () => { setLicenses(await bridge.pdfLicenses()); licensesDialog.current?.showModal() })}>Font licenses</button></div>
          <p>{dirty ? 'Save your current draft before exporting PDF.' : 'Create a PDF offline, then choose where to save it.'}</p>
          {pdf && <div role="status" aria-live="polite"><p dir="auto">{pdf.saved ? `${pdf.filename} saved · ${pdf.page_count} ${pdf.page_count === 1 ? 'page' : 'pages'}` : 'PDF save cancelled'}</p>{pdf.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
        </section>
        <details><summary>Export Markdown</summary><p>Select and copy the ordinary Markdown below to another app.</p><textarea aria-label="Export Markdown" readOnly dir="auto" value={markdown} /></details>
      </section>}
      {error && <div role="alert"><p>{error}</p><button disabled={busy} onClick={() => void run(async () => { await bridge.lifecycle(true, true); await refresh(query) })}>Refresh session</button></div>}
      {busy && <button onClick={() => { ++sequence.current; void bridge.lifecycle(true, true).then(() => setStatus('Operation cancelled; an atomic save already in progress can finish.')) }}>Cancel operation</button>}
    </main>
    <footer role="status" aria-live="polite">{status}</footer>
    <dialog ref={historyDialog} aria-labelledby="mobile-history-title"><h2 id="mobile-history-title">Revision history</h2><button autoFocus onClick={() => historyDialog.current?.close()}>Close</button>
      {!revisions.length && <p>No earlier saved revisions.</p>}
      <ul>{revisions.map(item => <li key={item.id}><button onClick={() => void run(async () => { setRevisionText(await bridge.revision(path ?? '', item.id)); setSelectedRevision(item.id); setConfirmRestore(false) })}><time>{new Date(item.saved_at).toLocaleString()}</time><small dir="auto">{item.preview}</small></button></li>)}</ul>
      {selectedRevision && <><pre dir="auto">{revisionText}</pre><button disabled={busy} onClick={() => {
        if (!confirmRestore) { setConfirmRestore(true); return }
        void run(async () => { if (!path) return; const metadata = await bridge.restore(path, selectedRevision, hash); setHash(metadata.content_hash); setMarkdown(revisionText); setDirty(false); setStatus('Revision restored; previous content remains in history'); historyDialog.current?.close() })
      }}>{confirmRestore ? 'Confirm restore' : 'Restore selected revision'}</button></>}
    </dialog>
    <dialog ref={licensesDialog} aria-labelledby="mobile-pdf-licenses"><h2 id="mobile-pdf-licenses">PDF font licenses</h2><button autoFocus onClick={() => licensesDialog.current?.close()}>Close</button><pre>{licenses}</pre></dialog>
  </div>
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { sourceFileCreate, sourceFileRead, sourceFileSave } from '../bridge/commands/source_files'
import { SOURCE_FILE_LIMIT, sourceLanguage, type SourceDocument } from '../lib/sourceFile'
import { useLatexCompiler, type LatexCompilerConfig } from '../hooks/useLatexCompiler'
import { OverleafPanel } from './OverleafPanel'
import '../styles/components/source-file-editor.css'

interface Props {
  expectedVaultId: string
  path: string | null
  onClose: () => void
  onSaved?: (path: string) => void | Promise<void>
  latexConfig?: LatexCompilerConfig
  onCompileTex?: (path: string) => void | Promise<void>
}
type Pending = { path?: string | null; close?: boolean; reload?: boolean; resolve?: (value: boolean) => void }
export function SourceFileEditor({ expectedVaultId, path, onClose, onSaved, latexConfig, onCompileTex }: Props) {
  const [document, setDocument] = useState<SourceDocument | null>(null)
  const [draft, setDraft] = useState('')
  const [filePath, setFilePath] = useState(path ?? 'main.tex')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)
  const [compileConfirmed, setCompileConfirmed] = useState(false)
  const [overleafOpen, setOverleafOpen] = useState(false)
  const generation = useRef(0)
  const decisionRef = useRef<HTMLDivElement>(null)
  const dirty = document ? draft !== document.content : draft !== ''
  const compiler = useLatexCompiler({ config: latexConfig })
  const compiling = compiler.activeJob !== null
  const navigationBusy = busy || compiling || overleafOpen
  const current = useRef({ dirty, busy: navigationBusy, pending, overleafOpen })
  useLayoutEffect(() => { current.current = { dirty, busy: navigationBusy, pending, overleafOpen } }, [dirty, navigationBusy, pending, overleafOpen])
  const replacePending = useCallback((next: Pending) => {
    current.current.pending?.resolve?.(false)
    current.current.pending = next
    setPending(next)
  }, [])
  useEffect(() => {
    if (pending && !navigationBusy) decisionRef.current?.querySelector<HTMLButtonElement>('button:last-child')?.focus()
  }, [pending, navigationBusy])
  const load = useCallback(async (nextPath: string | null) => {
    const epoch = ++generation.current
    setError(null); setStatus(''); setCompileConfirmed(false)
    setOverleafOpen(false)
    if (!nextPath) { setDocument(null); setDraft(''); setFilePath('main.tex'); return }
    setBusy(true)
    try {
      const next = await sourceFileRead(expectedVaultId, nextPath)
      if (epoch !== generation.current) return
      setDocument(next); setDraft(next.content); setFilePath(next.path)
    } catch (caught) { if (epoch === generation.current) setError(String(caught)) }
    finally { if (epoch === generation.current) setBusy(false) }
  }, [expectedVaultId])
  const requestedPath = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (requestedPath.current === path) return
    requestedPath.current = path
    if (current.current.dirty || current.current.busy) replacePending({ path })
    else void load(path)
  }, [path, load, replacePending])
  useEffect(() => () => { generation.current += 1; current.current.pending?.resolve?.(false) }, [])
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (current.current.dirty || current.current.busy) { event.preventDefault(); event.returnValue = '' }
    }
    const changeVault = (event: Event) => {
      if (!current.current.dirty && !current.current.busy) return
      const detail = (event as CustomEvent<{ waitUntil: (promise: Promise<boolean>) => void }>).detail
      if (!detail?.waitUntil) return
      if (current.current.overleafOpen) { detail.waitUntil(Promise.resolve(false)); return }
      if (current.current.pending) { detail.waitUntil(Promise.resolve(false)); return }
      detail.waitUntil(new Promise<boolean>(resolve => replacePending({ resolve })))
    }
    window.addEventListener('beforeunload', unload)
    window.addEventListener('scriptor:vault-change-starting', changeVault)
    return () => { window.removeEventListener('beforeunload', unload); window.removeEventListener('scriptor:vault-change-starting', changeVault) }
  }, [replacePending])
  const save = async (): Promise<boolean> => {
    if (busy || compiling || !sourceLanguage(filePath)) return false
    const epoch = generation.current
    setBusy(true); setError(null); setCompileConfirmed(false)
    try {
      const next = document ? await sourceFileSave(document, draft) : await sourceFileCreate(expectedVaultId, filePath, draft)
      if (epoch !== generation.current) return false
      setDocument(next); setDraft(next.content); setFilePath(next.path); setStatus(document ? 'Saved. The previous version has a recovery copy.' : 'File created.')
      try { await onSaved?.(next.path) } catch { setStatus('File saved. The file list could not refresh; reopen it to refresh.') }
      return true
    } catch (caught) { if (epoch === generation.current) setError(String(caught)); return false }
    finally { if (epoch === generation.current) setBusy(false) }
  }
  const finishPending = async (decision: 'save' | 'discard' | 'cancel') => {
    const next = current.current.pending
    if (!next || current.current.busy) return
    if (decision === 'save' && !(await save())) return
    if (current.current.pending !== next) return
    current.current.pending = null
    setPending(null)
    if (decision === 'cancel') { next.resolve?.(false); return }
    next.resolve?.(true)
    if (next.close) onClose()
    else if ('path' in next) void load(next.path ?? null)
    else if (next.reload && document) void load(document.path)
  }
  const requestClose = () => {
    if (dirty || busy || compiling) replacePending({ close: true })
    else onClose()
  }
  const compile = async () => {
    if (!document || dirty || busy || compiling || !compileConfirmed) return
    setCompileConfirmed(false); setError(null)
    try {
      if (onCompileTex) await onCompileTex(document.path)
      else await compiler.compile({ inputPath: document.path })
    } catch (caught) { setError(String(caught)) }
  }
  const lineEnding = document?.content.includes('\r\n') ? '\r\n' : '\n'
  const lastJob = compiler.jobs[0]
  return <section className="source-file-editor" aria-label="Source file editor" data-help-topic="editor">
    <header><div><h2>Source files</h2><p>Edit LaTeX, code, and text files in your vault.</p></div><button type="button" disabled={Boolean(pending) || overleafOpen} onClick={requestClose}>Close editor</button></header>
    <div className="source-file-toolbar" inert={Boolean(pending) || overleafOpen}>
      <label>File path<input value={filePath} disabled={Boolean(document) || busy || compiling} onChange={event => { setFilePath(event.target.value); setCompileConfirmed(false) }} placeholder="research/main.tex" /></label>
      <button type="button" disabled={busy || compiling || !sourceLanguage(filePath)} onClick={() => { if (dirty) replacePending({ path: filePath }); else void load(filePath) }}>Open file</button>
      <button type="button" disabled={busy || compiling} onClick={() => { if (dirty) replacePending({ path: null }); else void load(null) }}>New file</button>
      <button type="button" disabled={busy || compiling || !sourceLanguage(filePath) || Boolean(document && !dirty)} onClick={() => { void save() }}>{busy ? 'Working…' : document ? 'Save file' : 'Create file'}</button>
    </div>
    <p className="source-file-status" role="status">{document?.path ?? 'New file'} · {sourceLanguage(filePath) ?? 'Choose a supported file extension'} · {dirty ? 'Unsaved changes' : document ? 'Saved' : 'Not created'} · {new TextEncoder().encode(draft).length.toLocaleString()} / {SOURCE_FILE_LIMIT.toLocaleString()} bytes</p>
    {error && <p role="alert">{error}</p>}
    {status && <p role="status">{status}</p>}
    <label className="source-file-content">File content<textarea aria-label="Source file content" value={draft} disabled={busy || compiling || Boolean(pending) || overleafOpen} spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap="off" dir="ltr" onChange={event => { setDraft(event.target.value.replace(/\r?\n/g, lineEnding)); setCompileConfirmed(false); setStatus('') }} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void save() } }} /></label>
    {document?.language === 'latex' && <fieldset disabled={busy || compiling || dirty || Boolean(pending) || overleafOpen}><legend>Compile saved LaTeX</legend><p>Tectonic runs on the saved file. It may download missing TeX packages.</p><label><input type="checkbox" checked={compileConfirmed} onChange={event => setCompileConfirmed(event.target.checked)} /> I reviewed the saved source and want to compile it.</label><button type="button" disabled={!compileConfirmed} onClick={() => { void compile() }}>Compile PDF</button></fieldset>}
    {compiling && <button type="button" onClick={compiler.cancelJob}>Cancel compilation</button>}
    {lastJob && <div aria-live="polite"><p>Compilation: {lastJob.status}{lastJob.outputPath ? ` · ${lastJob.outputPath}` : ''}</p>{lastJob.stderr && <pre>{lastJob.stderr}</pre>}</div>}
    {document && /\.(tex|ltx|bib)$/i.test(document.path) && <button type="button" disabled={dirty || busy || compiling || Boolean(pending) || overleafOpen} onClick={() => setOverleafOpen(true)}>Open Overleaf sync</button>}
    {overleafOpen && document && <OverleafPanel document={document} onClose={() => setOverleafOpen(false)} onApplied={next => {
      if (next.vault_id !== expectedVaultId || next.path !== document.path) { setError('Synced source belongs to another file. Reload before continuing.'); return }
      setDocument(next); setDraft(next.content); setCompileConfirmed(false); setOverleafOpen(false); setStatus('Synced source saved.'); void Promise.resolve().then(() => onSaved?.(next.path)).catch(() => setStatus('Synced source saved. Reopen the file list to refresh.'))
    }} />}
    {pending && <div ref={decisionRef} className="source-file-decision" role="alertdialog" aria-modal="true" aria-label="Unsaved source changes" onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); void finishPending('cancel') }
      if (event.key === 'Tab') {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
        const first = buttons[0], last = buttons.at(-1)
        if (event.shiftKey && event.target === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && event.target === last) { event.preventDefault(); first?.focus() }
      }
    }}><p>{navigationBusy ? 'Finish the current operation or close the sync panel before leaving.' : 'Keep your changes before leaving this file?'}</p><button type="button" disabled={navigationBusy} onClick={() => { void finishPending('save') }}>Save and continue</button><button type="button" disabled={navigationBusy} onClick={() => { void finishPending('discard') }}>Discard and continue</button><button type="button" disabled={navigationBusy} onClick={() => { void finishPending('cancel') }}>Keep editing</button></div>}
    <button type="button" disabled={!document || busy || compiling || Boolean(pending) || overleafOpen} onClick={() => { if (dirty) replacePending({ reload: true }); else if (document) void load(document.path) }}>Reload saved file</button>
  </section>
}

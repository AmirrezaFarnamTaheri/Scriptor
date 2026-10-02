import { useEffect, useId, useMemo, useState } from 'react'
import { Network, Save } from 'lucide-react'
import { MarkdownPreview, GRAPHVIZ_NOTICES } from '@scriptor/renderer'
import { diagramDocument, type DiagramLanguage } from '../lib/researchStudio'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import { DiagramViewport } from './DiagramViewport'
import '../styles/components/research-studio.css'

export interface DiagramStudioPanelProps {
  onClose: () => void
  onSave: (title: string, markdown: string) => Promise<void>
  initialSource?: string
  renderPlantUmlLocal?: (source: string) => Promise<string | null>
  onOpenNote?: (path: string) => void
}

export function DiagramStudioPanel({ onClose, onSave, initialSource = 'flowchart LR\n  Evidence --> Draft\n  Draft --> Review', renderPlantUmlLocal, onOpenNote }: DiagramStudioPanelProps) {
  const sourceId = useId()
  const [source, setSource] = useState(initialSource)
  const [language, setLanguage] = useState<DiagramLanguage>('mermaid')
  const [title, setTitle] = useState('Research diagram')
  const [livePreview, setLivePreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [noteLinks, setNoteLinks] = useState('')
  const [rendered, setRendered] = useState({ language: 'mermaid' as DiagramLanguage, source: initialSource })
  const paths = useMemo(() => noteLinks.split(/\r?\n/).map(path => path.trim()).filter(Boolean), [noteLinks])
  const document = useMemo(() => {
    try { return { markdown: diagramDocument(language, source, paths), error: '' } }
    catch (error) { return { markdown: '', error: String(error instanceof Error ? error.message : error) } }
  }, [language, source, paths])
  const preview = useMemo(() => diagramDocument(rendered.language, rendered.source), [rendered])
  useEffect(() => {
    if (!livePreview || language === 'plantuml' || document.error) return
    const timer = window.setTimeout(() => setRendered({ language, source }), 500)
    return () => window.clearTimeout(timer)
  }, [document.error, language, livePreview, source])
  const save = async () => {
    if (!document.markdown || !title.trim() || busy) return
    setBusy(true)
    try { await onSave(title.trim(), document.markdown); setStatus('Diagram saved as a Markdown note.') }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Could not save diagram') }
    finally { setBusy(false) }
  }
  return <UnifiedPanelShell title="Diagram studio" subtitle="Render locally, inspect, then save the source as a portable note." icon={<Network size={18} />} ariaLabel="Diagram studio" helpTopic="preview" onClose={onClose} wide className="research-studio">
    <div className="research-controls">
      <label>Note title<input value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} disabled={busy} /></label>
      <div className="research-language"><label htmlFor={`${sourceId}-language`}>Language</label><select id={`${sourceId}-language`} value={language} onChange={(event) => setLanguage(event.target.value as DiagramLanguage)} disabled={busy}><option value="mermaid">Mermaid</option><option value="dot">Graphviz · DOT</option><option value="plantuml" disabled={!renderPlantUmlLocal}>PlantUML{!renderPlantUmlLocal ? ' · native renderer required' : ''}</option></select></div>
      <button type="button" className="toolbar-button" onClick={() => void save()} disabled={busy || !document.markdown || !title.trim()}><Save size={14} />{busy ? 'Saving…' : 'Save diagram note'}</button>
    </div>
    <div className="research-split">
      <div className="research-source"><label htmlFor={sourceId}>Diagram source</label><textarea id={sourceId} value={source} maxLength={65_536} spellCheck={false} disabled={busy} onChange={(event) => { setSource(event.target.value); setStatus('') }} /></div>
      <section className="research-render" aria-label="Live diagram preview">
        <button type="button" disabled={busy || !!document.error} onClick={() => setRendered({ language, source })}>Render diagram</button>
        <label className="research-toggle"><input type="checkbox" checked={livePreview} disabled={language === 'plantuml'} onChange={event => setLivePreview(event.target.checked)} /><span>Refresh local preview as I type</span></label>
        {(rendered.language !== language || rendered.source !== source) && <p role="status">Source changed. Render to refresh the preview.</p>}
        {document.error ? <p role="alert">{document.error}</p> : <DiagramViewport><MarkdownPreview markdown={preview} renderPlantUmlLocal={renderPlantUmlLocal} /></DiagramViewport>}
      </section>
    </div>
    <label>Related notes (one vault-relative .md path per line)<textarea dir="ltr" value={noteLinks} maxLength={8192} disabled={busy} onChange={event => setNoteLinks(event.target.value)} /></label>
    {!document.error && onOpenNote && <ul>{[...new Set(paths)].map(path => <li key={path}><button onClick={() => onOpenNote(path)}><bdi>{path}</bdi></button></li>)}</ul>}
    {status && <p role="status">{status}</p>}
    <details><summary>Graphviz licenses and source</summary><pre className="diagram-notices">{GRAPHVIZ_NOTICES}</pre></details>
  </UnifiedPanelShell>
}

import { useMemo, useState } from 'react'
import { Network, Save, ZoomIn, ZoomOut } from 'lucide-react'
import { MarkdownPreview } from '@scriptor/renderer'
import { diagramDocument, type DiagramLanguage } from '../lib/researchStudio'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import '../styles/components/research-studio.css'

export interface DiagramStudioPanelProps {
  onClose: () => void
  onSave: (title: string, markdown: string) => Promise<void>
  initialSource?: string
  renderPlantUmlLocal?: (source: string) => Promise<string | null>
}

export function DiagramStudioPanel({ onClose, onSave, initialSource = 'flowchart LR\n  Evidence --> Draft\n  Draft --> Review', renderPlantUmlLocal }: DiagramStudioPanelProps) {
  const [source, setSource] = useState(initialSource)
  const [language, setLanguage] = useState<DiagramLanguage>('mermaid')
  const [title, setTitle] = useState('Research diagram')
  const [zoom, setZoom] = useState(1)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const document = useMemo(() => {
    try { return { markdown: diagramDocument(language, source), error: '' } }
    catch (error) { return { markdown: '', error: String(error instanceof Error ? error.message : error) } }
  }, [language, source])
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
      <label>Language<select value={language} onChange={(event) => setLanguage(event.target.value as DiagramLanguage)} disabled={busy}><option value="mermaid">Mermaid</option><option value="plantuml" disabled={!renderPlantUmlLocal}>PlantUML{!renderPlantUmlLocal ? ' · native renderer required' : ''}</option></select></label>
      <button type="button" className="toolbar-button" onClick={() => void save()} disabled={busy || !document.markdown || !title.trim()}><Save size={14} />{busy ? 'Saving…' : 'Save diagram note'}</button>
    </div>
    <div className="research-split">
      <label className="research-source">Diagram source<textarea value={source} maxLength={65_536} spellCheck={false} disabled={busy} onChange={(event) => { setSource(event.target.value); setStatus('') }} /></label>
      <section className="research-render" aria-label="Live diagram preview">
        <div className="research-controls"><button type="button" className="icon-button" aria-label="Zoom out" disabled={zoom <= 0.5} onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}><ZoomOut size={16} /></button><button type="button" className="toolbar-button" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}% · Reset</button><button type="button" className="icon-button" aria-label="Zoom in" disabled={zoom >= 2} onClick={() => setZoom((value) => Math.min(2, value + 0.25))}><ZoomIn size={16} /></button></div>
        {document.error ? <p role="alert">{document.error}</p> : <div className="research-preview-scroll"><div style={{ zoom }}><MarkdownPreview markdown={document.markdown} renderPlantUmlLocal={renderPlantUmlLocal} /></div></div>}
      </section>
    </div>
    {status && <p role="status">{status}</p>}
  </UnifiedPanelShell>
}

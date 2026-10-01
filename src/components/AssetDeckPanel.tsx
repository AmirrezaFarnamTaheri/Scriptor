import { useMemo, useState } from 'react'
import { Files, BookOpen, FilePlus } from 'lucide-react'
import { annotationDocument, assetLink } from '../lib/researchStudio'
import { mediaKind } from '../lib/assetMedia'
import type { ReaderAnnotation } from './reader/useReaderStore'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import { EmbeddedPanelShell } from './chrome/EmbeddedPanelShell'
import '../styles/components/research-studio.css'

export interface ResearchAsset { path: string; name?: string; bytes?: number; usedBy: string[] }
export interface AssetDeckPanelProps {
  embedded?: boolean
  assets: ResearchAsset[]
  onClose: () => void
  onOpenAsset: (path: string) => void
  onOpenNote: (path: string) => void
  onCreateNote: (title: string, markdown: string) => Promise<void>
  annotations?: ReaderAnnotation[]
  activeAssetPath?: string
  usageComplete?: boolean
}

export function AssetDeckPanel({ assets, onClose, onOpenAsset, onOpenNote, onCreateNote, annotations = [], activeAssetPath, usageComplete = true, embedded = false }: AssetDeckPanelProps) {
  const Shell = embedded ? EmbeddedPanelShell : UnifiedPanelShell
  const [query, setQuery] = useState('')
  const [onlyUnused, setOnlyUnused] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const filtered = useMemo(() => assets.filter((asset) => (!onlyUnused || asset.usedBy.length === 0) && asset.path.toLowerCase().includes(query.trim().toLowerCase())), [assets, onlyUnused, query])
  const capture = async (asset: ResearchAsset, annotation?: ReaderAnnotation) => {
    const id = annotation?.id ?? asset.path
    setBusyId(id)
    try {
      const markdown = annotation ? annotationDocument(asset.path, annotation) : `# ${asset.name ?? asset.path.split('/').at(-1)}\n\n[Source](${assetLink(asset.path)})\n\n## Notes\n`
      await onCreateNote(annotation ? `Annotation ${annotation.id.slice(0, 8)}` : `Notes on ${asset.name ?? asset.path.split('/').at(-1)}`, markdown)
      setStatus('Linked research note created.')
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not create linked note') }
    finally { setBusyId(null) }
  }
  return <Shell title="Asset deck" subtitle={`${assets.length} vault assets · source files stay in the vault`} icon={<Files size={18} />} ariaLabel="Asset deck" helpTopic="reader" onClose={onClose} wide className="research-studio">
    <p>Usage reflects the derived link index. Rebuild the vault index after external file changes.{!usageComplete && ' Inventory reached its processing limit; usage counts are partial and unused filtering is unavailable.'}</p>
    <div className="research-controls"><label>Filter assets<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label><span>Unused assets only</span><input type="checkbox" checked={onlyUnused} disabled={!usageComplete} onChange={(event) => setOnlyUnused(event.target.checked)} /></label></div>
    <ul className="research-asset-list">
      {filtered.length === 0 && <li>No assets match. Import a PDF, EPUB, image, or other source into the vault.</li>}
      {filtered.slice(0, 500).map((asset) => <li key={asset.path}>
        <strong>{asset.name ?? asset.path.split('/').at(-1)}</strong><p>{asset.path}{asset.bytes !== undefined ? ` · ${asset.bytes.toLocaleString()} bytes` : ''} · {asset.usedBy.length} linked notes</p>
        <div className="research-controls"><button type="button" className="toolbar-button" disabled={mediaKind(asset.path) === null} title={mediaKind(asset.path) ? 'Open vault source preview' : 'Preview supports PDF, EPUB, raster images, MP3, WAV, Ogg and FLAC'} onClick={() => onOpenAsset(asset.path)}><BookOpen size={14} />Open source</button><button type="button" className="toolbar-button" disabled={busyId !== null} onClick={() => void capture(asset)}><FilePlus size={14} />Create linked note</button></div>
        {asset.usedBy.length > 0 && <details><summary>Used in {asset.usedBy.length} notes</summary><ul>{asset.usedBy.map((path) => <li key={path}><button type="button" className="toolbar-button" onClick={() => onOpenNote(path)}>{path}</button></li>)}</ul></details>}
        {activeAssetPath === asset.path && annotations.length > 0 && <details open><summary>Saved annotations</summary><ul>{annotations.map((annotation) => <li key={annotation.id}><blockquote>{annotation.quote}</blockquote>{annotation.body && <p>{annotation.body}</p>}<button type="button" className="toolbar-button" disabled={busyId !== null} onClick={() => void capture(asset, annotation)}>{busyId === annotation.id ? 'Creating…' : 'Create note from annotation'}</button></li>)}</ul></details>}
      </li>)}
    </ul>
    {filtered.length > 500 && <p>Showing the first 500 matches. Narrow the filter to find another source.</p>}
    {status && <p role="status">{status}</p>}
  </Shell>
}

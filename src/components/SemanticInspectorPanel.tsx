import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Orbit } from 'lucide-react'
import { isNativeBridgeAvailable } from '../bridge/platform'
import { semanticDeleteApiKey, semanticInspect, semanticSearch, semanticSetApiKey, semanticSync, type SemanticSearchHit } from '../bridge/commands/semantic'
import { vaultLoadConfig, vaultSaveConfig } from '../bridge/commands/vault'
import { projectSemanticPoints, type SemanticInspection } from '../lib/semanticInspector'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import type { VaultConfig } from '../types/vault'
import './semantic-inspector.css'

const SEMANTIC_INSPECTOR_LABELS = {
  title: 'Semantic Inspector', local: 'Index health and PCA are computed locally from stored vectors. Reindexing and similarity queries contact the selected provider after permission.',
  desktop: 'Open a vault in the desktop app to inspect its semantic index.', refresh: 'Refresh measurements', loading: 'Loading index measurements…',
  total: 'Notes', current: 'Current', stale: 'Stale', missing: 'Missing', orphaned: 'Deleted sources', invalid: 'Invalid vectors', sample: 'Projected sample',
  bounded: 'A deterministic sample of up to 256 notes is projected. Distances in this projection are approximate; use cosine search for similarity.',
  empty: 'No vectors available to project. Configure a provider, then reindex.', settings: 'Embedding settings', provider: 'Provider', disabled: 'Disabled',
  model: 'Model', dimension: 'Dimensions', endpoint: 'Ollama endpoint', save: 'Save settings', key: 'OpenAI API key', storeKey: 'Store key securely', removeKey: 'Remove stored key',
  keyNotice: 'Keys are stored in the operating system keychain. OpenAI receives note text with sealed spans redacted; configured providers may incur charges.',
  reindex: 'Reindex changed notes', settingsSaved: 'Settings saved. Reindex to replace vectors from a previous model.', keySaved: 'API key stored securely.', keyRemoved: 'API key removed.',
  synced: 'Reindex complete', view: 'Projection view', two: '2D', three: '3D', yaw: 'Rotation', pitch: 'Tilt', variance: 'Variance explained',
  query: 'Find similar notes', search: 'Search by cosine similarity', threshold: 'Minimum cosine similarity', noHits: 'No results meet this threshold.',
  invalidSettings: 'Choose a model and a dimension between 1 and 4096. Ollama needs a valid HTTP or HTTPS endpoint.', working: 'Working…',
} as const
export type SemanticInspectorLabels = { [K in keyof typeof SEMANTIC_INSPECTOR_LABELS]: string }

interface Props { vaultId: string | null; onClose(): void; onOpenNote(path: string): void; embedded?: boolean; labels?: Partial<SemanticInspectorLabels> }

/** Local diagnostics are separate from explicitly authorized provider requests. */
export function SemanticInspectorPanel({ vaultId, onClose, onOpenNote, embedded = false, labels }: Props) {
  const copy = { ...SEMANTIC_INSPECTOR_LABELS, ...labels }
  const [report, setReport] = useState<SemanticInspection | null>(null)
  const [config, setConfig] = useState<VaultConfig | null>(null)
  const [provider, setProvider] = useState<'none' | 'ollama' | 'openai'>('none')
  const [model, setModel] = useState('nomic-embed-text')
  const [dimension, setDimension] = useState(768)
  const [endpoint, setEndpoint] = useState('http://localhost:11434')
  const [key, setKey] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'2d' | '3d'>('2d')
  const [yaw, setYaw] = useState(0.5)
  const [pitch, setPitch] = useState(0.25)
  const [query, setQuery] = useState('')
  const [threshold, setThreshold] = useState(0.5)
  const [hits, setHits] = useState<{ query: string; results: SemanticSearchHit[] } | null>(null)
  const lifetime = useRef(0)
  const available = !!vaultId && isNativeBridgeAvailable()
  const refresh = useCallback(async () => {
    if (!vaultId || !isNativeBridgeAvailable()) return
    const generation = lifetime.current
    const [result, loaded] = await Promise.all([semanticInspect(256, vaultId), vaultLoadConfig(vaultId)])
    if (generation !== lifetime.current) return
    setReport(result); setConfig(loaded)
    setProvider(loaded.semantic?.provider ?? 'none')
    setModel(loaded.semantic?.model ?? (loaded.semantic?.provider === 'openai' ? 'text-embedding-3-small' : 'nomic-embed-text'))
    setDimension(loaded.semantic?.dimension ?? (loaded.semantic?.provider === 'openai' ? 1536 : 768))
    setEndpoint(loaded.semantic?.base_url ?? 'http://localhost:11434')
  }, [vaultId])
  useEffect(() => {
    const generation = ++lifetime.current
    if (available) void refresh().catch(e => { if (generation === lifetime.current) setError(e instanceof Error ? e.message : String(e)) })
    return () => { lifetime.current += 1 }
  }, [available, refresh])
  const run = async (action: () => Promise<void>) => {
    if (busy) return
    const generation = lifetime.current
    setBusy(true); setError(''); setStatus('')
    try { await action() } catch (e) { if (generation === lifetime.current) setError(e instanceof Error ? e.message : String(e)) }
    finally { if (generation === lifetime.current) setBusy(false) }
  }
  const points = useMemo(() => projectSemanticPoints(report?.points ?? [], mode, yaw, pitch), [report, mode, yaw, pitch])
  const shownHits = hits?.query === query.trim() ? hits.results : null
  const visibleHits = shownHits?.filter(hit => hit.score >= threshold) ?? []
  const settingsDirty = !!config && (provider !== (config.semantic?.provider ?? 'none') ||
    (provider !== 'none' && (model !== (config.semantic?.model ?? (provider === 'openai' ? 'text-embedding-3-small' : 'nomic-embed-text')) || dimension !== (config.semantic?.dimension ?? (provider === 'openai' ? 1536 : 768)) ||
      (provider === 'ollama' && endpoint !== (config.semantic?.base_url ?? 'http://localhost:11434')))))
  const save = async () => {
    if (!config || !vaultId) return
    let validUrl = true
    if (provider === 'ollama') {
      try { const url = new URL(endpoint); validUrl = ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password } catch { validUrl = false }
    }
    if (provider !== 'none' && (!model.trim() || model.length > 256 || !Number.isInteger(dimension) || dimension < 1 || dimension > 4096 || !validUrl)) throw new Error(copy.invalidSettings)
    // Reload immediately before saving to preserve settings edited in another surface.
    const latest = await vaultLoadConfig(vaultId)
    await vaultSaveConfig({ ...latest, semantic: { provider, model: model.trim(), dimension, base_url: provider === 'ollama' ? endpoint : null } }, vaultId)
    await refresh(); setHits(null); setStatus(copy.settingsSaved)
  }
  const content = <div className="semantic-inspector-content">
      {!available ? <p>{copy.desktop}</p> : <>
        <p>{copy.local}</p>
        <button type="button" disabled={busy} onClick={() => void run(refresh)}>{copy.refresh}</button>
        {!report && !error && <p role="status">{copy.loading}</p>}
        {report && <>
          <dl className="semantic-metrics">{(['total_notes','current','stale','missing','orphaned','invalid','sampled'] as const).map((name,i) => <div key={name}><dt>{[copy.total,copy.current,copy.stale,copy.missing,copy.orphaned,copy.invalid,copy.sample][i]}</dt><dd>{report[name]}</dd></div>)}</dl>
          <p>{copy.bounded}</p>
          <label>{copy.view}<select value={mode} onChange={e => setMode(e.target.value as '2d'|'3d')}><option value="2d">{copy.two}</option><option value="3d">{copy.three}</option></select></label>
          {mode === '3d' && <div className="semantic-controls"><label>{copy.yaw}<input type="range" min={-3.14} max={3.14} step={0.01} value={yaw} onChange={e => setYaw(Number(e.target.value))} /></label><label>{copy.pitch}<input type="range" min={-1.57} max={1.57} step={0.01} value={pitch} onChange={e => setPitch(Number(e.target.value))} /></label></div>}
          {points.length ? <svg className="semantic-projection" viewBox="0 0 600 360" role="group" aria-label={`${copy.title}: ${mode}`}>
            <line x1={30} x2={570} y1={180} y2={180} /><line x1={300} x2={300} y1={30} y2={330} />
            {points.map(p => <g key={p.note_path} role="button" tabIndex={0} aria-label={p.note_path} onClick={() => onOpenNote(p.note_path)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenNote(p.note_path) } }}><title>{p.note_path}</title><circle className={p.stale ? 'stale' : ''} cx={p.x} cy={p.y} r={7} /></g>)}
          </svg> : <p>{copy.empty}</p>}
          <p>{copy.variance}: {report.explained_variance.slice(0, mode === '2d' ? 2 : 3).map(v => `${(v*100).toFixed(1)}%`).join(' / ')}</p>
          {points.length > 0 && <ul className="semantic-note-list">{report.points.map(p => <li key={p.note_path}><button type="button" onClick={() => onOpenNote(p.note_path)}>{p.note_path}{p.stale ? ` (${copy.stale})` : ''}</button></li>)}</ul>}
        </>}
        <fieldset disabled={busy || !config}><legend>{copy.settings}</legend>
          <label>{copy.provider}<select value={provider} onChange={e => { const value = e.target.value as typeof provider; setProvider(value); if (value === 'openai') { setModel('text-embedding-3-small'); setDimension(1536) } else if (value === 'ollama') { setModel('nomic-embed-text'); setDimension(768) } }}><option value="none">{copy.disabled}</option><option value="ollama">Ollama</option><option value="openai">OpenAI</option></select></label>
          {provider !== 'none' && <><label>{copy.model}<input value={model} maxLength={256} onChange={e => setModel(e.target.value)} /></label><label>{copy.dimension}<input type="number" min={1} max={4096} value={dimension} onChange={e => setDimension(Number(e.target.value))} /></label></>}
          {provider === 'ollama' && <label>{copy.endpoint}<input type="url" value={endpoint} onChange={e => setEndpoint(e.target.value)} /></label>}
          <button type="button" onClick={() => void run(save)}>{copy.save}</button>
        </fieldset>
        {provider === 'openai' && <fieldset disabled={busy}><legend>{copy.key}</legend><p>{copy.keyNotice}</p><label>{copy.key}<input type="password" autoComplete="new-password" value={key} onChange={e => setKey(e.target.value)} /></label><button type="button" disabled={!key.trim()} onClick={() => void run(async () => { await semanticSetApiKey(key); setKey(''); setStatus(copy.keySaved) })}>{copy.storeKey}</button><button type="button" onClick={() => void run(async () => { await semanticDeleteApiKey(); setStatus(copy.keyRemoved) })}>{copy.removeKey}</button></fieldset>}
        <button type="button" disabled={busy || provider === 'none' || settingsDirty || !config} onClick={() => void run(async () => { const synced = await semanticSync(vaultId ?? undefined); await refresh(); setStatus(`${copy.synced}: ${synced.embedded} / ${synced.total_notes}`) })}>{copy.reindex}</button>
        <fieldset disabled={busy || provider === 'none' || settingsDirty || !config}><legend>{copy.query}</legend><label>{copy.query}<input value={query} maxLength={4000} onChange={e => setQuery(e.target.value)} /></label><button type="button" disabled={!query.trim()} onClick={() => void run(async () => { const searched = query.trim(); const result = await semanticSearch(searched,100,vaultId ?? undefined); setHits({ query: searched, results: result }) })}>{copy.search}</button><label>{copy.threshold}: {threshold.toFixed(2)}<input type="range" min={-1} max={1} step={0.01} value={threshold} onChange={e => setThreshold(Number(e.target.value))} /></label>
          {shownHits && (visibleHits.length ? <ul>{visibleHits.map(hit => <li key={hit.note_path}><button type="button" onClick={() => onOpenNote(hit.note_path)}>{hit.note_path}</button> <output>{hit.score.toFixed(3)}</output></li>)}</ul> : <p>{copy.noHits}</p>)}
        </fieldset>
      </>}
      {busy && <p role="status">{copy.working}</p>}{status && <p role="status">{status}</p>}{error && <p role="alert">{error}</p>}
    </div>
  return embedded ? <section aria-label={copy.title} className="semantic-inspector-panel">{content}</section> :
    <UnifiedPanelShell title={copy.title} ariaLabel={copy.title} helpTopic="ai" icon={<Orbit size={18} />} onClose={onClose} wide className="semantic-inspector-panel">{content}</UnifiedPanelShell>
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { vaultListViewNotes, vaultReadNote, vaultSaveNote, vaultSaveAsset, vaultFrontmatterSet } from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'
import type { NoteDocument } from '../types/vault'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useWorkspaceEmbeddedPanel } from '../context/WorkspacePanelContext'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { defaultDatabaseView, validateDatabaseView, databaseFilterJson, scalarFields, calculateValue, aggregateColumn, DATABASE_ROW_LIMIT, isMissingDatabasePreset, matchesMetadataFilters } from '../lib/databaseStudio'
import type { DatabaseView, DatabaseColumn, CellValue } from '../lib/databaseStudio'
import { DatabaseStudioBuilder } from './database/DatabaseStudioBuilder'
import { DatabaseStudioResults } from './database/DatabaseStudioResults'
import '../styles/components/database-studio.css'

const PRESET_PATH = '.scriptor/presets/database-studio.md'
interface Props { vaultOpen: boolean; vaultId: string | null; onClose: () => void; onOpenNote: (path: string) => void; embedded?: boolean; runSourceNoteMutation?: (path:string, mutation:()=>Promise<void>)=>Promise<boolean> }
export interface DatabaseRow { note: NoteDocument; values: Record<string, CellValue> }

/** Local-first view authoring and scalar YAML editing. Calculations never execute source code. */
export function DatabaseStudioPanel({ vaultOpen, vaultId, onClose, onOpenNote, embedded = false, runSourceNoteMutation }: Props) {
  const workspaceEmbedded = useWorkspaceEmbeddedPanel()
  const inline = workspaceEmbedded || embedded
  const [view, setView] = useState<DatabaseView>(defaultDatabaseView)
  const [savedViews, setSavedViews] = useState<DatabaseView[]>([])
  const [rows, setRows] = useState<DatabaseRow[]>([])
  const [loadedColumns, setLoadedColumns] = useState<DatabaseColumn[]>([])
  const [status, setStatus] = useState('Build a view, then load notes. Calculations cover loaded rows only.')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [presetLoadFailed,setPresetLoadFailed]=useState(false)
  const [reloadPresets,setReloadPresets]=useState(0)
  const generation = useRef(0)
  const operationPending = useRef(false)
  const presetHash = useRef<string | undefined>(undefined)
  const presetState = useRef<'loading'|'missing'|'ready'|'failed'>('loading')
  const dialogRef = useRef<HTMLDivElement>(null)
  const native = vaultOpen && !!vaultId && isNativeBridgeAvailable()
  useEscapeToClose(!inline, onClose)
  useFocusTrap(dialogRef, { active: !inline })

  useEffect(() => {
    const request = ++generation.current
    presetHash.current = undefined
    presetState.current = 'loading'
    void (async () => {
      await Promise.resolve(); if(request!==generation.current)return;setBusy(true)
      let stored: unknown = []
      try { if (vaultId) {
        if (native) {
          try { const document = await vaultReadNote(PRESET_PATH); if(request!==generation.current)return; if (document.metadata.vault_id !== vaultId) throw new Error('Vault changed while loading views.'); stored = JSON.parse(document.markdown); presetHash.current = document.metadata.content_hash; presetState.current='ready' }
          catch (failure) {if(!isMissingDatabasePreset(failure))throw failure;if(request!==generation.current)return;presetState.current='missing'}
        } else {
          stored = JSON.parse(localStorage.getItem(`scriptor.database-studio:${vaultId}`) ?? '[]'); presetState.current='ready'
        }
      }
      if (request !== generation.current) return
        if (!Array.isArray(stored) || stored.length > 50) throw new Error('Saved views exceed the 50-view limit.')
        setSavedViews(stored.map(validateDatabaseView)); setRows([]); setError(null);setPresetLoadFailed(false)
      } catch (failure) { if(request!==generation.current)return;presetState.current='failed';setPresetLoadFailed(true);setError(`Saved views could not be loaded. Saving is blocked to preserve the stored file: ${String(failure)}`); setSavedViews([]); setRows([]) }
      setView(defaultDatabaseView()); setBusy(false)
    })()
    return () => { generation.current += 1 }
  }, [vaultId, native, reloadPresets])

  const load = async () => {
    if (!native || !vaultId || busy || operationPending.current) return
    operationPending.current=true
    const request = ++generation.current
    setBusy(true); setError(null)
    try {
      const valid = validateDatabaseView(view)
      const hits = await vaultListViewNotes(databaseFilterJson(valid))
      const selected = hits.slice(0, DATABASE_ROW_LIMIT)
      const loaded: DatabaseRow[] = []; let bytes = 0; let skipped = 0
      // Four in flight; cumulative content and returned rows both have fixed budgets.
      for (let offset = 0; offset < selected.length; offset += 4) {
        if (request !== generation.current) return
        const batch = await Promise.allSettled(selected.slice(offset, offset + 4).map((hit) => vaultReadNote(hit.path)))
        for (const result of batch) {
          if (result.status === 'rejected') { skipped += 1; continue }
          const note = result.value
          if (note.metadata.vault_id !== vaultId) throw new Error('Vault changed during query. Load the current vault again.')
          bytes += new TextEncoder().encode(note.markdown).length
          if (bytes > 32 * 1024 * 1024) { skipped += 1; continue }
          const fields=scalarFields(note.markdown)
          if(matchesMetadataFilters(valid,fields,{title:note.metadata.title,tags:note.metadata.tags,path:note.metadata.path,modifiedDays:(Date.now()-Date.parse(note.metadata.modified_at))/86400000}))loaded.push({ note, values: fields })
        }
        if (bytes > 32 * 1024 * 1024) { skipped += selected.length - Math.min(offset + 4, selected.length); break }
      }
      if (request !== generation.current) return
      setRows(loaded); setLoadedColumns(valid.columns)
      setStatus(`Loaded ${loaded.length} notes${hits.length > DATABASE_ROW_LIMIT ? `; examined first ${DATABASE_ROW_LIMIT} of ${hits.length} candidates` : ''}${skipped ? `; ${skipped} unavailable or over the content budget` : ''}. Metadata filters and aggregates cover loaded candidates only.`)
    } catch (failure) { if (request === generation.current) setError(String(failure)) }
    finally { operationPending.current=false;if (request === generation.current) setBusy(false) }
  }

  const saveView = async () => {
    if (!vaultId || busy || operationPending.current) return
    operationPending.current=true
    const request = generation.current
    setError(null); setBusy(true)
    try {
      const valid = validateDatabaseView(view)
      if(presetState.current==='failed'||presetState.current==='loading')throw new Error('Reload the saved views successfully before saving.')
      const next = [...savedViews.filter((item) => item.id !== valid.id), valid]
      if (next.length > 50) throw new Error('Save at most 50 views per vault.')
      if (native) {
        const payload=JSON.stringify(next,null,2)+'\n'
        if(presetState.current==='missing'){await vaultSaveAsset(PRESET_PATH,Array.from(new TextEncoder().encode(payload)),true,vaultId);if(request!==generation.current)return}
        const result = presetState.current==='missing'?await vaultReadNote(PRESET_PATH):await vaultSaveNote(PRESET_PATH, payload, presetHash.current, false, vaultId)
        if (request !== generation.current) return
        presetHash.current = result.metadata.content_hash
        presetState.current='ready'
      } else localStorage.setItem(`scriptor.database-studio:${vaultId}`, JSON.stringify(next))
      if (request === generation.current) { setSavedViews(next); setStatus(native ? 'Saved view in this vault.' : 'Saved view in this browser for this vault.') }
    } catch (failure) { if (request === generation.current) setError(`View was not saved: ${String(failure)}`) }
    finally { operationPending.current=false;if (request === generation.current) setBusy(false) }
  }

  const editCell = async (row: DatabaseRow, key: string, value: CellValue) => {
    if (!native || !vaultId || busy || operationPending.current) throw new Error('Open the vault and finish the current operation before editing.')
    operationPending.current=true
    const request = generation.current
    setBusy(true); setError(null)
    try {
      const mutation=async()=>{const fresh=await vaultReadNote(row.note.metadata.path);if(request!==generation.current||fresh.metadata.vault_id!==vaultId)throw new Error('Vault changed before editing.');if(fresh.metadata.content_hash!==row.note.metadata.content_hash)throw new Error('Source note changed since this view was loaded. Reload the notes and review the cell before saving.');await vaultFrontmatterSet(row.note.metadata.path,key,JSON.stringify(value),row.note.metadata.content_hash,vaultId)}
      if(runSourceNoteMutation){if(!await runSourceNoteMutation(row.note.metadata.path,mutation))throw new Error('The source editor could not save its draft.')}else await vaultFrontmatterSet(row.note.metadata.path, key, JSON.stringify(value), row.note.metadata.content_hash, vaultId)
      const note = await vaultReadNote(row.note.metadata.path)
      if (request !== generation.current || note.metadata.vault_id !== vaultId) return
      setRows((current) => current.map((item) => item.note.metadata.path === note.metadata.path ? { note, values: scalarFields(note.markdown) } : item))
      setStatus(`Saved ${key} in ${note.metadata.path}. Reload the view to reapply filters.`)
    } catch (failure) { if (request === generation.current) setError(`Cell was not saved: ${String(failure)}`); throw failure }
    finally { operationPending.current=false;if (request === generation.current) setBusy(false) }
  }

  const values = useMemo(() => rows.map((row) => loadedColumns.map((column) => column.formula ? calculateValue(column.formula, row.values) : row.values[column.key] ?? null)), [rows, loadedColumns])
  const aggregates = useMemo(() => loadedColumns.map((_, index) => aggregateColumn(values.map((row) => row[index]))), [loadedColumns, values])
  const body = <>
    <header className="database-studio-header" data-workspace-header-only={workspaceEmbedded ? 'true' : undefined}><h2>Database Studio</h2>{!workspaceEmbedded && <button type="button" onClick={onClose}>{embedded ? 'Back to saved views' : 'Close database studio'}</button>}</header>
    <div className="database-studio-body">
      <label>Saved view<select value="" onChange={(event) => { const selected = savedViews.find((item) => item.id === event.target.value); if (selected) { setView(selected); setStatus('View selected. Load notes to apply it.') } }}><option value="">Select a view</option>{savedViews.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <DatabaseStudioBuilder view={view} onChange={setView} busy={busy} />
      <div className="database-studio-actions"><button type="button" disabled={!native || busy} onClick={() => void load()}>Load notes</button><button type="button" disabled={!vaultId || busy || presetLoadFailed} onClick={() => void saveView()}>Save view</button><button type="button" disabled={busy} onClick={() => setView({ ...defaultDatabaseView(), id: crypto.randomUUID(), label: 'New view' })}>New view</button>{busy ? <button type="button" onClick={() => { generation.current += 1; if(presetState.current==='loading'){presetState.current='failed';setPresetLoadFailed(true);setError('Saved view loading was stopped. Reload saved views before saving.')}setBusy(false); setStatus('Stopped waiting. Any submitted save may still finish; reload to check its result.') }}>Stop waiting</button> : null}</div>
      {!native ? <p>Open a desktop vault to query notes and edit YAML. View definitions can be saved locally in the browser.</p> : null}
      {error ? <p role="alert">{error}</p> : null}{presetLoadFailed?<><p>Review the loading error, repair the stored view file if needed, then reload before saving.</p><button type="button" disabled={busy} onClick={()=>setReloadPresets(value=>value+1)}>Reload saved views</button></>:null}<p role="status">{status}</p>
      <DatabaseStudioResults rows={rows} columns={loadedColumns} values={values} mode={view.mode} busy={busy} onOpenNote={onOpenNote} onEdit={editCell} />
      {rows.length ? <details><summary>Aggregates for loaded rows</summary><dl>{loadedColumns.map((column,index) => <div key={column.key}><dt>{column.label}</dt><dd>Numeric count {aggregates[index].count}; sum {aggregates[index].sum ?? '—'}; average {aggregates[index].average ?? '—'}; min {aggregates[index].min ?? '—'}; max {aggregates[index].max ?? '—'}</dd></div>)}</dl></details> : null}
    </div>
  </>
  if (inline) return <section className="database-studio" aria-label="Database Studio" data-help-topic="saved-views">{body}</section>
  return <div className="modal-backdrop"><div ref={dialogRef} className="modal-card database-studio" role="dialog" aria-modal="true" aria-label="Database Studio" data-help-topic="saved-views">{body}</div></div>
}

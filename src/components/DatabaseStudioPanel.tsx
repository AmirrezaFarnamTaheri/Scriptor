import { useEffect, useMemo, useRef, useState } from 'react'
import { vaultListViewNotes, vaultReadNote, vaultSaveNote, vaultSaveAsset, vaultFrontmatterSet } from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'
import type { NoteDocument } from '../types/vault'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useWorkspaceEmbeddedPanel } from '../context/WorkspacePanelContext'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { defaultDatabaseView, validateDatabaseView, databaseFilterJson, scalarFields, calculateValue, aggregateColumn, formatScalarCell, DATABASE_ROW_LIMIT, isMissingDatabasePreset, matchesMetadataFilters } from '../lib/databaseStudio'
import type { DatabaseView, DatabaseColumn, CellValue } from '../lib/databaseStudio'
import { DatabaseStudioBuilder } from './database/DatabaseStudioBuilder'
import { DatabaseStudioResults } from './database/DatabaseStudioResults'
import '../styles/components/database-studio.css'

const PRESET_PATH = '.scriptor/presets/database-studio.md'
// Presentation-only updates must not invalidate a completed (or pending) query.
// Identity, filters, columns and combination logic determine result ownership.
function queryIdentity(view: DatabaseView): string {
  return JSON.stringify({ id: view.id, filters: view.filters, columns: view.columns, combine: view.combine })
}
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
  const [loadedScope, setLoadedScope] = useState<{ vaultId: string; view: DatabaseView; native: boolean; presetVersion: number; revision: number } | null>(null)
  const [status, setStatus] = useState('Build a view, then load notes. Calculations cover loaded rows only.')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [presetLoadFailed,setPresetLoadFailed]=useState(false)
  const [reloadPresets,setReloadPresets]=useState(0)
  const generation = useRef(0)
  // Query identity is independent of the native operation lifecycle.
  const viewRevision = useRef(0)
  const operationPending = useRef(false)
  const presetHash = useRef<string | undefined>(undefined)
  const presetState = useRef<'loading'|'missing'|'ready'|'failed'>('loading')
  const dialogRef = useRef<HTMLDivElement>(null)
  const native = vaultOpen && !!vaultId && isNativeBridgeAvailable()
  useEscapeToClose(!inline, onClose)
  useFocusTrap(dialogRef, { active: !inline })

  useEffect(() => {
    const request = ++generation.current
    viewRevision.current += 1
    // The previous result is masked by its vault/native/preset identity during
    // render; clear stored rows in the existing asynchronous load path.
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

  const changeView = (next: DatabaseView) => {
    if (queryIdentity(next) === queryIdentity(view)) {
      setView(next)
      return
    }
    viewRevision.current += 1
    setView(next)
    setLoadedScope(null)
    setRows([])
    setLoadedColumns([])
    setError(null)
    setStatus('View changed. Load notes to apply it.')
  }

  const load = async () => {
    if (!native || !vaultId || busy || operationPending.current) return
    operationPending.current=true
    const request = ++generation.current
    const requestedViewRevision = viewRevision.current
    setBusy(true); setError(null); setLoadedScope(null); setRows([]); setLoadedColumns([])
    try {
      const valid = validateDatabaseView(view)
      const hits = await vaultListViewNotes(databaseFilterJson(valid))
      const selected = hits.slice(0, DATABASE_ROW_LIMIT)
      const loaded: DatabaseRow[] = []; let bytes = 0; let skipped = 0
      // Four in flight; cumulative content and returned rows both have fixed budgets.
      for (let offset = 0; offset < selected.length; offset += 4) {
        if (request !== generation.current || requestedViewRevision !== viewRevision.current) return
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
      if (request !== generation.current || requestedViewRevision !== viewRevision.current) return
      setRows(loaded); setLoadedColumns(valid.columns)
      setLoadedScope({ vaultId, view, native, presetVersion: reloadPresets, revision: requestedViewRevision })
      setStatus(`Loaded ${loaded.length} notes${hits.length > DATABASE_ROW_LIMIT ? `; examined first ${DATABASE_ROW_LIMIT} of ${hits.length} candidates` : ''}${skipped ? `; ${skipped} unavailable or over the content budget` : ''}. Metadata filters and aggregates cover loaded candidates only.`)
    } catch (failure) { if (request === generation.current && requestedViewRevision === viewRevision.current) setError(String(failure)) }
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
    if (!loadedScope || loadedScope.vaultId !== vaultId || loadedScope.revision !== viewRevision.current) throw new Error('The Database Studio view changed. Reload notes and review the cell before editing.')
    if (!runSourceNoteMutation) throw new Error('A source editor coordinator is required to edit note properties safely. Open the note in the editor to make this change.')
    if (!native || !vaultId || busy || operationPending.current) throw new Error('Open the vault and finish the current operation before editing.')
    operationPending.current=true
    const request = generation.current
    const editViewRevision = viewRevision.current
    setBusy(true); setError(null)
    try {
      const mutation=async()=>{if(editViewRevision!==viewRevision.current)throw new Error('The Database Studio view changed before editing. Reload notes.');const fresh=await vaultReadNote(row.note.metadata.path);if(request!==generation.current||editViewRevision!==viewRevision.current||fresh.metadata.vault_id!==vaultId)throw new Error('Vault or view changed before editing.');if(fresh.metadata.content_hash!==row.note.metadata.content_hash)throw new Error('Source note changed since this view was loaded. Reload the notes and review the cell before saving.');await vaultFrontmatterSet(row.note.metadata.path,key,formatScalarCell(value),row.note.metadata.content_hash,vaultId)}
      if (!await runSourceNoteMutation(row.note.metadata.path, mutation)) throw new Error('The source editor could not save its draft.')
      const note = await vaultReadNote(row.note.metadata.path)
      if (request !== generation.current || editViewRevision !== viewRevision.current || note.metadata.vault_id !== vaultId) return
      setRows((current) => current.map((item) => item.note.metadata.path === note.metadata.path ? { note, values: scalarFields(note.markdown) } : item))
      setStatus(`Saved ${key} in ${note.metadata.path}. Reload the view to reapply filters.`)
    } catch (failure) { if (request === generation.current && editViewRevision === viewRevision.current) setError(`Cell was not saved: ${String(failure)}`); throw failure }
    finally { operationPending.current=false;if (request === generation.current) setBusy(false) }
  }

  // Compare immutable render state, not mutable refs. This hides results on
  // the FIRST render after a vault/preset/filter change, before effects settle.
  const resultsCurrent = loadedScope?.vaultId === vaultId
    && queryIdentity(loadedScope.view) === queryIdentity(view) && loadedScope.native === native
    && loadedScope.presetVersion === reloadPresets
  const visibleRows = useMemo(() => resultsCurrent ? rows : [], [resultsCurrent, rows])
  const visibleColumns = useMemo(() => resultsCurrent ? loadedColumns : [], [resultsCurrent, loadedColumns])
  const values = useMemo(() => visibleRows.map((row) => visibleColumns.map((column) => column.formula ? calculateValue(column.formula, row.values) : row.values[column.key] ?? null)), [visibleRows, visibleColumns])
  const aggregates = useMemo(() => visibleColumns.map((_, index) => aggregateColumn(values.map((row) => row[index]))), [visibleColumns, values])
  const body = <>
    <header className="database-studio-header" data-workspace-header-only={workspaceEmbedded ? 'true' : undefined}><h2>Database Studio</h2>{!workspaceEmbedded && <button type="button" onClick={onClose}>{embedded ? 'Back to saved views' : 'Close database studio'}</button>}</header>
    <div className="database-studio-body">
      <label>Saved view<select value="" onChange={(event) => { const selected = savedViews.find((item) => item.id === event.target.value); if (selected) changeView(selected) }}><option value="">Select a view</option>{savedViews.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <DatabaseStudioBuilder view={view} onChange={changeView} busy={busy} />
      <div className="database-studio-actions"><button type="button" disabled={!native || busy} onClick={() => void load()}>Load notes</button><button type="button" disabled={!vaultId || busy || presetLoadFailed} onClick={() => void saveView()}>Save view</button><button type="button" disabled={busy} onClick={() => changeView({ ...defaultDatabaseView(), id: crypto.randomUUID(), label: 'New view' })}>New view</button>{busy ? <button type="button" onClick={() => { generation.current += 1; if(presetState.current==='loading'){presetState.current='failed';setPresetLoadFailed(true);setError('Saved view loading was stopped. Reload saved views before saving.')}setBusy(false); setStatus('Stopped waiting. Any submitted save may still finish; reload to check its result.') }}>Stop waiting</button> : null}</div>
      {!native ? <p>Open a folder of notes in the desktop app to view and edit note properties. Saved views stay on this device.</p> : null}
      {error ? <p role="alert">{error}</p> : null}{presetLoadFailed?<><p>Review the loading error, repair the stored view file if needed, then reload before saving.</p><button type="button" disabled={busy} onClick={()=>setReloadPresets(value=>value+1)}>Reload saved views</button></>:null}<p role="status">{status}</p>
      {native && !runSourceNoteMutation && visibleRows.length > 0 ? <p>Note properties are read-only until the source editor is available. Open a note from the results to edit it safely.</p> : null}
      <DatabaseStudioResults rows={visibleRows} columns={visibleColumns} values={values} mode={view.mode} busy={busy || !runSourceNoteMutation} onOpenNote={onOpenNote} onEdit={editCell} />
      {visibleRows.length ? <details><summary>Totals for loaded notes</summary><dl>{visibleColumns.map((column,index) => <div key={column.key}><dt>{column.label}</dt><dd>Numeric count {aggregates[index].count}; sum {aggregates[index].sum ?? '—'}; average {aggregates[index].average ?? '—'}; min {aggregates[index].min ?? '—'}; max {aggregates[index].max ?? '—'}</dd></div>)}</dl></details> : null}
    </div>
  </>
  if (inline) return <section className="database-studio" aria-label="Database Studio" data-help-topic="saved-views">{body}</section>
  return <div className="modal-backdrop"><div ref={dialogRef} className="modal-card database-studio" role="dialog" aria-modal="true" aria-label="Database Studio" data-help-topic="saved-views">{body}</div></div>
}

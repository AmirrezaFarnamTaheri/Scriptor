import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, X } from 'lucide-react'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useCiteprocPreview } from '../hooks/useCiteprocPreview'
import { isBibliographyFile } from '../lib/importVaultFiles'
import { ReferenceImportReview } from './bibliography/ReferenceImportReview'
import type { BibliographyEntry } from '../types/vault'
import type { ReferenceUsageReport } from '../bridge/commands/research_capture'
import '../styles/components/reference-desk.css'
interface BibliographyPanelProps {
  entries:BibliographyEntry[];bibliographyPath?:string;onClose:()=>void;onInsertCitation:(key:string)=>void
  onSaveBibliography?:(path:string,content:string)=>Promise<void>
  onInspectUsage?:()=>Promise<ReferenceUsageReport>;onOpenNote?:(path:string)=>void
  onCreateLiteratureNote?:(entry:BibliographyEntry)=>Promise<void>
}
export const BibliographyPanel=memo(function BibliographyPanel({entries,bibliographyPath='references.bib',onClose,onInsertCitation,onSaveBibliography,onInspectUsage,onOpenNote,onCreateLiteratureNote}:BibliographyPanelProps){
  const [query,setQuery]=useState('');const [zoteroOpen,setZoteroOpen]=useState(false);const [error,setError]=useState<string|null>(null);const [busy,setBusy]=useState(false);const [status,setStatus]=useState('Select a reference to insert a citation.');const [usage,setUsage]=useState<ReferenceUsageReport|null>(null);const [importFile,setImportFile]=useState<{name:string;content:string}|null>(null);const [importPath,setImportPath]=useState('references-import.bib')
  const dialog=useRef<HTMLElement>(null);const generation=useRef(0);const pending=useRef(false)
  useEscapeToClose(true,onClose);useFocusTrap(dialog,{active:true});useEffect(()=>()=>{generation.current+=1},[])
  const filtered=useMemo(()=>{const needle=query.trim().toLowerCase();return entries.filter(entry=>[entry.key,entry.title,entry.author,entry.year,entry.source_path,entry.abstract_text,entry.doi].some(value=>value?.toLowerCase().includes(needle)))},[entries,query])
  const {formatBibliography,usingCiteproc}=useCiteprocPreview(filtered)
  const operation=async(run:()=>Promise<void>,message:string)=>{if(pending.current)return;pending.current=true;const request=generation.current;setBusy(true);setError(null);try{await run();if(request===generation.current)setStatus(message)}catch(failure){if(request===generation.current)setError(String(failure))}finally{pending.current=false;if(request===generation.current)setBusy(false)}}
  const previewFile=async(file:File)=>{if(!isBibliographyFile(file))throw new Error('Choose a .bib file.');if(file.size>8*1024*1024)throw new Error('Bibliography import is limited to 8 MiB.');const request=generation.current;const content=await file.text();if(request===generation.current){setImportFile({name:file.name,content});setStatus('Review the bibliography text and choose a new vault path before saving.')}}
  const cited=new Set(usage?.rows.map(row=>row.key)??[])
  return <div className="modal-backdrop" role="presentation" onClick={onClose}><section ref={dialog} className="bibliography-panel knowledge-filters-panel reference-desk" role="dialog" aria-modal="true" aria-label="Bibliography" data-help-topic="bibliography" onClick={event=>event.stopPropagation()} onDragOver={event=>{if(onSaveBibliography){event.preventDefault()}}} onDrop={event=>{if(!onSaveBibliography)return;event.preventDefault();const file=Array.from(event.dataTransfer.files).find(isBibliographyFile);if(file)void operation(()=>previewFile(file),'Bibliography preview ready.')}}>
    <header><div><h2><BookOpen size={18}/> Reference desk</h2><p>{filtered.length} of {entries.length} entries{usingCiteproc?' · CSL preview':''}. Configured bibliography: {bibliographyPath}</p></div><button type="button" aria-label="Close bibliography" onClick={onClose}><X/></button></header>
    <div className="reference-desk-actions">{onSaveBibliography?<><button type="button" disabled={busy} onClick={()=>setZoteroOpen(value=>!value)}>Review Zotero import</button><label>Import a .bib file<input type="file" accept=".bib" disabled={busy} onChange={event=>{const file=event.target.files?.[0];if(file)void operation(()=>previewFile(file),'Bibliography preview ready.');event.target.value=''}}/></label></>:null}{onInspectUsage?<button type="button" disabled={busy} onClick={()=>void operation(async()=>{const request=generation.current;const result=await onInspectUsage();if(generation.current===request)setUsage(result)},'Citation scan complete.')}>Inspect citation usage</button>:null}</div>
    {zoteroOpen&&onSaveBibliography?<ReferenceImportReview onSave={onSaveBibliography} onClose={()=>setZoteroOpen(false)}/>:null}
    {importFile&&onSaveBibliography?<section aria-label="Review bibliography file"><h3>Review {importFile.name}</h3><pre>{importFile.content}</pre><label>New vault bibliography path<input value={importPath} disabled={busy} onChange={event=>setImportPath(event.target.value)}/></label><p>Saving creates a new file and preserves existing bibliographies.</p><button type="button" disabled={busy} onClick={()=>void operation(async()=>{const request=generation.current;await onSaveBibliography(importPath,importFile.content);if(generation.current===request)setImportFile(null)},`Saved bibliography to ${importPath}.`)}>Save reviewed bibliography</button><button type="button" onClick={()=>setImportFile(null)}>Cancel file import</button></section>:null}
    <label>Filter references<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Key, title, author, abstract, DOI"/></label><p role="status">{status}</p>{error?<p role="alert">{error}</p>:null}
    {usage?<section aria-label="Citation usage"><h3>Citation usage</h3><p>{usage.rows.length} citation occurrences{usage.truncated?' · Scan truncated; unused-reference results are incomplete.':''}</p><ul>{usage.rows.filter(row=>!row.valid).map((row,index)=><li key={`${row.path}:${row.line}:${row.key}:${index}`}>Missing reference @{row.key} · <button type="button" onClick={()=>onOpenNote?.(row.path)} disabled={!onOpenNote}>{row.path}:{row.line}</button></li>)}</ul>{!usage.rows.some(row=>!row.valid)?<p>No missing references in the scanned notes.</p>:null}<p>{usage.truncated?'Possibly unused references (incomplete scan): ':'References unused in scanned notes: '}{entries.filter(entry=>!cited.has(entry.key)).map(entry=>entry.key).join(', ')||'None'}</p></section>:null}
    <ul className="bibliography-list">{!filtered.length?<li className="empty-state">{entries.length?'No references match this filter.':'No bibliography entries yet. Import a .bib file or review a Zotero library.'}</li>:filtered.map(entry=>{
      const metadata = [entry.source_path?.trim(), entry.entry_type?.trim()].filter(Boolean).join(' · ')
      return <li key={`${entry.source_path}:${entry.key}`}>
        <button type="button" draggable onDragStart={event=>{event.dataTransfer.setData('text/plain',`[@${entry.key}]`);event.dataTransfer.effectAllowed='copy'}} onClick={()=>onInsertCitation(entry.key)}>
          <strong>{entry.key}</strong><span>{formatBibliography(entry)}</span>{metadata?<small>{metadata}</small>:null}
        </button>
        {entry.abstract_text?<details><summary>Abstract</summary><p>{entry.abstract_text}</p></details>:null}
        {entry.doi?<p>DOI: {entry.doi}</p>:null}{entry.url?<p>URL: {entry.url}</p>:null}{entry.file?<p>Attachment: {entry.file}</p>:null}
        {onCreateLiteratureNote?<button type="button" disabled={busy} onClick={()=>void operation(()=>onCreateLiteratureNote(entry),'Created a literature note linked to this citation.')}>Create literature note</button>:null}
      </li>
    })}</ul>
  </section></div>
})

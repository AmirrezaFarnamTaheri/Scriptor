import { useEffect, useRef, useState } from 'react'
import { captureExtractPreview } from '../bridge/commands/research_capture'
import { vaultSaveAsset, indexerApplyFilesystemChanges } from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'
import { captureMarkdown, captureTarget } from '../lib/captureReviewer'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useWorkspaceEmbeddedPanel } from '../context/WorkspacePanelContext'
import { sanitizeRenderedHtml } from '@scriptor/renderer'
import '../styles/components/capture-reviewer.css'
// Template contents are inert: source resources never enter the live document.
function passiveSourceSnapshot(html:string):string {
  const template=document.createElement('template')
  template.innerHTML=sanitizeRenderedHtml(html)
  const elements=Array.from(template.content.querySelectorAll('*'))
  if(elements.length>50000)throw new Error('Source snapshot exceeds its element limit.')
  const passive=new Set(['p','h1','h2','h3','h4','h5','h6','ul','ol','li','strong','em','b','i','s','del','code','pre','blockquote','hr','br','table','thead','tbody','tfoot','tr','th','td','div','span','section','article','main','figure','figcaption','sup','sub','mark','dl','dt','dd'])
  for(const element of elements){
    if(element.tagName.toLowerCase()==='a'){element.replaceWith(...Array.from(element.childNodes));continue}
    if(!passive.has(element.tagName.toLowerCase())){element.remove();continue}
    const direction=element.getAttribute('dir')
    for(const attribute of Array.from(element.attributes))element.removeAttribute(attribute.name)
    if(direction&&['rtl','ltr','auto'].includes(direction))element.setAttribute('dir',direction)
  }
  return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'; connect-src \'none\'; frame-src \'none\'"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:16px;font:16px/1.6 system-ui,sans-serif;overflow-wrap:anywhere;color:#202124;background:#fff}pre{white-space:pre-wrap}table{border-collapse:collapse;max-width:100%}td,th{border:1px solid #bbb;padding:6px}blockquote{margin-inline:12px;padding-inline:12px;border-inline-start:3px solid #bbb}</style></head><body>'+template.innerHTML+'</body></html>'
}
export interface CaptureReviewerPanelProps {vaultOpen:boolean;vaultId:string|null;onClose:()=>void;onSaved?:(path:string)=>void;embedded?:boolean}
export function CaptureReviewerPanel({vaultOpen,vaultId,onClose,onSaved,embedded=false}:CaptureReviewerPanelProps) {
  const workspaceEmbedded = useWorkspaceEmbeddedPanel()
  const inline = workspaceEmbedded || embedded
  const [url,setUrl]=useState('');const [title,setTitle]=useState('');const [author,setAuthor]=useState('');const [published,setPublished]=useState('');const [tags,setTags]=useState('');const [directory,setDirectory]=useState('Inbox');const [markdown,setMarkdown]=useState('');const [source,setSource]=useState('');const [status,setStatus]=useState('Enter a URL to extract and review its content before saving.');const [error,setError]=useState<string|null>(null);const [busy,setBusy]=useState(false)
  const generation=useRef(0);const pending=useRef(false);const dialog=useRef<HTMLDivElement>(null);const editor=useRef<HTMLTextAreaElement>(null)
  const [sourceSnapshot,setSourceSnapshot]=useState('');const [snapshotError,setSnapshotError]=useState<string|null>(null)
  const [ignored,setIgnored]=useState(false)
  const native=vaultOpen&&!!vaultId&&isNativeBridgeAvailable()
  useEscapeToClose(!inline,onClose);useFocusTrap(dialog,{active:!inline})
  useEffect(()=>{generation.current+=1;return()=>{generation.current+=1}},[vaultId])
  const extract=async()=>{
    if(!native||busy||pending.current)return;pending.current=true
    const request=++generation.current;setBusy(true);setIgnored(false);setError(null);setStatus('Extracting article…')
    try {const result=await captureExtractPreview(url.trim());if(request!==generation.current)return;setSource(result.url);setTitle(result.title);setAuthor('');setTags('');setMarkdown(result.markdown);setPublished(result.published_at?.match(/^\d{4}-\d{2}-\d{2}/)?.[0]??'');setSnapshotError(null);setSourceSnapshot('');try{setSourceSnapshot(passiveSourceSnapshot(result.source_html))}catch(failure){setSnapshotError(`Source snapshot unavailable: ${String(failure)}`)}setStatus(`Extracted ${result.word_count} words${result.site_name?` from ${result.site_name}`:''}. Review the text and destination, then save.`)}catch(failure){if(request===generation.current){setError(String(failure));setStatus('Extraction failed. Check the URL and try again.')}}finally{pending.current=false;setBusy(false);setIgnored(false)}
  }
  const save=async()=>{
    if(!native||!vaultId||busy||!source||pending.current)return;pending.current=true
    const request=generation.current;setBusy(true);setIgnored(false);setError(null)
    try {const path=captureTarget(directory,title);const content=captureMarkdown({url:source,title,author,published,tags,markdown});await vaultSaveAsset(path,Array.from(new TextEncoder().encode(content)),true,vaultId);if(request!==generation.current)return;setStatus(`Saved reviewed capture to ${path}.`);setSource('');await indexerApplyFilesystemChanges([path]);if(request===generation.current)onSaved?.(path)}catch(failure){if(request===generation.current)setError(`Capture could not be saved or indexed: ${String(failure)}. If a file was saved, choose a new title before retrying.`)}finally{pending.current=false;setBusy(false);setIgnored(false)}
  }
  const highlight=()=>{const input=editor.current;if(!input||input.selectionStart===input.selectionEnd)return;const start=input.selectionStart,end=input.selectionEnd;setMarkdown(markdown.slice(0,start)+'=='+markdown.slice(start,end)+'=='+markdown.slice(end));input.focus()}
  const body=<>
    <header data-workspace-header-only={workspaceEmbedded ? 'true' : undefined}><h2>Capture reviewer</h2>{!workspaceEmbedded && <button type="button" onClick={onClose}>Close capture reviewer</button>}</header>
    <form onSubmit={event=>{event.preventDefault();void extract()}}>
      <label>Article URL<input type="url" required value={url} disabled={busy} onChange={event=>setUrl(event.target.value)} placeholder="https://example.org/article"/></label>
      <button type="submit" disabled={!native||busy||!url.trim()}>Extract preview</button>
    </form>
    {!native?<p>Open a desktop vault to extract and save articles.</p>:null}
    <p role="status">{status}</p>{error?<p role="alert">{error}</p>:null}
    {source?<>
      <p>Source: <a href={source} target="_blank" rel="noreferrer">{source}</a></p>
      <div className="capture-reviewer-metadata">
        <label>Title<input value={title} disabled={busy} onChange={event=>setTitle(event.target.value)}/></label>
        <label>Author<input value={author} disabled={busy} onChange={event=>setAuthor(event.target.value)}/></label>
        <label>Publication date<input type="date" value={published} disabled={busy} onChange={event=>setPublished(event.target.value)}/></label>
        <label>Tags, separated by commas<input value={tags} disabled={busy} onChange={event=>setTags(event.target.value)}/></label>
        <label>Vault directory<input dir="ltr" value={directory} disabled={busy} onChange={event=>setDirectory(event.target.value)}/></label>
      </div>
      <div className="capture-reviewer-split">
        <label>Reviewed Markdown<textarea ref={editor} value={markdown} disabled={busy} onChange={event=>setMarkdown(event.target.value)}/></label>
        <section aria-label="Capture text preview"><h3>Text preview</h3><pre>{markdown}</pre></section>
      </div>
      <button type="button" disabled={busy} onClick={highlight}>Highlight selected text</button>
      <button type="button" disabled={busy||!title.trim()||!markdown.trim()} onClick={()=>void save()}>Save reviewed capture as a new note</button>
    </>:null}
    {busy?<button type="button" disabled={ignored} onClick={()=>{
      generation.current+=1;setIgnored(true)
      setStatus('Ignoring the pending result. Controls unlock when the operation finishes. A submitted save may still finish; check the vault before retrying.')
    }}>Stop waiting</button>:null}
  </>
  const sourcePreview=source?<section aria-label="Original source snapshot"><h3>Original source snapshot</h3><p>Text and structure from the fetched page. Images, scripts, styling, forms and navigation are removed.</p>{snapshotError?<p role="alert">{snapshotError}</p>:sourceSnapshot?<iframe title="Original source snapshot" sandbox="" referrerPolicy="no-referrer" srcDoc={sourceSnapshot}/>:null}</section>:null
  if(inline)return <section className="capture-reviewer" aria-label="Capture reviewer" data-help-topic="capture">{body}{sourcePreview}</section>
  return <div className="modal-backdrop"><div ref={dialog} className="modal-card capture-reviewer" role="dialog" aria-modal="true" aria-label="Capture reviewer" data-help-topic="capture">{body}{sourcePreview}</div></div>
}

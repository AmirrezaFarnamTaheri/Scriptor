import { useEffect, useRef, useState } from 'react'
import { vaultReadNoteHistoryRevision } from '../../bridge/commands'
import { loadVocabularyEvolution, type VocabularyEvolution as Evolution } from '../../lib/vocabularyEvolution'

interface Props { path: string; vaultId: string | null; revisions: { id: string; saved_at: string }[] }

export function VocabularyEvolution({ path, vaultId, revisions }: Props) {
  const [result,setResult]=useState<Evolution|null>(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [cancelled,setCancelled]=useState(false)
  const generation=useRef(0)
  const pending=useRef(false)
  useEffect(()=>()=>{generation.current++},[])
  const analyze=async()=>{
    if(!vaultId||pending.current)return
    pending.current=true;const request=++generation.current
    setBusy(true);setCancelled(false);setError(null);setResult(null)
    try {
      const analysis=await loadVocabularyEvolution(revisions,id=>vaultReadNoteHistoryRevision(path,id,vaultId),()=>request!==generation.current)
      if(request===generation.current)setResult(analysis)
    } catch(failure) { if(request===generation.current)setError(String(failure)) }
    finally { pending.current=false;setBusy(false);setCancelled(false) }
  }
  const points=result?.points??[]
  const first=points.length?Date.parse(points[0].saved_at):0
  const last=points.length?Date.parse(points.at(-1)!.saved_at):0
  const maximum=Math.max(1,...points.map(point=>point.uniqueWords))
  return <section className="vocabulary-evolution" aria-label="Vocabulary evolution">
    <h3>Vocabulary evolution</h3>
    <p>Measures the latest 32 retained revisions, up to 16 MiB total. Words come from Markdown source, including code and metadata. Distinct word counts describe vocabulary; they are not a readability score.</p>
    <button type="button" disabled={!vaultId||busy} onClick={()=>void analyze()}>{result?'Analyze again':'Analyze vocabulary evolution'}</button>
    {busy?<><p role="status">{cancelled?'Finishing the current read; later revisions will not be read.':'Reading retained revisions…'}</p><button type="button" disabled={cancelled} onClick={()=>{generation.current++;setCancelled(true);setError('Analysis cancelled. The current read may finish; no later revisions will be read.')}}>Cancel vocabulary analysis</button></>:null}
    {error?<p role="alert">{error}</p>:null}
    {result?<>
      <p role="status">{points.length} measured revisions; {result.failedIds.length} unavailable or oversized, {result.omitted} omitted, {result.invalidDates} invalid dates.{result.budgetReached?' Total source budget reached.':''}</p>
      {points.length?<>
        <svg viewBox="0 0 600 190" role="img" aria-label="Vocabulary evolution: distinct word count by retained revision">
          <path d="M40 10V150H580" fill="none" stroke="currentColor"/>
          <text x="4" y="18">{maximum}</text><text x="20" y="150">0</text>
          <text x="40" y="178">{points[0].saved_at.slice(0,10)}</text><text x="580" y="178" textAnchor="end">{points.at(-1)!.saved_at.slice(0,10)}</text>
          {points.map(point=><circle key={point.id} cx={last===first?310:40+540*(Date.parse(point.saved_at)-first)/(last-first)} cy={150-130*point.uniqueWords/maximum} r="4" fill="currentColor"><title>{new Date(point.saved_at).toISOString()}: {point.uniqueWords} distinct words, {point.words} words</title></circle>)}
        </svg>
        <p>Each dot is one measured revision. Missing revisions have no plotted value.</p>
        <div className="vocabulary-evolution-table"><table><caption>Measured vocabulary by retained revision</caption><thead><tr><th>Saved at</th><th>Words</th><th>Distinct words</th><th>Distinct word ratio</th></tr></thead><tbody>{points.map(point=><tr key={point.id}><th>{new Date(point.saved_at).toLocaleString()}</th><td>{point.words}</td><td>{point.uniqueWords}</td><td>{point.diversity===null?'No words':`${(point.diversity*100).toFixed(1)}%`}</td></tr>)}</tbody></table></div>
      </>:<p>No retained sources could be measured.</p>}
    </>:null}
  </section>
}

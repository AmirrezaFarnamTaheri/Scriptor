import assert from 'node:assert/strict'
import test from 'node:test'
import { loadVocabularyEvolution } from './vocabularyEvolution.ts'

test('vocabulary evolution measures complete retained sources chronologically and preserves missing revisions', async () => {
  const rows=[{id:'new',saved_at:'2026-10-02T00:00:00Z'},{id:'old',saved_at:'2026-10-01T00:00:00Z'},{id:'missing',saved_at:'2026-10-01T12:00:00Z'}]
  const result=await loadVocabularyEvolution(rows,async id=>{if(id==='missing')throw new Error('Unavailable');return id==='old'?'one one':'one two three'},()=>false)
  assert.deepEqual(result.points.map(point=>[point.id,point.words,point.uniqueWords]),[['old',2,1],['new',3,3]])
  assert.deepEqual(result.failedIds,['missing'])
  assert.equal(result.omitted,0)
})
test('analysis reads only the latest 32 valid retained revisions without inventing older measurements', async () => {
  const rows=Array.from({length:40},(_,index)=>({id:String(index),saved_at:new Date(Date.UTC(2026,0,index+1)).toISOString()}))
  const reads:string[]=[]
  const result=await loadVocabularyEvolution([...rows,{id:'bad',saved_at:'invalid'}],async id=>{reads.push(id);return 'Measured words'},()=>false)
  assert.equal(reads.length,32);assert.equal(reads[0],'8');assert.equal(reads.at(-1),'39')
  assert.equal(result.omitted,8);assert.equal(result.invalidDates,1)
})
test('cancellation during an awaited read stops later reads and prevents partial publication', async () => {
  let cancelled=false, reads=0
  await assert.rejects(loadVocabularyEvolution([{id:'1',saved_at:'2026-01-01'},{id:'2',saved_at:'2026-01-02'}],async()=>{reads++;cancelled=true;return 'words'},()=>cancelled),/cancelled/)
  assert.equal(reads,1)
})
test('oversized UTF-8 revisions remain missing measurements instead of zero-valued points', async () => {
  const result=await loadVocabularyEvolution([{id:'large',saved_at:'2026-01-01'},{id:'small',saved_at:'2026-01-02'}],async id=>id==='large'?'界'.repeat(800000):'words',()=>false)
  assert.deepEqual(result.failedIds,['large']);assert.deepEqual(result.points.map(point=>point.id),['small'])
})

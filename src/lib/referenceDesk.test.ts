import assert from 'node:assert/strict'
import test from 'node:test'
import { parseZoteroItems, referencesToBibtex, literatureNote, parseReferenceUsage } from './referenceDesk.ts'
test('Zotero preview validates bounded metadata and escapes BibTeX syntax', () => {
  const items = parseZoteroItems([{key:'AB12',title:'A {paper}',itemType:'journalArticle',creators:[{firstName:'Jane',lastName:'Doe'}],date:'2026',DOI:'10.1/example',abstractNote:'Summary'}])
  assert.equal(items[0].author, 'Jane Doe')
  assert.match(referencesToBibtex(items), /A \\{paper\\}/)
  assert.throws(() => parseZoteroItems([{key:'invalid key',title:'Paper'}]))
  assert.throws(() => parseZoteroItems(Array(101).fill({key:'A',title:'Paper'})))
  assert.throws(() => parseZoteroItems([{key:'A',title:'Paper'},{key:'A',title:'Duplicate'}]))
})
test('citation usage runtime payloads reject invalid locations and flags',()=>{
  assert.deepEqual(parseReferenceUsage({rows:[{key:'smith2024',path:'Research.md',line:1,valid:true}],truncated:false}),{rows:[{key:'smith2024',path:'Research.md',line:1,valid:true}],truncated:false})
  assert.throws(()=>parseReferenceUsage({rows:[{key:'a',path:'b',line:-1,valid:true}],truncated:false}))
  assert.throws(()=>parseReferenceUsage({rows:[],truncated:'yes'}))
})
test('literature notes preserve source metadata and citation links', () => {
  const markdown = literatureNote({key:'doe2026',title:'A paper',source_path:'refs.bib',entry_type:'article',abstract_text:'A useful result',doi:'10.1/a'})
  assert.match(markdown, /\[@doe2026\]/)
  assert.match(markdown, /A useful result/)
  assert.match(markdown, /doi.org\/10.1\/a/)
})

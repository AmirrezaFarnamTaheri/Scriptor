import { e2eNoteDocument, e2eSaveNote } from './state'

/** Opt-in browser fixture only; never imported by the production bridge. */
export function createResearchHarness() {
  const active=sessionStorage.getItem('e2e:research')==='1'
  const assets=new Map<string,string>()
  const paths=['Research Plan.md','Field Notes.md']
  if(active){e2eSaveNote(paths[0],'---\nstatus: Done\npriority: High\nscore: 12\n---\n\n# Research Plan\n\nResearch [@smith2024].');e2eSaveNote(paths[1],'---\nstatus: Draft\npriority: Low\nscore: 3\n---\n\n# Field Notes\n\nField notes.')}
  const preset='.scriptor/presets/database-studio.md'
  const record=(cmd:string,body:Record<string,unknown>)=>{const calls=JSON.parse(sessionStorage.getItem('e2e:research-calls')??'[]') as unknown[];const {apiKey: omittedKey,...safe}=body;void omittedKey;calls.push({cmd,payload:safe});sessionStorage.setItem('e2e:research-calls',JSON.stringify(calls))}
  return (cmd:string,payload:unknown):{handled:boolean;value?:unknown}=>{
    if(!active)return {handled:false}
    const body=(payload??{}) as Record<string,unknown>
    const path=String(body.path??body.relativePath??'')
    const reply=(value:unknown)=>({handled:true,value})
    const document=(target:string)=>{const doc=e2eNoteDocument(target);return {...doc,metadata:{...doc.metadata,path:target,title:target.replace(/\.md$/,'')}}}
    if(['capture_extract_preview','zotero_import_preview','reference_usage_preview','vault_save_asset','vault_save_note','vault_frontmatter_set','authorize_sensitive_operation'].includes(cmd))record(cmd,body)
    switch(cmd){
      case 'vault_read_note':
        if(path===preset&&sessionStorage.getItem('e2e:delay-db-preset')==='1'){sessionStorage.removeItem('e2e:delay-db-preset');return reply(new Promise(resolve=>setTimeout(()=>resolve({...document(path),markdown:'[]'}),10000)))}
        if(path===sessionStorage.getItem('e2e:external-row-edit')){sessionStorage.removeItem('e2e:external-row-edit');e2eSaveNote(path,document(path).markdown.replace('score: 12','score: 99'))}
        if(path===preset){if(sessionStorage.getItem('e2e:corrupt-db-preset')==='1')return reply({...document(path),markdown:'{malformed'});if(!assets.has(path))throw new Error(`note not found: ${path}`);return reply({...document(path),markdown:assets.get(path)})}
        if(paths.includes(path)||assets.has(path))return reply({...document(path),...(assets.has(path)?{markdown:assets.get(path)}:{})})
        return {handled:false}
      case 'vault_list_view_notes':return reply(paths.map(path=>({id:path,path,title:path.replace(/\.md$/,''),modified_at:'2026-10-01T00:00:00Z',tags:['research']})))
      case 'vault_save_asset':{
        if(body.expectedVaultId!=='screenshot-vault')throw new Error('Vault scope changed.')
        if(body.requireMissing&&assets.has(path))throw new Error('Destination already exists.')
        if(!Array.isArray(body.bytes))throw new Error('Invalid asset bytes.')
        const content=new TextDecoder().decode(new Uint8Array(body.bytes));assets.set(path,content);e2eSaveNote(path,content);return reply(path)
      }
      case 'vault_save_note':
        if(path===preset){const content=String(body.markdown);assets.set(path,content);return reply(e2eSaveNote(path,content))}
        return {handled:false}
      case 'vault_frontmatter_set':{
        const doc=document(path)
        if(body.expectedVaultId!=='screenshot-vault'||body.expectedContentHash!==doc.metadata.content_hash)throw new Error('Stale source note.')
        const field=String(body.field);const value=String(body.value)
        const lines=doc.markdown.split('\n');const index=lines.findIndex(line=>line.startsWith(`${field}:`));if(index<0)lines.splice(1,0,`${field}: ${value}`);else lines[index]=`${field}: ${value}`
        const markdown=lines.join('\n');e2eSaveNote(path,markdown);return reply({path,field,value,markdown})
      }
      case 'capture_extract_preview':{
        if(sessionStorage.getItem('e2e:capture-failure')==='1')throw new Error('Article extraction unavailable.')
        const result={url:String(body.url),title:'Reviewed article',site_name:'Example journal',published_at:'2026-10-01',word_count:6,markdown:'# Article\n\nA useful research finding.',source_html:'<article><h1>Original research finding</h1><p>Source context retained only in this preview.</p><script>window.parent.snapshotExecuted=true</script><img src="https://example.org/tracker.png"><form action="https://example.org/post"><input name="secret"></form><a href="https://example.org/leave">Link text</a></article>'}
        if(sessionStorage.getItem('e2e:capture-delay')==='1')return reply(new Promise(resolve=>setTimeout(()=>resolve(result),5000)))
        return reply(result)
      }
      case 'zotero_import_preview':return reply({items:body.start===100?[{key:'PAGE2',title:'Second-page paper',creators:[],itemType:'book',date:'2025'}]:[{key:'ZOTERO1',title:'A previewed research paper',abstractNote:'An abstract worth reviewing.',creators:[{firstName:'Jane',lastName:'Smith'}],date:'2026',itemType:'journalArticle',DOI:'10.1/example'}],nextStart:body.start===100?null:100})
      case 'reference_usage_preview':return reply({rows:[{key:'smith2024',path:paths[0],line:8,valid:true},{key:'missing2026',path:paths[1],line:7,valid:false}],truncated:false})
      case 'indexer_list_bibliography':return reply([{key:'smith2024',title:'Research Methods',author:'Smith, Jane',year:'2024',source_path:'references.bib',entry_type:'article',abstract_text:'Methods for careful research.',doi:'10.1/methods'}])
      default:return {handled:false}
    }
  }
}

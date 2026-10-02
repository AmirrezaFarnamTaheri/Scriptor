import type { BibliographyEntry } from '../types/vault'
export interface ZoteroReference { key: string; title: string; author: string; year: string; abstract: string; doi: string; url: string; itemType: string }
export interface ReferenceUsageReport {rows:{key:string;path:string;line:number;valid:boolean}[];truncated:boolean}
export function parseReferenceUsage(payload:unknown):ReferenceUsageReport{
  if(!payload||typeof payload!=='object'||!('rows' in payload)||!Array.isArray(payload.rows)||payload.rows.length>5000||!('truncated' in payload)||typeof payload.truncated!=='boolean')throw new Error('Invalid citation usage report.')
  return {rows:payload.rows.map((raw:unknown)=>{
    if(!raw||typeof raw!=='object'||!('key'in raw)||!('path'in raw)||!('line'in raw)||!('valid'in raw)||typeof raw.key!=='string'||!raw.key||raw.key.length>1024||typeof raw.path!=='string'||!raw.path||raw.path.length>4096||typeof raw.line!=='number'||!Number.isSafeInteger(raw.line)||raw.line<1||typeof raw.valid!=='boolean')throw new Error('Invalid citation usage location.')
    return {key:raw.key,path:raw.path,line:raw.line,valid:raw.valid}
  }),truncated:payload.truncated}
}
function text(value: unknown, limit = 16384): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string' || value.length > limit) throw new Error('Invalid reference metadata.')
  return value
}
export function parseZoteroItems(value: unknown): ZoteroReference[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('Zotero preview exceeds the 100-item page limit.')
  const seen=new Set<string>()
  return value.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid Zotero item.')
    const row = raw as Record<string, unknown>; const key = text(row.key,128)
    if (!/^[A-Za-z0-9_-]+$/.test(key)) throw new Error('Invalid reference key.')
    if(seen.has(key))throw new Error('Duplicate reference key in preview.');seen.add(key)
    const creators = row.creators ?? []
    if (!Array.isArray(creators) || creators.length > 100) throw new Error('Invalid reference authors.')
    const author = creators.map((creator: unknown) => {
      if (!creator || typeof creator !== 'object') throw new Error('Invalid reference author.')
      const person = creator as Record<string, unknown>
      return text(person.name,512) || [text(person.firstName,256),text(person.lastName,256)].filter(Boolean).join(' ')
    }).filter(Boolean).join(' and ')
    return {key,title:text(row.title,4096),author,year:text(row.date,256),abstract:text(row.abstractNote),doi:text(row.DOI,2048),url:text(row.url,4096),itemType:text(row.itemType,128)}
  })
}
function bib(value: string): string { return value.replace(/[\\{}]/g,character=>character==='\\'?'\\textbackslash{}':`\\${character}`).replace(/[\r\n]/g,' ') }
export function referencesToBibtex(items: ZoteroReference[]): string {
  if (!items.length || items.length > 1000 || new Set(items.map((item) => item.key)).size !== items.length) throw new Error('Select 1–1000 unique references.')
  return items.map((item) => {
    if (!/^[A-Za-z0-9_-]+$/.test(item.key)) throw new Error('Invalid reference key.')
    const fields = {title:item.title,author:item.author,year:item.year.match(/\d{4}/)?.[0] ?? '',abstract:item.abstract,doi:item.doi,url:item.url}
    return `@${item.itemType === 'journalArticle' ? 'article' : item.itemType === 'book' ? 'book' : 'misc'}{${item.key},\n${Object.entries(fields).filter(([,value]) => value).map(([key,value]) => `  ${key} = {${bib(value)}}`).join(',\n')}\n}`
  }).join('\n\n')+'\n'
}
export function literatureNote(entry: BibliographyEntry): string {
  if (!/^[A-Za-z0-9_:./+-]+$/.test(entry.key)) throw new Error('This citation key cannot be used in a literature note.')
  const title = entry.title.replace(/[\r\n]/g,' ')
  const url = entry.url || (entry.doi ? `https://doi.org/${entry.doi}` : '')
  return `---\ntitle: ${JSON.stringify(title)}\ncitation_key: ${JSON.stringify(entry.key)}\nbibliography: ${JSON.stringify(entry.source_path)}\ntags: [literature]\n---\n\n# ${title}\n\n[@${entry.key}]\n\n${entry.author ?? ''}${entry.year ? ` (${entry.year})` : ''}\n\n${url ? `Source: ${url}\n\n` : ''}## Abstract\n\n${entry.abstract_text || 'No abstract supplied.'}\n\n## Notes\n\n`
}

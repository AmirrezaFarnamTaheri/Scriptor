export interface ReviewedCapture { url: string; title: string; author: string; published: string; tags: string; markdown: string }
export interface CaptureExtraction {url:string;title:string;site_name:string|null;published_at:string|null;markdown:string;word_count:number;source_html:string}
export function parseCaptureExtraction(payload:unknown):CaptureExtraction {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid capture result')
  const row=payload as Record<string,unknown>
  const encoder=new TextEncoder()
  if(typeof row.url!=='string'||row.url.length>4096||typeof row.title!=='string'||row.title.length>4096||typeof row.markdown!=='string'||encoder.encode(row.markdown).byteLength>2*1024*1024||typeof row.source_html!=='string'||encoder.encode(row.source_html).byteLength>2*1024*1024||typeof row.word_count!=='number'||!Number.isSafeInteger(row.word_count)||row.word_count<0||row.word_count>2*1024*1024)throw new Error('Invalid capture result')
  const url=new URL(row.url)
  if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443'))throw new Error('Invalid capture source URL')
  for(const field of ['site_name','published_at'])if(row[field]!==null&&(typeof row[field]!=='string'||(row[field] as string).length>4096))throw new Error('Invalid capture metadata')
  if(encoder.encode(JSON.stringify(payload)).byteLength>8*1024*1024)throw new Error('Capture response exceeds its 8 MiB limit')
  return {url:row.url,title:row.title,markdown:row.markdown,source_html:row.source_html,site_name:row.site_name as string|null,published_at:row.published_at as string|null,word_count:row.word_count}
}
export function captureTarget(directory: string, title: string): string {
  const folder = directory.trim().replace(/\\/g,'/')
  if (/^\/|:|[\u0000-\u001f]/.test(folder) || folder.split('/').some((part) => part === '..' || part === '.' || (!part && folder))) throw new Error('Choose a relative vault directory without traversal.')
  const name = title.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').replace(/[. ]+$/,'').slice(0,180)
  if (!name || /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(name)) throw new Error('Enter a valid note title.')
  return `${folder ? folder+'/' : ''}${name}.md`
}
export function captureMarkdown(item: ReviewedCapture): string {
  const url = new URL(item.url)
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Enter a public HTTPS URL without credentials or a custom port.')
  if (!item.title.trim() || item.markdown.length > 2*1024*1024 || item.title.length > 4096 || item.author.length > 4096 || item.tags.length > 4096) throw new Error('Capture exceeds the metadata or content limit.')
  if (item.published && !/^\d{4}-\d{2}-\d{2}$/.test(item.published)) throw new Error('Use YYYY-MM-DD for the publication date.')
  if(item.published){const date=new Date(item.published);if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==item.published)throw new Error('Choose a valid publication date.')}
  const tags = item.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
  const content=`---\ntitle: ${JSON.stringify(item.title.trim())}\nsource_url: ${JSON.stringify(url.href)}\nauthor: ${JSON.stringify(item.author)}\npublished: ${JSON.stringify(item.published)}\ntags: ${JSON.stringify(tags)}\n---\n\n${item.markdown}\n`
  if(new TextEncoder().encode(content).byteLength>2*1024*1024)throw new Error('Reviewed capture exceeds the 2 MiB content limit.')
  return content
}

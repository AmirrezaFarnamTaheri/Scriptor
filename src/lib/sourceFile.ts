export const SOURCE_FILE_LIMIT = 2 * 1024 * 1024
const languages: Record<string, string> = { tex: 'latex', ltx: 'latex', py: 'python', rs: 'rust', js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml', txt: 'text', css: 'css', html: 'html', htm: 'html', xml: 'xml', csv: 'text', sh: 'shell', sql: 'sql', bib: 'bibtex', ini: 'text', cfg: 'text', c: 'c', h: 'c', cpp: 'cpp', java: 'java' }
export function sourceLanguage(path: string): string | null {
  if (!path || path.length > 1024 || /[\\:%\u0000-\u001f\u007f]/.test(path) || path.startsWith('/') || path.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.') || /[. ]$/.test(part))) return null
  return languages[path.split('.').pop()?.toLowerCase() ?? ''] ?? null
}
export interface SourceDocument { vault_id: string; path: string; content: string; content_hash: string; language: string }
export function isSourceFilePath(path: string): boolean { return sourceLanguage(path) !== null }
export function parseSourceDocument(value: unknown, vaultId: string, path: string): SourceDocument {
  if (!value || typeof value !== 'object') throw new Error('Invalid source document')
  const row = value as Partial<SourceDocument>
  if (row.vault_id !== vaultId || row.path !== path || row.language !== sourceLanguage(path) || typeof row.content !== 'string' || new TextEncoder().encode(row.content).length > SOURCE_FILE_LIMIT || row.content.includes('\0') || typeof row.content_hash !== 'string' || !/^[a-f0-9]{64}$/.test(row.content_hash)) throw new Error('Source document failed identity or content validation')
  return row as SourceDocument
}

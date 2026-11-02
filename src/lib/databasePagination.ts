/**
 * Bounded native indexed view page selection. Lookahead proves another page,
 * not a full-vault match count, and is never displayed as an editable note.
 */
export interface DatabasePageHit { readonly path: string; readonly title: string }
export interface DatabasePage {
  readonly candidates: readonly DatabasePageHit[]
  readonly nextCursor: string | null
}
/** SQLite path ORDER BY uses UTF-8 BINARY collation; JS UTF-16 can differ for astral characters. */
function utf8After(path: string, previous: string): boolean {
  const encoder = new TextEncoder()
  const a = encoder.encode(path)
  const b = encoder.encode(previous)
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i]
  }
  return a.length > b.length
}
/** A candidate or cursor must be vault-relative; native read authorization remains authoritative. */
function isVaultRelativeNotePath(path: unknown): path is string {
  return typeof path === 'string' && path.length > 0 && path.length <= 4096 &&
    !path.startsWith('/') && !path.includes('\\') && !path.includes(':') &&
    !/[\u0000-\u001F\u007F]/.test(path) &&
    path.split('/').every(segment => segment !== '' && segment !== '.' && segment !== '..')
}
export function selectDatabasePage(
  hits: readonly DatabasePageHit[],
  pageSize: number,
  afterPath: string | null = null,
): DatabasePage {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 200 ||
      !Array.isArray(hits) || hits.length > pageSize + 1) {
    throw new Error('Invalid indexed database page limit or response size.')
  }
  if (afterPath !== null && !isVaultRelativeNotePath(afterPath)) {
    throw new Error('Invalid database pagination cursor.')
  }
  let previous = afterPath
  for (const hit of hits) {
    if (!hit || !isVaultRelativeNotePath(hit.path) ||
        typeof hit.title !== 'string' || hit.title.length > 4096) {
      throw new Error('Invalid native database page result.')
    }
    if (previous !== null && !utf8After(hit.path, previous)) {
      throw new Error('Native database page is not in strict cursor order.')
    }
    previous = hit.path
  }
  const candidates = hits.slice(0, pageSize)
  return { candidates, nextCursor: hits.length > pageSize ? candidates[candidates.length - 1]?.path ?? null : null }
}

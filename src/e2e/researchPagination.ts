/** Match the native indexed-view path keyset contract in the browser fixture.
 * The real writer/query authority remains Rust; this only models read pages.
 */
export function pageResearchViewHits<T extends { readonly path: string }>(
  hits: readonly T[], afterPath: string | null, pageSize: number,
): T[] {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 201) {
    throw new Error('Invalid research fixture page size.')
  }
  if (afterPath !== null && (typeof afterPath !== 'string' || !afterPath)) {
    throw new Error('Invalid research fixture cursor.')
  }
  const encoder = new TextEncoder()
  const compare = (first: string, second: string): number => {
    const left = encoder.encode(first)
    const right = encoder.encode(second)
    for (let i = 0; i < Math.min(left.length, right.length); i += 1) {
      if (left[i] !== right[i]) return left[i] - right[i]
    }
    return left.length - right.length
  }
  return [...hits]
    .sort((a, b) => compare(a.path, b.path))
    .filter(hit => afterPath === null || compare(hit.path, afterPath) > 0)
    .slice(0, pageSize)
}

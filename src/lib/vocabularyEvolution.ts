import { vocabularyMetrics } from './researchStudio.ts'

export interface VocabularyPoint { id: string; saved_at: string; words: number; uniqueWords: number; diversity: number | null }
export interface VocabularyEvolution { points: VocabularyPoint[]; failedIds: string[]; omitted: number; invalidDates: number; budgetReached: boolean }

/** Explicitly measures real sources, at most 32 revisions and 16 MiB total.
 * Missing/oversized revisions are gaps, never zero-valued invented results. */
export async function loadVocabularyEvolution(
  revisions: { id: string; saved_at: string }[],
  readRevision: (id: string) => Promise<string>,
  isCancelled: () => boolean,
): Promise<VocabularyEvolution> {
  const bounded = revisions.slice(0, 1000)
  const valid = bounded.filter(row => Number.isFinite(Date.parse(row.saved_at)))
    .sort((a,b) => Date.parse(a.saved_at)-Date.parse(b.saved_at) || a.id.localeCompare(b.id))
  const selected = valid.slice(-32)
  const result: VocabularyEvolution = { points: [], failedIds: [], omitted: Math.max(0,valid.length-selected.length)+Math.max(0,revisions.length-bounded.length), invalidDates: bounded.length-valid.length, budgetReached: false }
  const encoder = new TextEncoder()
  let bytes = 0
  for (let index=0;index<selected.length;index++) {
    const revision = selected[index]
    if (isCancelled()) throw new Error('Vocabulary analysis cancelled.')
    let markdown: string
    try { markdown = await readRevision(revision.id) }
    catch {
      if (isCancelled()) throw new Error('Vocabulary analysis cancelled.')
      result.failedIds.push(revision.id);continue
    }
    if (isCancelled()) throw new Error('Vocabulary analysis cancelled.')
    if (typeof markdown !== 'string' || markdown.length > 2*1024*1024) { result.failedIds.push(revision.id);continue }
    const size = encoder.encode(markdown).byteLength
    if (size > 2*1024*1024) { result.failedIds.push(revision.id);continue }
    if (bytes+size > 16*1024*1024) {
      result.omitted += selected.length-index;result.budgetReached=true;break
    }
    bytes += size
    result.points.push({ id: revision.id, saved_at: revision.saved_at, ...vocabularyMetrics(markdown) })
  }
  return result
}

import type { SearchHit } from '../types/vault'

const RRF_K = 60

function keywordRanks(hits: SearchHit[]): Map<string, number> {
  const ranks = new Map<string, number>()
  hits.forEach((hit, index) => ranks.set(hit.path, index + 1))
  return ranks
}

function semanticRanks(paths: string[]): Map<string, number> {
  const ranks = new Map<string, number>()
  paths.forEach((path, index) => ranks.set(path, index + 1))
  return ranks
}

/**
 * Reciprocal-rank fusion of the keyword and semantic result lists.
 * Keyword hits keep their FTS snippet; semantic-only hits inherit the
 * semantic score as a snippet marker and are flagged for the UI badge.
 */
export function fuseKeywordAndSemantic(
  keywordHits: SearchHit[],
  semanticHits: Array<{ note_path: string; score: number }>,
  maxResults: number,
): SearchHit[] {
  const semanticByPath = new Map(semanticHits.map((hit) => [hit.note_path, hit]))
  const keywordRank = keywordRanks(keywordHits)
  const semanticRank = semanticRanks(semanticHits.map((hit) => hit.note_path))

  const fused = new Map<string, { hit: SearchHit; score: number }>()
  const consider = (hit: SearchHit) => {
    const kr = keywordRank.get(hit.path)
    const sr = semanticRank.get(hit.path)
    let score = 0
    if (kr !== undefined) score += 1 / (RRF_K + kr)
    if (sr !== undefined) score += 1 / (RRF_K + sr)
    if (sr !== undefined) hit.semantic = true
    const previous = fused.get(hit.path)
    if (!previous || score > previous.score) fused.set(hit.path, { hit, score })
  }
  keywordHits.forEach(consider)
  for (const [path] of semanticRank) {
    if (!fused.has(path)) {
      const semanticHit = semanticByPath.get(path)
      if (semanticHit) {
        consider({
          note_id: path,
          path,
          title: path.split('/').pop() ?? path,
          snippet: `semantic match · score ${semanticHit.score.toFixed(3)}`,
          semantic: true,
        })
      }
    }
  }

  return [...fused.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, maxResults)
    .map((entry) => entry.hit)
}
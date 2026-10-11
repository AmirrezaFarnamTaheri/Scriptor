import { useCallback, useEffect, useMemo, useState } from 'react'
import { applyRendererExtensions } from '@scriptor/renderer'
import { renderPreviewCitations } from '../lib/citationPreview'
import { formatCitationClustersWithCiteproc } from '../lib/citeprocClient'
import { parseCitationTokens } from '../lib/citationClusters'
import type { BibliographyEntry } from '../types/vault'

export function useCitationPostProcess(markdown: string, bibliography: BibliographyEntry[], extensions: Parameters<typeof applyRendererExtensions>[1], unresolvedLabel: string) {
  const citations = useRenderedCitationPreview(markdown, bibliography)
  return useCallback((html: string) => renderPreviewCitations(applyRendererExtensions(html, extensions), bibliography, unresolvedLabel, citations), [extensions, bibliography, unresolvedLabel, citations])
}

export function useRenderedCitationPreview(markdown: string, bibliography: BibliographyEntry[]) {
  const clusters = useMemo(() => [...new Map(parseCitationTokens(markdown).map(token => [token.source, token.cluster])).values()].slice(0, 2000), [markdown])
  const [result, setResult] = useState<{ bibliography: BibliographyEntry[]; clusters: typeof clusters; values: ReadonlyMap<string, string> } | null>(null)
  useEffect(() => {
    if (clusters.length === 0 || bibliography.length === 0) return
    let cancelled = false
    const timeout = window.setTimeout(() => {
      void formatCitationClustersWithCiteproc(bibliography, clusters).then(values => {
        if (!cancelled) setResult({ bibliography, clusters, values })
      }).catch(() => { /* The preview retains its explicit, source-preserving fallback. */ })
    }, 150)
    return () => { cancelled = true; window.clearTimeout(timeout) }
  }, [bibliography, clusters])
  return result?.bibliography === bibliography && result.clusters === clusters ? result.values : undefined
}

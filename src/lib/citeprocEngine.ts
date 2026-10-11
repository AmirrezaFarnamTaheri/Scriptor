import CSL from 'citeproc/citeproc_commonjs.js'
import { bibliographyEntriesToCslItems } from './bibliographyToCsl.ts'
import type { BibliographyEntry } from '../types/vault'

export interface CslCitationItem {
  id: string
  prefix?: string
  suffix?: string
  locator?: string
  label?: string
  'suppress-author'?: boolean
  'author-only'?: boolean
}
export interface CslCitationCluster {
  source: string
  items: CslCitationItem[]
  narrative?: boolean
}

/** Keep processor work off the editor thread and use the installed API contract. */
export function formatCslEntries(styleXml: string, localeXml: string, entries: BibliographyEntry[], keys?: string[], clusters: CslCitationCluster[] = []) {
  if (entries.length > 5000 || clusters.length > 2000) throw new Error('citation preview exceeds its bounded processing limit')
  const items = bibliographyEntriesToCslItems(entries)
  const engine = new CSL.Engine({
    retrieveLocale: lang => lang === 'us' || lang === 'en-US' ? localeXml : false,
    retrieveItem: id => items[id] ?? null,
  }, styleXml)
  engine.setOutputFormat('text')
  engine.updateItems(Object.keys(items))
  const preview = (citationItems: CslCitationItem[]) => engine.previewCitationCluster(
    { citationItems, properties: { noteIndex: 0 } }, [], [], 'text',
  ).trim()
  const inline: Record<string, string> = Object.create(null)
  const bibliography: Record<string, string> = Object.create(null)
  const formattedClusters: Record<string, string> = Object.create(null)
  const bib = engine.makeBibliography()
  const entryIds = bib[0]?.entry_ids
  if (Array.isArray(entryIds)) {
    entryIds.forEach((ids: unknown, index: number) => {
      if (!Array.isArray(ids)) return
      for (const id of ids) {
        if (typeof id === 'string') bibliography[id] = (bib[1]?.[index] ?? items[id]?.title?.toString() ?? id).trim()
      }
    })
  }
  for (const key of (keys?.length ? keys : entries.map(entry => entry.key)).filter(key => items[key])) {
    inline[key] = preview([{ id: key }])
    bibliography[key] ??= items[key]?.title?.toString() ?? key
  }
  for (const cluster of clusters) {
    if (cluster.items.length === 0 || cluster.items.some(item => !items[item.id])) continue
    if (cluster.narrative) {
      const author = preview(cluster.items.map(item => ({ ...item, 'author-only': true })))
      const date = preview(cluster.items.map(item => ({ ...item, 'suppress-author': true })))
      formattedClusters[cluster.source] = `${author} ${date}`.trim()
    } else formattedClusters[cluster.source] = preview(cluster.items)
  }
  return { inline, bibliography, clusters: formattedClusters }
}

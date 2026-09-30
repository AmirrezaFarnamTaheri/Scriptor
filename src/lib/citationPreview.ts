import { formatInlineCitation } from './citationFormat.ts'
import type { BibliographyEntry } from '../types/vault'
import { parseCitationTokens } from './citationClusters.ts'

export interface PreviewCitation {
  source: string
  text: string
  keys: string[]
  resolved: boolean
}

/** Preserve prefixes, locators, grouped citations, and author suppression. */
export function formatPreviewCitation(source: string, bibliography: BibliographyEntry[]): PreviewCitation | null {
  return formatCitation(source, new Map(bibliography.map(entry => [entry.key, entry])))
}

function formatCitation(source: string, entries: ReadonlyMap<string, BibliographyEntry>): PreviewCitation | null {
  const bracketed = source.startsWith('[') && source.endsWith(']')
  if (!bracketed && !/^-?@/.test(source)) return null
  const keys: string[] = []
  let resolved = true
  const body = (bracketed ? source.slice(1, -1) : source).replace(
    /(^|[\s;])(-?)@(?:\{([^}]+)\}|([A-Za-z][A-Za-z0-9:_#.$/-]*))/g,
    (_match, prefix: string, suppressAuthor: string, braced: string | undefined, plain: string | undefined) => {
      const key = (braced ?? plain ?? '').replace(/[.,;:]+$/, '')
      const punctuation = plain ? plain.slice(key.length) : ''
      keys.push(key)
      const entry = entries.get(key)
      if (!entry) {
        resolved = false
        return `${prefix}${suppressAuthor}@${braced ? `{${braced}}` : plain}`
      }
      const inline = suppressAuthor ? entry.year?.trim() || entry.key : formatInlineCitation(entry).replace(/^\((.*)\)$/, '$1')
      return `${prefix}${inline}${punctuation}`
    },
  )
  if (keys.length === 0) return null
  const entry = entries.get(keys[0])
  const narrative = !bracketed && !source.startsWith('-@')
  const text = narrative && entry ? `${entry.author?.trim() || entry.key}${entry.year?.trim() ? ` (${entry.year.trim()})` : ''}` : `(${body})`
  return { source, text: resolved ? text : source, keys, resolved }
}

/** Transform text nodes only; bibliography text never becomes executable HTML. */
export function renderPreviewCitations(html: string, bibliography: BibliographyEntry[], unresolvedLabel: string, cslText?: ReadonlyMap<string, string>): string {
  const entries = new Map(bibliography.map(entry => [entry.key, entry]))
  const template = document.createElement('template')
  template.innerHTML = html
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (!node.parentElement?.closest('code, pre, a, script, style, .preview-citation')) nodes.push(node)
  }
  for (const node of nodes) {
    const text = node.data
    const fragment = document.createDocumentFragment()
    let end = 0
    for (const token of parseCitationTokens(text)) {
      const citation = formatCitation(token.source, entries)
      if (!citation) continue
      fragment.append(document.createTextNode(text.slice(end, token.index)))
      const span = document.createElement('span')
      span.className = 'preview-citation'
      span.dataset.resolved = String(citation.resolved)
      span.textContent = cslText?.get(token.source) ?? citation.text
      span.title = citation.resolved ? citation.source : `${unresolvedLabel}: ${citation.keys.join(', ')}`
      if (!citation.resolved) span.setAttribute('aria-label', `${unresolvedLabel}: ${citation.source}`)
      fragment.append(span)
      end = token.index + token.source.length
    }
    if (end > 0) {
      fragment.append(document.createTextNode(text.slice(end)))
      node.replaceWith(fragment)
    }
  }
  return template.innerHTML
}

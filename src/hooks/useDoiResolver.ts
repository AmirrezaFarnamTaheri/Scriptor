/**
 * DOI / arXiv / ISBN metadata resolver.
 *
 * Fetches structured citation metadata from open APIs:
 *   - DOI  -> CrossRef (https://api.crossref.org)
 *   - arXiv ID -> arXiv export API
 *   - ISBN -> Open Library
 *
 * All requests are explicit-action-only (user paste -> resolve).
 * No ambient background network activity.
 */

import { useState, useCallback } from 'react'

export interface CitationMetadata {
  title: string
  authors: string[]
  year: string
  doi?: string
  journal?: string
  publisher?: string
  url?: string
  isbn?: string
  arxiv?: string
}

type ResolveState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'resolved'; metadata: CitationMetadata }
  | { status: 'error'; message: string }

function detectInputType(input: string): 'doi' | 'arxiv' | 'isbn' | 'unknown' {
  const trimmed = input.trim()
  if (/^10\.\d{4,}\//.test(trimmed) || /^https?:\/\/doi\.org\//.test(trimmed)) return 'doi'
  if (/^(arxiv:|https?:\/\/arxiv\.org\/(abs|pdf)\/)?[\d.]+v?\d*$/i.test(trimmed)) return 'arxiv'
  if (/^(?:isbn[:\s]?)?(?:\d[\s-]?){9}[\dxX]$|^(?:isbn[:\s]?)?(?:\d[\s-]?){13}$/i.test(trimmed)) return 'isbn'
  return 'unknown'
}

async function resolveDoi(doi: string): Promise<CitationMetadata> {
  const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//, '')
  const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`, {
    headers: { 'User-Agent': 'Scriptor/1.0 (https://github.com/AmirrezaFarnamTaheri/Scriptor)' },
  })
  if (!res.ok) throw new Error(`CrossRef returned ${res.status}`)
  const json = (await res.json()) as { message: { title: string[]; author: Array<{ given: string; family: string }>; published: { 'date-parts': number[][] }; 'container-title': string[]; publisher: string; URL: string } }
  const msg = json.message
  return {
    title: msg.title?.[0] ?? '',
    authors: (msg.author ?? []).map((a) => `${a.given ?? ''} ${a.family ?? ''}`.trim()),
    year: String(msg.published?.['date-parts']?.[0]?.[0] ?? ''),
    doi: cleanDoi,
    journal: msg['container-title']?.[0],
    publisher: msg.publisher,
    url: msg.URL,
  }
}

async function resolveArxiv(id: string): Promise<CitationMetadata> {
  const cleanId = id.replace(/^(arxiv:|https?:\/\/arxiv\.org\/(abs|pdf)\/)/i, '').replace(/v\d+$/, '')
  const url = `https://export.arxiv.org/abs/${encodeURIComponent(cleanId)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`arXiv returned ${res.status}`)
  const text = await res.text()
  const titleMatch = /<title>(.*?)<\/title>/s.exec(text)
  const authorMatches = [...text.matchAll(/<a[^>]*>([^<]+)<\/a>/g)].slice(1, 8).map((m) => m[1])
  const yearMatch = /Submitted on \d+ \w+ (\d{4})/.exec(text)
  return {
    title: titleMatch?.[1]?.replace(/\[.*?\]/, '').trim() ?? '',
    authors: authorMatches,
    year: yearMatch?.[1] ?? '',
    arxiv: cleanId,
    url: `https://arxiv.org/abs/${cleanId}`,
  }
}

async function resolveIsbn(isbn: string): Promise<CitationMetadata> {
  const cleanIsbn = isbn.replace(/[^0-9xX]/gi, '')
  const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`)
  if (!res.ok) throw new Error(`Open Library returned ${res.status}`)
  const json = await res.json() as Record<string, { title: string; authors: Array<{ name: string }>; publish_date: string; publishers: Array<{ name: string }>; url: string }>
  const book = json[`ISBN:${cleanIsbn}`]
  if (!book) throw new Error('ISBN not found in Open Library')
  return {
    title: book.title ?? '',
    authors: (book.authors ?? []).map((a) => a.name),
    year: book.publish_date?.replace(/.*(\d{4}).*/, '$1') ?? '',
    isbn: cleanIsbn,
    publisher: book.publishers?.[0]?.name,
    url: book.url,
  }
}

/**
 * Formats resolved metadata as YAML frontmatter lines.
 */
export function metadataToFrontmatter(meta: CitationMetadata): string {
  const lines: string[] = ['---']
  if (meta.title) lines.push(`title: "${meta.title.replace(/"/g, '\\"')}"`)
  if (meta.authors.length) lines.push(`authors:\n${meta.authors.map((a) => `  - "${a}"`).join('\n')}`)
  if (meta.year) lines.push(`year: ${meta.year}`)
  if (meta.doi) lines.push(`doi: "${meta.doi}"`)
  if (meta.journal) lines.push(`journal: "${meta.journal}"`)
  if (meta.publisher) lines.push(`publisher: "${meta.publisher}"`)
  if (meta.arxiv) lines.push(`arxiv: "${meta.arxiv}"`)
  if (meta.isbn) lines.push(`isbn: "${meta.isbn}"`)
  if (meta.url) lines.push(`url: "${meta.url}"`)
  lines.push('---')
  return lines.join('\n')
}

/**
 * React hook for resolving DOI / arXiv / ISBN to citation metadata.
 * Network calls only happen when `resolve()` is explicitly invoked.
 */
export function useDoiResolver() {
  const [state, setState] = useState<ResolveState>({ status: 'idle' })

  const resolve = useCallback(async (input: string) => {
    const trimmed = input.trim()
    if (!trimmed) return
    setState({ status: 'loading' })
    try {
      const kind = detectInputType(trimmed)
      let metadata: CitationMetadata
      if (kind === 'doi') {
        metadata = await resolveDoi(trimmed)
      } else if (kind === 'arxiv') {
        metadata = await resolveArxiv(trimmed)
      } else if (kind === 'isbn') {
        metadata = await resolveIsbn(trimmed)
      } else {
        throw new Error('Cannot detect input type. Paste a DOI (10.xxx/...), arXiv ID, or ISBN.')
      }
      setState({ status: 'resolved', metadata })
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }, [])

  const reset = useCallback(() => setState({ status: 'idle' }), [])

  return { state, resolve, reset }
}
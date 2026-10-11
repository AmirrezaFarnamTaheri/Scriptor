/**
 * Convert indexer/Markdown snippets into compact, human-readable search previews.
 *
 * FTS5 wraps matched terms in [[...]], which collides with Scriptor wikilink
 * syntax. Running the wikilink pass twice collapses both an ordinary wikilink
 * and a highlighted wikilink such as [[[[Methodology]]]] without mutating the
 * indexed source text.
 */
import { TASK_CHECKBOX_CLASS_SOURCE } from '@scriptor/core/task'

export function formatSearchSnippet(snippet: string): string {
  let value = snippet
  const wikilink = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

  for (let pass = 0; pass < 2; pass += 1) {
    value = value.replace(wikilink, (_match, target: string, label?: string) => (label ?? target).trim())
  }

  return value
    // FTS snippets may be clipped at either edge, leaving only one half of the
    // [[...]] marker pair. Search previews are plain text, so any residual
    // double brackets are marker debris rather than useful presentation.
    .replace(/\[\[|\]\]/g, '')
    .replace(/(^|\s)#{1,6}\s+/g, '$1')
    // Strip the task marker with the same character set the editor parses, so
    // a snippet of `- [/] Draft methodology` does not show the raw `[/]`.
    .replace(new RegExp(`(^|\\s)[*-]\\s+\\[[${TASK_CHECKBOX_CLASS_SOURCE}]\\]\\s+`, 'g'), '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface SearchSnippetPart { text: string; matched: boolean }

/** Literal query emphasis is a reading aid, not a reconstruction of FTS rank.
 * Build React text/mark nodes from these parts; never interpret snippet HTML. */
export function searchSnippetParts(snippet: string, query: string): SearchSnippetPart[] {
  const text = formatSearchSnippet(snippet.slice(0,16_384)).normalize('NFC')
  const plainQuery = query.slice(0,1024).normalize('NFC').replace(/\b(?:path|tag|type|title):(?:"[^"]*"|\S+)/gi,'')
  const terms = [...new Set((plainQuery.match(/[\p{L}\p{N}]+(?:(?:'|\u200c|\u200d|-)[\p{L}\p{N}]+)*/gu)??[])
    .filter(term=>term.length<=64&&!/^(AND|OR|NOT|NEAR)$/i.test(term)))].slice(0,32)
  if(!terms.length)return [{text,matched:false}]
  const escaped=terms.sort((a,b)=>b.length-a.length).map(term=>term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))
  const pattern=new RegExp(`(?<![\\p{L}\\p{N}_\\u200c\\u200d])(?:${escaped.join('|')})(?![\\p{L}\\p{N}_\\u200c\\u200d])`,'giu')
  const parts:SearchSnippetPart[]=[]
  let offset=0
  for(const match of text.matchAll(pattern)) {
    if(match.index>offset)parts.push({text:text.slice(offset,match.index),matched:false})
    parts.push({text:match[0],matched:true});offset=match.index+match[0].length
  }
  if(offset<text.length||!parts.length)parts.push({text:text.slice(offset),matched:false})
  return parts
}

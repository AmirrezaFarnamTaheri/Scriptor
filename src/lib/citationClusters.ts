import type { CslCitationCluster, CslCitationItem } from './citeprocEngine'

const KEY = String.raw`(?:\{([^}]+)\}|([A-Za-z][A-Za-z0-9:_#.$/-]*))`
const TOKEN = new RegExp(String.raw`\[[^\]\n]*@[^\]\n]*\]|(?<![\w@/])(-?)@${KEY}`, 'g')

export interface CitationToken { source: string; index: number; cluster: CslCitationCluster }

/** Parse citation grammar only; the HTML walker owns code/link exclusions. */
export function parseCitationTokens(text: string): CitationToken[] {
  const tokens: CitationToken[] = []
  for (const match of text.matchAll(TOKEN)) {
    let source = match[0]
    if (source.startsWith('[')) {
      const items: CslCitationItem[] = []
      for (const segment of source.slice(1, -1).split(';')) {
        const item = new RegExp(String.raw`^(.*?)(-?)@${KEY}(.*)$`).exec(segment)
        if (!item || (item[1] && !/\s$/.test(item[1]))) { items.length = 0; break }
        const id = (item[3] ?? item[4]).replace(/[.,;:]+$/, '')
        const suffix = item[5].trim()
        const locator = /^,\s*(pp?\.?|pages?|chap(?:ter)?\.?|sec(?:tion)?\.?)\s+(.+)$/i.exec(suffix)
        items.push({
          id,
          ...(item[1].trim() ? { prefix: `${item[1].trim()} ` } : {}),
          ...(item[2] ? { 'suppress-author': true } : {}),
          ...(locator ? { label: /^chap/i.test(locator[1]) ? 'chapter' : /^sec/i.test(locator[1]) ? 'section' : 'page', locator: locator[2] } : suffix ? { suffix } : {}),
        })
      }
      if (items.length > 0) tokens.push({ source, index: match.index, cluster: { source, items } })
    } else {
      const id = (match[2] ?? match[3]).replace(/[.,;:]+$/, '')
      source = source.replace(/[.,;:]+$/, '')
      tokens.push({ source, index: match.index, cluster: { source, items: [{ id, ...(match[1] ? { 'suppress-author': true } : {}) }], narrative: !match[1] } })
    }
  }
  return tokens
}

import type { InlineParser } from '@lezer/markdown'

export interface WikilinkParserConfig {
  format?: 'link|title' | 'title|link'
}

/** Parse `[[target]]`, `[[target|alias]]`, and `![[embed]]` (embed prefix skipped). */
export function wikilinkParser(config?: WikilinkParserConfig): InlineParser {
  return {
    name: 'scriptor-wikilinks',
    before: 'Link',
    parse(ctx, _next, pos) {
      const offset = pos - ctx.offset
      const line = ctx.text.slice(offset)
      if (line.startsWith('!')) return -1
      if (!line.startsWith('[[')) return -1
      const close = line.indexOf(']]')
      if (close < 2) return -1

      const from = pos
      const to = from + close + 2
      const inner = line.slice(2, close)
      const children = [
        ctx.elt('WikilinkMark', from, from + 2),
        ctx.elt('WikilinkMark', to - 2, to),
      ]

      const pipe = inner.indexOf('|')
      if (pipe > 0 && pipe < inner.length - 1) {
        const titleFirst = config?.format === 'title|link'
        const leftFrom = from + 2
        const leftTo = from + 2 + pipe
        const rightFrom = leftTo + 1
        const rightTo = to - 2
        children.splice(
          1,
          0,
          ctx.elt(titleFirst ? 'WikilinkAlias' : 'WikilinkTarget', leftFrom, leftTo),
          ctx.elt('WikilinkMark', leftTo, leftTo + 1),
          ctx.elt(titleFirst ? 'WikilinkTarget' : 'WikilinkAlias', rightFrom, rightTo),
        )
      } else {
        children.splice(1, 0, ctx.elt('WikilinkTarget', from + 2, to - 2))
      }

      return ctx.addElement(ctx.elt('Wikilink', from, to, children))
    },
  }
}

/** Wikilink embeds `![[note]]` */
export const wikilinkEmbedParser: InlineParser = {
  name: 'scriptor-wikilink-embeds',
  before: 'Link',
  parse(ctx, next, pos) {
    if (next !== 33) return -1 // !
    const offset = pos - ctx.offset
    const line = ctx.text.slice(offset)
    if (!line.startsWith('![[')) return -1
    const close = line.indexOf(']]')
    if (close < 3) return -1
    const from = pos
    const to = from + close + 2
    return ctx.addElement(
      ctx.elt('Wikilink', from, to, [
        ctx.elt('WikilinkMark', from, from + 3),
        ctx.elt('WikilinkTarget', from + 3, to - 2),
        ctx.elt('WikilinkMark', to - 2, to),
      ]),
    )
  },
}

const CITATION_PATTERN = /^(?:\[@([^\];@\s][^;\]]*?)(?:\s*;\s*[^\]]+)?\]|-?@[\w:.#$%&+\-?<>~/]+)/

export const citationParser: InlineParser = {
  name: 'scriptor-citations',
  before: 'Link',
  parse(ctx, next, pos) {
    if (next !== 64 && next !== 91) return -1
    const before = pos > 0 ? ctx.slice(pos - 1, pos) : ''
    if (before && !'(\n\r\t '.includes(before)) return -1
    const slice = ctx.text.slice(pos - ctx.offset)
    const match = CITATION_PATTERN.exec(slice)
    if (!match || match.index !== 0) return -1
    return ctx.addElement(ctx.elt('Citation', pos, pos + match[0].length))
  },
}

export const footnoteParser: InlineParser = {
  name: 'scriptor-footnotes',
  before: 'Link',
  parse(ctx, next, pos) {
    if (next !== 91 && next !== 94) return -1
    const slice = ctx.text.slice(pos - ctx.offset)
    const match = /\[\^[^\s]+?\]|\^\[[^\]]+?\]/.exec(slice)
    if (!match || match.index !== 0) return -1
    return ctx.addElement(ctx.elt('Footnote', pos, pos + match[0].length))
  },
}

export const footnoteRefParser: import('@lezer/markdown').BlockParser = {
  name: 'scriptor-footnote-refs',
  parse(ctx, line) {
    const match = /^\[\^([^\s]+)\]:\s*/.exec(line.text)
    if (!match) return false
    const labelEnd = ctx.lineStart + match[0].length
    let bodyEnd = ctx.lineStart + line.text.length
    const bodyLines = [line.text.slice(match[0].length)]
    while (ctx.nextLine() && (/^ {4,}/.test(line.text) || line.text.trim() === '')) {
      bodyLines.push(line.text)
      bodyEnd += line.text.length + 1
    }
    while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1]?.trim() === '') {
      const last = bodyLines.pop()!
      bodyEnd -= last.length + 1
    }
    const bodyStart = labelEnd
    if (bodyEnd < bodyStart) bodyEnd = bodyStart
    ctx.addElement(
      ctx.elt('FootnoteRef', ctx.lineStart, bodyEnd, [
        ctx.elt('FootnoteRefLabel', ctx.lineStart, labelEnd - 1),
        ctx.elt('FootnoteRefBody', bodyStart, bodyEnd),
      ]),
    )
    return true
  },
}

import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import type { Extension } from '@codemirror/state'

import { scriptorMarkdownTags } from './custom-tags.ts'
import {
  citationParser,
  footnoteParser,
  footnoteRefParser,
  wikilinkEmbedParser,
  wikilinkParser,
  type WikilinkParserConfig,
} from './parsers.ts'

const scriptorHighlight = HighlightStyle.define([
  { tag: scriptorMarkdownTags.Wikilink, class: 'cm-wikilink' },
  { tag: scriptorMarkdownTags.WikilinkTarget, class: 'cm-wikilink-target' },
  { tag: scriptorMarkdownTags.WikilinkAlias, class: 'cm-wikilink-alias' },
  { tag: scriptorMarkdownTags.Citation, class: 'cm-citation' },
  { tag: scriptorMarkdownTags.Footnote, class: 'cm-footnote' },
  { tag: scriptorMarkdownTags.FootnoteRef, class: 'cm-footnote-ref' },
])

export function scriptorMarkdownExtension(config?: WikilinkParserConfig): Extension {
  return [
    markdown({
      base: markdownLanguage,
      addKeymap: false,
      extensions: {
        parseInline: [wikilinkEmbedParser, footnoteParser, citationParser, wikilinkParser(config)],
        parseBlock: [footnoteRefParser],
        defineNodes: [
          { name: 'Wikilink', style: scriptorMarkdownTags.Wikilink },
          { name: 'WikilinkMark', style: scriptorMarkdownTags.WikilinkMark },
          { name: 'WikilinkTarget', style: scriptorMarkdownTags.WikilinkTarget },
          { name: 'WikilinkAlias', style: scriptorMarkdownTags.WikilinkAlias },
          { name: 'Citation', style: scriptorMarkdownTags.Citation },
          { name: 'Footnote', style: scriptorMarkdownTags.Footnote },
          { name: 'FootnoteRef', style: scriptorMarkdownTags.FootnoteRef },
          { name: 'FootnoteRefLabel', style: scriptorMarkdownTags.FootnoteRefLabel },
          { name: 'FootnoteRefBody', style: scriptorMarkdownTags.FootnoteRefBody },
        ],
      },
    }),
    syntaxHighlighting(scriptorHighlight),
  ]
}

import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import type { Extension } from '@codemirror/state'

import { scriptorMarkdownTags } from './custom-tags.ts'
import type { WikilinkParserConfig } from './parsers.ts'
import {
  SCRIPTOR_DEFINED_NODES,
  scriptorBlockParsers,
  scriptorInlineParsers,
} from './scriptor-parse-config.ts'

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
        parseInline: scriptorInlineParsers(config),
        parseBlock: scriptorBlockParsers(),
        defineNodes: SCRIPTOR_DEFINED_NODES.map((node) => ({ ...node })),
      },
    }),
    syntaxHighlighting(scriptorHighlight),
  ]
}

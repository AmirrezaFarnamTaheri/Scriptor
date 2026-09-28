/**
 * The Markdown parse extensions Scriptor layers on top of GFM.
 *
 * `markdown-language.ts` feeds these into CodeMirror's `markdown()` factory.
 * They live here — free of any CodeMirror import — so headless regression
 * tests can build the parse configuration the editor itself installs (same
 * parser arrays, same node names) with `@lezer/markdown` alone and assert on
 * the resulting tree. A test that duplicated this list would keep passing
 * after the editor stopped using it.
 */
import type { BlockParser, InlineParser } from '@lezer/markdown'

import { scriptorMarkdownTags } from './custom-tags.ts'
import {
  citationParser,
  extendedTaskListParser,
  footnoteParser,
  footnoteRefParser,
  wikilinkEmbedParser,
  wikilinkParser,
  type WikilinkParserConfig,
} from './parsers.ts'

export function scriptorInlineParsers(config?: WikilinkParserConfig): InlineParser[] {
  return [
    wikilinkEmbedParser,
    footnoteParser,
    citationParser,
    wikilinkParser(config),
  ]
}

export function scriptorBlockParsers(): BlockParser[] {
  return [extendedTaskListParser, footnoteRefParser]
}

/**
 * Node names and their highlight style. `ctx.elt()` throws for any name absent
 * from this list, so the editor's `defineNodes` and any headless test that
 * builds the same configuration must both read it from here.
 */
export const SCRIPTOR_DEFINED_NODES = [
  { name: 'Wikilink', style: scriptorMarkdownTags.Wikilink },
  { name: 'WikilinkMark', style: scriptorMarkdownTags.WikilinkMark },
  { name: 'WikilinkTarget', style: scriptorMarkdownTags.WikilinkTarget },
  { name: 'WikilinkAlias', style: scriptorMarkdownTags.WikilinkAlias },
  { name: 'Citation', style: scriptorMarkdownTags.Citation },
  { name: 'Footnote', style: scriptorMarkdownTags.Footnote },
  { name: 'FootnoteRef', style: scriptorMarkdownTags.FootnoteRef },
  { name: 'FootnoteRefLabel', style: scriptorMarkdownTags.FootnoteRefLabel },
  { name: 'FootnoteRefBody', style: scriptorMarkdownTags.FootnoteRefBody },
] as const

export const SCRIPTOR_NODE_NAMES = SCRIPTOR_DEFINED_NODES.map((node) => node.name)

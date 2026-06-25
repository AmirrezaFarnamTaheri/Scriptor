import { tags as t } from '@lezer/highlight'

export const scriptorMarkdownTags = {
  Wikilink: t.link,
  WikilinkMark: t.processingInstruction,
  WikilinkTarget: t.string,
  WikilinkAlias: t.labelName,
  Citation: t.special(t.string),
  Footnote: t.special(t.meta),
  FootnoteRef: t.definition(t.meta),
  FootnoteRefLabel: t.labelName,
  FootnoteRefBody: t.content,
}

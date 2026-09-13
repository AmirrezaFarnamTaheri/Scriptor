import { MERMAID_SNIPPETS, MATH_SNIPPETS, type TypographyAction } from '@scriptor/editor/pure'

export const TYPOGRAPHY_LABELS: Record<TypographyAction, string> = {
  zapGremlins: 'typography.zapGremlins',
  stripDuplicateSpaces: 'typography.stripDuplicateSpaces',
  removeLineBreaks: 'typography.removeLineBreaks',
  straightenQuotes: 'typography.straightenQuotes',
  toDoubleQuotes: 'typography.toDoubleQuotes',
  doubleQuotesToSingle: 'typography.doubleQuotesToSingle',
  singleQuotesToDouble: 'typography.singleQuotesToDouble',
  addSpacesAroundEmdashes: 'typography.addSpacesAroundEmdashes',
  removeSpacesAroundEmdashes: 'typography.removeSpacesAroundEmdashes',
  toTitleCase: 'typography.toTitleCase',
  toSentenceCase: 'typography.toSentenceCase',
  quotesToItalics: 'typography.quotesToItalics',
  italicsToQuotes: 'typography.italicsToQuotes',
}

export const INSERT_TOOLS = [
    ...MERMAID_SNIPPETS.map((snippet) => ({
      id: snippet.name,
      label: snippet.description ?? snippet.name,
      content: snippet.content,
    })),
    ...MATH_SNIPPETS.map((snippet) => ({
      id: snippet.name,
      label: snippet.description ?? snippet.name,
      content: snippet.content,
    })),
    { id: 'task-list', label: 'Task list item', content: '- [ ] ' },
    { id: 'toc', label: 'Table of contents marker', content: '[TOC]\n\n' },
    { id: 'dql', label: 'DQL query block', content: '```dql\npath has #tag\n```\n' },
    { id: 'import', label: 'MPE @import', content: '@import "chapter.md"\n' },
  ]

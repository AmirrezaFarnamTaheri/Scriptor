import { MERMAID_SNIPPETS, MATH_SNIPPETS, type TypographyAction } from '@scriptor/editor/pure'

export const TYPOGRAPHY_LABELS: Record<TypographyAction, string> = {
  zapGremlins: 'Zap gremlins',
  stripDuplicateSpaces: 'Strip duplicate spaces',
  removeLineBreaks: 'Remove line breaks',
  straightenQuotes: 'Straighten quotes',
  toDoubleQuotes: 'To double quotes',
  doubleQuotesToSingle: 'Double → single quotes',
  singleQuotesToDouble: 'Single → double quotes',
  addSpacesAroundEmdashes: 'Spaces around em dashes',
  removeSpacesAroundEmdashes: 'Remove em dash spaces',
  toTitleCase: 'Title case',
  toSentenceCase: 'Sentence case',
  quotesToItalics: 'Quotes → italics',
  italicsToQuotes: 'Italics → quotes',
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

/**
 * typography-actions
 * ------------------
 * The action-id list and its type, split out of `typography-transforms.ts` so
 * that UI code (menus, command palette) can enumerate the actions without
 * importing the CodeMirror `StateCommand` implementations.
 */

export const TYPOGRAPHY_ACTIONS = [
  'zapGremlins',
  'stripDuplicateSpaces',
  'removeLineBreaks',
  'straightenQuotes',
  'toDoubleQuotes',
  'doubleQuotesToSingle',
  'singleQuotesToDouble',
  'addSpacesAroundEmdashes',
  'removeSpacesAroundEmdashes',
  'toTitleCase',
  'toSentenceCase',
  'quotesToItalics',
  'italicsToQuotes',
] as const

export type TypographyAction = (typeof TYPOGRAPHY_ACTIONS)[number]

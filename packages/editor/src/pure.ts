/**
 * @scriptor/editor/pure
 * ---------------------
 * CodeMirror-free surface of this package.
 *
 * The main `.` barrel re-exports ~40 modules, most of which import
 * `@codemirror/*`. Any app module that pulls a single helper through the barrel
 * therefore drags the entire CodeMirror runtime (~740 kB minified) into its
 * chunk — and, for entry-reachable modules, into the initial page load.
 *
 * Import from here for helpers that have no editor runtime dependency. Anything
 * added to this file MUST NOT (transitively) import `@codemirror/*`, `@lezer/*`
 * or `@replit/codemirror-vim`.
 */

export { countCharacters, countWords } from './adapter.ts'
export type { EditorAdapter, EditorAdapterOptions, EditorStats } from './adapter.ts'

export { headingToId } from './heading-id.ts'

export { TYPOGRAPHY_ACTIONS } from './typography-actions.ts'
export type { TypographyAction } from './typography-actions.ts'

export { configureLanguageTool } from './language-tool-config.ts'
export type { LanguageToolSettings } from './language-tool-config.ts'

export { buildVaultCorpus } from './prose-mining.ts'

export { MATH_SNIPPETS, MERMAID_SNIPPETS } from './snippet-catalogs.ts'

export {
  getActiveHunspellLocale,
  LOCALE_MAP,
  loadHunspellLocale,
  setActiveHunspellLocale,
  SUPPORTED_LOCALES,
} from './hunspell-dictionary.ts'

export {
  generateLinkReferenceDefinitions,
  lintLinkReferences,
  lintMarkdownDocument,
} from './remark-lint.ts'
export type { EditorLintMessage } from './remark-lint.ts'

export {
  addTableColumn,
  addTableRow,
  collectTableBlocks,
  findTableBlock,
  prefixHeadingLine,
  updateTableCell,
  wrapSelectionText,
} from './transform-logic.ts'

export {
  expandSnippetTemplate,
  looksLikeSnippetTemplate,
  resolveSnippetVariables,
} from './snippet-parser.ts'
export type {
  ExpandedSnippet,
  SnippetTabStop,
  SnippetVariableContext,
} from './snippet-parser.ts'

export { normalizeSnippetCatalog, parseSnippetCatalogJson } from './snippet-catalog.ts'
export type { SnippetCatalogEntry } from './snippet-catalog.ts'

export { normalizeMarkdown, roundTripEqual } from './roundtrip.ts'

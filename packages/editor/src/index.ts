export type { EditorAdapter, EditorAdapterOptions, EditorStats } from './adapter'
export { countCharacters, countWords } from './adapter'
export { MarkdownEditor } from './codemirror'
export type { MarkdownEditorHandle, MarkdownEditorProps, TocEntry } from './codemirror'
export { applyEditorTransform, wrapText, replaceLines } from './transforms'
export type { EditorTransformAction } from './transforms'
export {
  addTableColumn,
  addTableRow,
  collectTableBlocks,
  findTableBlock,
  prefixHeadingLine,
  updateTableCell,
  wrapSelectionText,
} from './transform-logic.ts'
export { tableEditorExtension } from './table-editor.ts'
export { runTableContextAction, TABLE_CONTEXT_MENU } from './table-commands.ts'
export type { TableContextAction } from './table-commands.ts'
export { tableContextMenuExtension } from './table-context-menu.ts'
export {
  expandSnippetTemplate,
  looksLikeSnippetTemplate,
  resolveSnippetVariables,
} from './snippet-parser.ts'
export type { ExpandedSnippet, SnippetTabStop, SnippetVariableContext } from './snippet-parser.ts'
export { abortSnippet, insertExpandedSnippet, nextSnippetTab, snippetExtension } from './snippets.ts'
export type { SnippetCatalogEntry } from './snippet-catalog.ts'
export { normalizeSnippetCatalog, parseSnippetCatalogJson } from './snippet-catalog.ts'
export { snippetAutocompleteExtension } from './snippet-autocomplete.ts'
export { normalizeMarkdown, roundTripEqual } from './roundtrip'
export { setVimModeCallbacks, setVimModeEnabled, vimModeExtension } from './vim-mode.ts'
export type { VimModeCallbacks } from './vim-mode.ts'
export { applyTypographyAction, TYPOGRAPHY_ACTIONS } from './typography-transforms.ts'
export type { TypographyAction } from './typography-transforms.ts'
export { generateToc, headingToId, tocField, findTocEntryById } from './toc-field.ts'
export { moveSectionDown, moveSectionUp } from './move-section.ts'
export {
  dispatchEditorAutocompleteContext,
  editorAutocompleteExtension,
  setEditorAutocompleteContext,
} from './editor-autocomplete.ts'
export type { EditorAutocompleteContext } from './editor-autocomplete.ts'
export { spellcheckExtension, setSpellcheckDictionary, loadHunspellDictionary } from './spellcheck.ts'
export { wysiwygDecorationExtension } from './wysiwyg-decorations.ts'
export { findReplaceExtension, openFindPanel } from './find-replace.ts'
export {
  toggleBlockquote,
  toggleBold,
  toggleBulletList,
  toggleHeading,
  toggleItalic,
  toggleOrderedList,
  toggleStrikethrough,
  toggleTaskList,
  removeListMarkers,
} from './gfm-commands.ts'
export { autoPairExtension } from './auto-pair.ts'
export { htmlToMarkdown, pasteHandlerExtension, setPasteImageHandler } from './paste-handler.ts'
export type { SaveImageFromClipboard } from './paste-handler.ts'
export { MERMAID_SNIPPETS, MATH_SNIPPETS } from './snippet-catalogs.ts'
export { typewriterExtension } from './typewriter.ts'
export { markdownLintExtension } from './markdown-lint.ts'
export {
  generateLinkReferenceDefinitions,
  lintLinkReferences,
  lintMarkdownDocument,
} from './remark-lint.ts'
export type { EditorLintMessage } from './remark-lint.ts'
export { scriptorMarkdownExtension } from './markdown/markdown-language.ts'
export { taskToggleClickExtension } from './task-toggle.ts'
export { distractionFreeExtension, setDistractionFreeClass } from './distraction-free.ts'
export { configureLanguageTool, languageToolLintExtension } from './language-tool-lint.ts'
export { editorA11yExtension } from './a11y.ts'
export { editorThemeExtension, reconfigureEditorTheme } from './editor-themes.ts'
export type { EditorThemeId } from './editor-themes.ts'

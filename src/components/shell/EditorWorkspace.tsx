import { lazy, Suspense, type CSSProperties, type PointerEventHandler, type RefObject } from 'react'
import { Bold, CheckCircle2, FileText, FolderOpen, Italic, Link } from 'lucide-react'
import type {
  EditorAutocompleteContext,
  EditorThemeId,
  MarkdownEditorHandle,
  MarkdownEditorProps,
  SnippetCatalogEntry,
  SnippetVariableContext,
  TocEntry,
  TypographyAction,
} from '@scriptor/editor'
import type { MonacoCompletionContext } from '../../lib/monaco-completions'

type EditorTransformAction = import('@scriptor/editor').EditorTransformAction

import { InlineEditorAssist } from '../editor/InlineEditorAssist'
import { EditorStructureMenu } from '../editor/EditorStructureMenu'
import { EditorToolsMenu } from '../editor/EditorToolsMenu'
import { useI18n } from '../../lib/i18n'
import { EditorTabBar } from './EditorTabBar'
import { ExternalChangeBanner } from '../ExternalChangeBanner'
import { TocSidebar } from '../TocSidebar'
import { TypographyMenu } from '../TypographyMenu'
import { InsertMenu } from '../InsertMenu'
import { SplitPaneHandle } from '../SplitPaneHandle'
import { ErrorBoundary } from '../ErrorBoundary'
import { PanelErrorFallback } from '../PanelErrorFallback'
import {
  MarkdownPreview,
  type MarkdownPreviewHandle,
  type MarkdownPreviewProps,
} from '@scriptor/renderer'
import type { ExternalChangeConflict } from '../../types/vault'

const LazyMonacoMarkdownEditor = lazy(() =>
  import('../editor/LazyMonacoMarkdownEditor').then((module) => ({
    default: module.LazyMonacoMarkdownEditor,
  })),
)

const LazyCodeMirrorMarkdownEditor = lazy(() =>
  import('../editor/LazyCodeMirrorMarkdownEditor').then((module) => ({
    default: module.LazyCodeMirrorMarkdownEditor,
  })),
)

interface OpenTab {
  path: string
  title: string
  contentHash: string
  pinned?: boolean
}

interface EditorWorkspaceProps {
  activePath: string | null
  onOpenVault: () => void
  hasOpenVault: boolean
  onCreateNote: () => void
  openTabs: OpenTab[]
  isNoteDirty?: boolean
  inboxPaths?: Set<string>
  canReopenClosedTab?: boolean
  onReopenClosedTab?: () => void
  onTogglePinTab?: (path: string) => void
  onOpenTab: (path: string) => void
  onCloseTab: (path: string) => void
  draftMarkdown: string
  updateDraft: (markdown: string) => void
  externalChangeConflict: ExternalChangeConflict | null
  onReloadExternalChange: () => void
  onKeepEditingExternalChange: () => void
  tocOpen: boolean
  onToggleToc: () => void
  tocEntries: TocEntry[]
  visibleEditorLine: number
  onJumpToLine: (line: number) => void
  frontmatterOpen: boolean
  onOpenFrontmatter: () => void
  onOrganizeActive: () => void
  onOpenCheatsheet: () => void
  onOpenWritingTargets: () => void
  editorMode: 'codemirror' | 'monaco'
  toggleEditorMode: () => void
  editorTheme: EditorThemeId
  /** True when the editor theme follows the app theme (no explicit override). */
  editorThemeSyncedToApp?: boolean
  toggleEditorTheme: () => void
  vimMode: boolean
  setVimMode: (updater: (value: boolean) => boolean) => void
  spellcheck: boolean
  setSpellcheck: (updater: (value: boolean) => boolean) => void
  wysiwyg: boolean
  setWysiwyg: (updater: (value: boolean) => boolean) => void
  typewriter: boolean
  setTypewriter: (updater: (value: boolean) => boolean) => void
  distractionFree: boolean
  setDistractionFree: (updater: (value: boolean) => boolean) => void
  languageTool: boolean
  setLanguageTool: (updater: (value: boolean) => boolean) => void
  stickiesVisible: boolean
  setStickiesVisible: (value: boolean) => void
  showSplitPreview: boolean
  splitEditorWidth: string
  splitDragging: boolean
  onSplitHandlePointerDown: PointerEventHandler<HTMLDivElement>
  onSplitHandlePointerMove: PointerEventHandler<HTMLDivElement>
  onSplitHandlePointerUp: PointerEventHandler<HTMLDivElement>
  onSplitHandlePointerCancel: PointerEventHandler<HTMLDivElement>
  onSplitHandleDoubleClick: () => void
  splitRatioPct: number
  onSplitHandleNudge: (delta: number) => void
  editorWorkspaceRef: RefObject<HTMLDivElement | null>
  splitPreviewScrollRef: RefObject<HTMLElement | null>
  previewRef: RefObject<MarkdownPreviewHandle | null>
  editorRef: RefObject<MarkdownEditorHandle | null>
  scrollSyncEnabled: boolean
  handleEditorLine: (line: number) => void
  snippetContext: SnippetVariableContext | undefined
  snippetCatalog: SnippetCatalogEntry[]
  editorAutocompleteContext: EditorAutocompleteContext
  monacoCompletionContext: MonacoCompletionContext
  editorInsertRequest: MarkdownEditorProps['insertRequest']
  editorTransformRequest: MarkdownEditorProps['transformRequest']
  editorTypographyRequest: MarkdownEditorProps['typographyRequest']
  scrollToEditorLine: number | null
  saveImageFromClipboard?: (file: File) => Promise<string | null>
  previewProps: Pick<
    MarkdownPreviewProps,
    | 'fetchNote'
    | 'readVaultText'
    | 'executeDql'
    | 'runCodeChunk'
    | 'postProcessHtml'
    | 'renderPlantUmlLocal'
  >
  insertSnippet: (content: string) => void
  applyEditorTransform: (action: EditorTransformAction) => void
  applyEditorTypography: (action: TypographyAction) => void
  saveActiveNoteNow: () => void
  renameActiveNote: () => void
  isSaving: boolean
  lastSavedAt: string | null
  draftWordCount: number
  wordCountDelta: number
  charCount: number
  readingMinutes: number
  brokenLinkCount?: number
  citationCount?: number
  hasFrontmatter?: boolean
  onOpenPublishCenter?: () => void
  showFormatToolbar?: boolean
  showEditorAssist?: boolean
  showEditorStatus?: boolean
  showLineNumbers?: boolean
  editorSurfaceMode?: 'source' | 'split' | 'rendered'
  onEditorSurfaceModeChange?: (mode: 'source' | 'split' | 'rendered') => void
  layoutLocked?: boolean
}

export function EditorWorkspace(props: EditorWorkspaceProps) {
  const {
    activePath,
    onOpenVault,
    hasOpenVault,
    onCreateNote,
    openTabs,
    layoutLocked = false,
    isNoteDirty = false,
    inboxPaths,
    canReopenClosedTab = false,
    onReopenClosedTab,
    onTogglePinTab,
    onOpenTab,
    onCloseTab,
    draftMarkdown,
    updateDraft,
    externalChangeConflict,
    onReloadExternalChange,
    onKeepEditingExternalChange,
    tocOpen,
    onToggleToc,
    tocEntries,
    visibleEditorLine,
    onJumpToLine,
    onOpenFrontmatter,
    onOrganizeActive,
    onOpenCheatsheet,
    onOpenWritingTargets,
    editorMode,
    toggleEditorMode,
    editorTheme,
    editorThemeSyncedToApp = false,
    toggleEditorTheme,
    vimMode,
    setVimMode,
    spellcheck,
    setSpellcheck,
    wysiwyg,
    setWysiwyg,
    typewriter,
    setTypewriter,
    distractionFree,
    setDistractionFree,
    languageTool,
    setLanguageTool,
    stickiesVisible,
    setStickiesVisible,
    showSplitPreview,
    splitEditorWidth,
    splitDragging,
    onSplitHandlePointerDown,
    onSplitHandlePointerMove,
    onSplitHandlePointerUp,
    onSplitHandlePointerCancel,
    onSplitHandleDoubleClick,
    splitRatioPct,
    onSplitHandleNudge,
    editorWorkspaceRef,
    splitPreviewScrollRef,
    previewRef,
    editorRef,
    scrollSyncEnabled,
    handleEditorLine,
    snippetContext,
    snippetCatalog,
    editorAutocompleteContext,
    monacoCompletionContext,
    editorInsertRequest,
    editorTransformRequest,
    editorTypographyRequest,
    scrollToEditorLine,
    saveImageFromClipboard,
    previewProps,
    insertSnippet,
    applyEditorTransform,
    applyEditorTypography,
    saveActiveNoteNow,
    renameActiveNote,
    isSaving,
    lastSavedAt,
    draftWordCount,
    wordCountDelta,
    charCount,
    readingMinutes,
    brokenLinkCount = 0,
    citationCount = 0,
    onOpenPublishCenter,
    showFormatToolbar = true,
    showEditorAssist = true,
    showEditorStatus = true,
    showLineNumbers = true,
    editorSurfaceMode = 'source',
    onEditorSurfaceModeChange,
  } = props
  const { t } = useI18n()

  return (
    <section className="editor-panel" aria-label={t('editor.ariaLabel')}>
      <EditorTabBar
        activePath={activePath}
        openTabs={openTabs}
        isNoteDirty={isNoteDirty}
        inboxPaths={inboxPaths}
        canReopenClosedTab={canReopenClosedTab}
        onReopenClosedTab={onReopenClosedTab}
        onTogglePinTab={onTogglePinTab}
        onOpenTab={onOpenTab}
        onCloseTab={onCloseTab}
      />
      {showFormatToolbar ? (
        <div className="editor-toolbar-wrapper">
          <div className="format-row editor-toolbar" role="toolbar" aria-label={t('editor.toolbar.markdownTools')}>
            <div className="format-group editor-view-modes" aria-label={t('editor.toolbar.viewMode')}>
              {(
                [
                  [t('editor.view.source'), 'source'],
                  [t('editor.view.split'), 'split'],
                  [t('editor.view.preview'), 'rendered'],
                ] as const
              ).map(([label, mode]) => (
                <button
                  type="button"
                  key={mode}
                  className={editorSurfaceMode === mode ? 'view-mode active' : 'view-mode'}
                  aria-pressed={editorSurfaceMode === mode}
                  onClick={() => onEditorSurfaceModeChange?.(mode)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="format-group editor-primary-formatting" aria-label={t('editor.toolbar.styleAndInsert')}>
              <button
                type="button"
                disabled={!activePath}
                title={t('editor.transforms.bold')}
                aria-label={t('editor.transforms.bold')}
                onClick={() => applyEditorTransform('bold')}
              >
                <Bold />
              </button>
              <button
                type="button"
                disabled={!activePath}
                title={t('editor.transforms.italic')}
                aria-label={t('editor.transforms.italic')}
                onClick={() => applyEditorTransform('italic')}
              >
                <Italic />
              </button>
              <button
                type="button"
                disabled={!activePath}
                title={t('editor.transforms.link')}
                aria-label={t('editor.transforms.link')}
                onClick={() => applyEditorTransform('link')}
              >
                <Link />
              </button>
              <EditorStructureMenu
                disabled={!activePath}
                onTransform={applyEditorTransform}
                onToggleToc={onToggleToc}
                onOpenFrontmatter={onOpenFrontmatter}
              />
              <InsertMenu disabled={!activePath} onInsert={insertSnippet} />
              <TypographyMenu disabled={!activePath} onSelect={applyEditorTypography} />
              <EditorToolsMenu
                activePath={activePath}
                onOrganizeActive={onOrganizeActive}
                onOpenWritingTargets={onOpenWritingTargets}
                onOpenCheatsheet={onOpenCheatsheet}
                stickiesVisible={stickiesVisible}
                onToggleStickies={() => setStickiesVisible(!stickiesVisible)}
                editorMode={editorMode}
                onToggleEditorMode={toggleEditorMode}
                editorTheme={editorTheme}
                editorThemeSyncedToApp={editorThemeSyncedToApp}
                onToggleEditorTheme={toggleEditorTheme}
                vimMode={vimMode}
                onToggleVim={() => setVimMode((value) => !value)}
                spellcheck={spellcheck}
                onToggleSpellcheck={() => setSpellcheck((value) => !value)}
                wysiwyg={wysiwyg}
                onToggleWysiwyg={() => setWysiwyg((value) => !value)}
                typewriter={typewriter}
                onToggleTypewriter={() => setTypewriter((value) => !value)}
                distractionFree={distractionFree}
                onToggleDistractionFree={() => setDistractionFree((value) => !value)}
                languageTool={languageTool}
                onToggleLanguageTool={() => setLanguageTool((value) => !value)}
                onRenameActiveNote={renameActiveNote}
                onInsertAiSummaryPrompt={() => insertSnippet('> [!ai] Summarize the section above.')}
                onInsertRule={() => insertSnippet('\n---\n')}
              />
            </div>

            {showEditorAssist ? (
              <InlineEditorAssist
                activePath={activePath}
                brokenLinkCount={brokenLinkCount}
                citationCount={citationCount}
                onInsertCitation={() => insertSnippet('[@citekey]')}
                onOpenExport={() => onOpenPublishCenter?.()}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {externalChangeConflict ? (
        <ExternalChangeBanner
          conflict={externalChangeConflict}
          onReload={onReloadExternalChange}
          onKeepEditing={onKeepEditingExternalChange}
        />
      ) : null}

      <div
        className={`editor-workspace ${showSplitPreview ? 'is-split' : ''}`}
        ref={editorWorkspaceRef}
        style={showSplitPreview ? ({ '--split-editor-width': splitEditorWidth } as CSSProperties) : undefined}
      >
        <article
          className="editor-surface codemirror-host editor-pane"
          aria-label={t('editor.editorAria')}
          data-line-numbers={showLineNumbers ? 'true' : 'false'}
        >
          {tocOpen && activePath ? (
            <TocSidebar
              entries={tocEntries}
              activeLine={visibleEditorLine}
              onSelect={onJumpToLine}
              onClose={onToggleToc}
            />
          ) : null}
          {activePath ? (
            <ErrorBoundary
              name="markdown-editor"
              resetKeys={[activePath, editorMode]}
              fallback={
                <PanelErrorFallback
                  variant="inline"
                  title={t('editor.error.title')}
                  detail={t('editor.error.detail')}
                  onRetry={editorMode === 'monaco' ? toggleEditorMode : undefined}
                  retryLabel={editorMode === 'monaco' ? t('editor.error.retryCodeMirror') : undefined}
                />
              }
            >
              <Suspense
                fallback={
                  <div className="editor-loading-state" role="status" aria-live="polite">
                    <span className="editor-loading-shimmer" aria-hidden="true" />
                    <span>{t('editor.loading')}</span>
                  </div>
                }
              >
                {editorMode === 'monaco' ? (
                  <LazyMonacoMarkdownEditor
                    key={activePath}
                    notePath={activePath}
                    value={draftMarkdown}
                    onChange={updateDraft}
                    insertRequest={editorInsertRequest}
                    transformRequest={editorTransformRequest}
                    scrollToLine={scrollToEditorLine}
                    editorTheme={editorTheme}
                    typewriter={typewriter}
                    distractionFree={distractionFree}
                    showLineNumbers={showLineNumbers}
                    completionContext={monacoCompletionContext}
                    className="markdown-editor monaco-editor-host"
                  />
                ) : (
                  <LazyCodeMirrorMarkdownEditor
                    ref={editorRef}
                    key={activePath}
                    value={draftMarkdown}
                    onChange={updateDraft}
                    scrollToLine={scrollToEditorLine}
                    insertRequest={editorInsertRequest}
                    transformRequest={editorTransformRequest}
                    typographyRequest={editorTypographyRequest}
                    scrollSyncEnabled={scrollSyncEnabled}
                    onVisibleLineChange={handleEditorLine}
                    snippetContext={snippetContext}
                    snippetCatalog={snippetCatalog}
                    autocompleteContext={editorAutocompleteContext}
                    vimMode={vimMode}
                    spellcheck={spellcheck}
                    wysiwyg={wysiwyg}
                    typewriter={typewriter}
                    distractionFree={distractionFree}
                    languageTool={languageTool}
                    editorTheme={editorTheme}
                    onVimSave={saveActiveNoteNow}
                    saveImageFromClipboard={saveImageFromClipboard}
                    showLineNumbers={showLineNumbers}
                    className="markdown-editor"
                  />
                )}
              </Suspense>
            </ErrorBoundary>
          ) : (
            <div className="editor-empty" role="status">
              <div className="editor-empty-icon" aria-hidden="true">
                <FileText />
              </div>
              <div className="editor-empty-copy">
                <h2>{hasOpenVault ? t('editor.empty.newNoteTitle') : t('editor.empty.openTitle')}</h2>
                <p>
                  {hasOpenVault
                    ? t('editor.empty.newNoteBody')
                    : t('editor.empty.openBody')}
                </p>
              </div>
              <div className="editor-empty-actions">
                {hasOpenVault ? (
                  <button type="button" className="primary-button" onClick={onCreateNote}>
                    <FileText aria-hidden="true" />
                    {t('editor.empty.newNote')}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={hasOpenVault ? 'action-button' : 'primary-button'}
                  onClick={onOpenVault}
                >
                  <FolderOpen aria-hidden="true" />
                  {hasOpenVault ? t('editor.empty.openAnother') : t('editor.empty.openVault')}
                </button>
              </div>
              <small>{t('editor.empty.tagline')}</small>
            </div>
          )}
        </article>
        {showSplitPreview ? (
          <>
            <SplitPaneHandle
              dragging={splitDragging}
              locked={layoutLocked}
              onPointerDown={onSplitHandlePointerDown}
              onPointerMove={onSplitHandlePointerMove}
              onPointerUp={onSplitHandlePointerUp}
              onPointerCancel={onSplitHandlePointerCancel}
              onDoubleClick={onSplitHandleDoubleClick}
              valueNow={splitRatioPct * 100}
              onNudge={onSplitHandleNudge}
            />
            <aside
              className="editor-preview-pane"
              aria-label={t('editor.previewAria')}
              ref={splitPreviewScrollRef}
              tabIndex={0}
            >
              <ErrorBoundary
                name="split-markdown-preview"
                resetKeys={[activePath]}
                fallback={
                  <PanelErrorFallback
                    variant="inline"
                    title={t('editor.previewError.title')}
                    detail={t('editor.previewError.detail')}
                  />
                }
              >
                <MarkdownPreview
                  ref={previewRef}
                  markdown={draftMarkdown}
                  className="markdown-preview"
                  basePath={activePath}
                  fetchNote={previewProps.fetchNote}
                  readVaultText={previewProps.readVaultText}
                  executeDql={previewProps.executeDql}
                  runCodeChunk={previewProps.runCodeChunk}
                  postProcessHtml={previewProps.postProcessHtml}
                  renderPlantUmlLocal={previewProps.renderPlantUmlLocal}
                />
              </ErrorBoundary>
            </aside>
          </>
        ) : null}
      </div>

      {showEditorStatus ? (
        <footer className="editor-status">
          <span>
            {t('editor.status.words', { count: draftWordCount.toLocaleString() })}
            {wordCountDelta !== 0 ? (
              <small className="word-count-delta">
                {' '}
                ({wordCountDelta > 0 ? '+' : ''}
                {wordCountDelta})
              </small>
            ) : null}
          </span>
          <span>{t('editor.status.characters', { count: charCount.toLocaleString() })}</span>
          <span>{readingMinutes > 0 ? t('editor.status.minRead', { count: readingMinutes }) : t('editor.status.minReadEmpty')}</span>
          <span>{isSaving ? t('editor.status.saving') : lastSavedAt ? t('editor.status.saved', { time: lastSavedAt }) : t('editor.status.markdown')}</span>
          <CheckCircle2 />
        </footer>
      ) : null}
    </section>
  )
}

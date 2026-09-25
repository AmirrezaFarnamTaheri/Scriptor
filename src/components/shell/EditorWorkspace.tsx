import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEventHandler,
  type RefObject,
} from 'react'
import { CheckCircle2, FileText, FolderOpen } from 'lucide-react'
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

import { EditorFormatToolbar } from '../editor/EditorFormatToolbar'
import { useI18n } from '../../lib/i18n'
import { EditorTabBar } from './EditorTabBar'
import { ExternalChangeBanner } from '../ExternalChangeBanner'
import { TocSidebar } from '../TocSidebar'
import { SplitPaneHandle } from '../SplitPaneHandle'
import { ErrorBoundary } from '../ErrorBoundary'
import { PanelErrorFallback } from '../PanelErrorFallback'
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
  splitPreview?: boolean
  setSplitPreview?: (updater: (value: boolean) => boolean) => void
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
  previewEditorRef: RefObject<MarkdownEditorHandle | null>
  editorRef: RefObject<MarkdownEditorHandle | null>
  scrollSyncEnabled: boolean
  handleEditorLine: (line: number) => void
  handlePreviewLine: (line: number) => void
  snippetContext: SnippetVariableContext | undefined
  snippetCatalog: SnippetCatalogEntry[]
  editorAutocompleteContext: EditorAutocompleteContext
  monacoCompletionContext: MonacoCompletionContext
  editorInsertRequest: MarkdownEditorProps['insertRequest']
  editorTransformRequest: MarkdownEditorProps['transformRequest']
  editorTypographyRequest: MarkdownEditorProps['typographyRequest']
  visualBlockRenderer?: MarkdownEditorProps['visualBlockRenderer']
  scrollToEditorLine: number | null
  saveImageFromClipboard?: (file: File) => Promise<string | null>
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

function EditorWorkspaceImpl(props: EditorWorkspaceProps) {
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
    splitPreview,
    setSplitPreview,
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
    previewEditorRef,
    editorRef,
    scrollSyncEnabled,
    handleEditorLine,
    handlePreviewLine,
    snippetContext,
    snippetCatalog,
    editorAutocompleteContext,
    monacoCompletionContext,
    editorInsertRequest,
    editorTransformRequest,
    editorTypographyRequest,
    visualBlockRenderer,
    scrollToEditorLine,
    saveImageFromClipboard,
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
    hasFrontmatter: _hasFrontmatter = false,
    onOpenPublishCenter,
    showFormatToolbar = true,
    showEditorAssist = true,
    showEditorStatus = true,
    showLineNumbers = true,
    editorSurfaceMode = 'source',
    onEditorSurfaceModeChange,
  } = props
  const { t } = useI18n()
  const lastActiveSplitSurfaceRef = useRef<'source' | 'preview'>('source')

  useEffect(() => {
    // Split opens with Source as the command target. Moving the caret in the
    // visual pane promotes Preview until Source receives the next caret move.
    lastActiveSplitSurfaceRef.current = 'source'
  }, [activePath, showSplitPreview])

  const handleSourceLineChange = useCallback((line: number) => {
    lastActiveSplitSurfaceRef.current = 'source'
    handleEditorLine(line)
  }, [handleEditorLine])

  const handleVisualPreviewLineChange = useCallback((line: number) => {
    lastActiveSplitSurfaceRef.current = 'preview'
    handlePreviewLine(line)
  }, [handlePreviewLine])

  const activeEditorHandle = useCallback(() => {
    if (showSplitPreview && lastActiveSplitSurfaceRef.current === 'preview') {
      return previewEditorRef.current ?? editorRef.current
    }
    return editorRef.current
  }, [editorRef, previewEditorRef, showSplitPreview])

  const handleApplyEditorTransform = useCallback(
    (action: EditorTransformAction) => {
      const target = activeEditorHandle()
      if (target && 'applyTransform' in target) {
        target.applyTransform(action)
        return
      }
      applyEditorTransform(action)
    },
    [activeEditorHandle, applyEditorTransform],
  )

  const handleApplyEditorTypography = useCallback(
    (action: TypographyAction) => {
      const target = activeEditorHandle()
      if (target && 'applyTypography' in target) {
        target.applyTypography(action)
        return
      }
      applyEditorTypography(action)
    },
    [activeEditorHandle, applyEditorTypography],
  )

  const handleInsertSnippet = useCallback(
    (content: string) => {
      const target = activeEditorHandle()
      if (target && 'insertSnippet' in target) {
        target.insertSnippet(content)
        return
      }
      insertSnippet(content)
    },
    [activeEditorHandle, insertSnippet],
  )

  return (
    <section className="editor-panel" aria-label={t('editor.ariaLabel')} data-help-topic="editor">
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
        <EditorFormatToolbar
          activePath={activePath}
          editorSurfaceMode={editorSurfaceMode}
          onEditorSurfaceModeChange={onEditorSurfaceModeChange}
          handleApplyEditorTransform={handleApplyEditorTransform}
          onToggleToc={onToggleToc}
          onOpenFrontmatter={onOpenFrontmatter}
          handleApplyEditorTypography={handleApplyEditorTypography}
          handleInsertSnippet={handleInsertSnippet}
          onOrganizeActive={onOrganizeActive}
          onOpenWritingTargets={onOpenWritingTargets}
          onOpenCheatsheet={onOpenCheatsheet}
          stickiesVisible={stickiesVisible}
          setStickiesVisible={setStickiesVisible}
          vimMode={vimMode}
          setVimMode={setVimMode}
          editorMode={editorMode}
          toggleEditorMode={toggleEditorMode}
          editorThemeSyncedToApp={editorThemeSyncedToApp}
          editorTheme={editorTheme}
          toggleEditorTheme={toggleEditorTheme}
          spellcheck={spellcheck}
          setSpellcheck={setSpellcheck}
          wysiwyg={wysiwyg}
          setWysiwyg={setWysiwyg}
          typewriter={typewriter}
          setTypewriter={setTypewriter}
          distractionFree={distractionFree}
          setDistractionFree={setDistractionFree}
          languageTool={languageTool}
          setLanguageTool={setLanguageTool}
          renameActiveNote={renameActiveNote}
          insertSnippet={handleInsertSnippet}
          splitPreview={splitPreview}
          showSplitPreview={showSplitPreview}
          setSplitPreview={setSplitPreview}
          showEditorAssist={showEditorAssist}
          brokenLinkCount={brokenLinkCount}
          citationCount={citationCount}
          onOpenPublishCenter={onOpenPublishCenter}
        />
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
            editorSurfaceMode === 'rendered' ? (
              <div className="editor-rendered-view editable-preview-surface">
                <ErrorBoundary
                  name="editable-markdown-preview"
                  resetKeys={[activePath]}
                  fallback={
                    <PanelErrorFallback
                      variant="inline"
                      title={t('editor.previewError.title')}
                      detail={t('editor.previewError.detail')}
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
                    <LazyCodeMirrorMarkdownEditor
                      ref={editorRef}
                      key={`visual:${activePath}`}
                      value={draftMarkdown}
                      onChange={updateDraft}
                      scrollToLine={scrollToEditorLine}
                      scrollSyncEnabled={scrollSyncEnabled}
                      onVisibleLineChange={scrollSyncEnabled ? handleSourceLineChange : undefined}
                      insertRequest={editorInsertRequest}
                      transformRequest={editorTransformRequest}
                      typographyRequest={editorTypographyRequest}
                      visualBlockRenderer={visualBlockRenderer}
                      snippetContext={snippetContext}
                      snippetCatalog={snippetCatalog}
                      autocompleteContext={editorAutocompleteContext}
                      vimMode={vimMode}
                      spellcheck={spellcheck}
                      wysiwyg
                      typewriter={typewriter}
                      distractionFree={distractionFree}
                      languageTool={languageTool}
                      editorTheme={editorTheme}
                      onVimSave={saveActiveNoteNow}
                      saveImageFromClipboard={saveImageFromClipboard}
                      showLineNumbers={false}
                      className="markdown-editor editable-preview-editor"
                    />
                  </Suspense>
                </ErrorBoundary>
              </div>
            ) : (
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
                  ref={editorRef}
                  key={activePath}
                  notePath={activePath}
                  value={draftMarkdown}
                  onChange={updateDraft}
                  insertRequest={editorInsertRequest}
                  transformRequest={editorTransformRequest}
                  typographyRequest={editorTypographyRequest}
                  scrollToLine={scrollToEditorLine}
                  editorTheme={editorTheme}
                  typewriter={typewriter}
                  distractionFree={distractionFree}
                  showLineNumbers={showLineNumbers}
                  completionContext={monacoCompletionContext}
                  onVisibleLineChange={scrollSyncEnabled ? handleSourceLineChange : undefined}
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
                onVisibleLineChange={handleSourceLineChange}
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
            )
          ) : (
            <div className="editor-empty" role="status">
              <div className="editor-empty-card">
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
              className="editor-preview-pane editable-preview-pane"
              aria-label={t('editor.previewAria')}
            >
              <ErrorBoundary
                name="split-editable-preview"
                resetKeys={[activePath]}
                fallback={
                  <PanelErrorFallback
                    variant="inline"
                    title={t('editor.previewError.title')}
                    detail={t('editor.previewError.detail')}
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
                  <LazyCodeMirrorMarkdownEditor
                    ref={previewEditorRef}
                    key={`split-visual:${activePath}`}
                    value={draftMarkdown}
                    onChange={updateDraft}
                    scrollSyncEnabled={scrollSyncEnabled}
                    onVisibleLineChange={handleVisualPreviewLineChange}
                    snippetContext={snippetContext}
                    snippetCatalog={snippetCatalog}
                    autocompleteContext={editorAutocompleteContext}
                    spellcheck={spellcheck}
                    wysiwyg
                    typewriter={false}
                    distractionFree={false}
                    manageDistractionFreeClass={false}
                    languageTool={languageTool}
                    editorTheme={editorTheme}
                    saveImageFromClipboard={saveImageFromClipboard}
                    visualBlockRenderer={visualBlockRenderer}
                    showLineNumbers={false}
                    className="markdown-editor editable-preview-editor"
                  />
                </Suspense>
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

export const EditorWorkspace = memo(EditorWorkspaceImpl)

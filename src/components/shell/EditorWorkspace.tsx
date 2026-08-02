import { lazy, Suspense, type CSSProperties, type PointerEventHandler, type RefObject } from 'react'
import {
  Archive,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  CheckCircle2,
  Columns,
  FileBox,
  FileText,
  FolderOpen,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link,
  ListTree,
  MoreHorizontal,
  PanelRight,
  Pin,
  RotateCcw,
  Rows,
  Sparkles,
  Table,
  Target,
  X,
} from 'lucide-react'
import {
  MarkdownEditor,
  type EditorAutocompleteContext,
  type EditorTransformAction,
  type EditorThemeId,
  type MarkdownEditorHandle,
  type MarkdownEditorProps,
  type SnippetCatalogEntry,
  type SnippetVariableContext,
  type TocEntry,
  type TypographyAction,
} from '@scriptor/editor'
import type { MonacoCompletionContext } from '../../lib/monaco-completions'

import { InlineEditorAssist } from '../editor/InlineEditorAssist'
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
  setStickiesVisible: (updater: (value: boolean) => boolean) => void
  splitPreview: boolean
  setSplitPreview: (updater: (value: boolean) => boolean) => void
  showSplitPreview: boolean
  splitEditorWidth: string
  splitDragging: boolean
  onSplitHandlePointerDown: PointerEventHandler<HTMLDivElement>
  onSplitHandlePointerMove: PointerEventHandler<HTMLDivElement>
  onSplitHandlePointerUp: PointerEventHandler<HTMLDivElement>
  onSplitHandlePointerCancel: PointerEventHandler<HTMLDivElement>
  onSplitHandleDoubleClick: () => void
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
    hasFrontmatter = false,
    onOpenPublishCenter,
    showFormatToolbar = true,
    showEditorAssist = true,
    showEditorStatus = true,
    showLineNumbers = true,
    editorSurfaceMode = 'source',
    onEditorSurfaceModeChange,
  } = props

  return (
    <section className="editor-panel" aria-label="Editor">
      <div className="tabs-row" role="tablist" aria-label="Open notes">
        {canReopenClosedTab && onReopenClosedTab ? (
          <button
            type="button"
            className="tab-reopen"
            onClick={onReopenClosedTab}
            aria-label="Reopen closed tab"
            title="Reopen closed tab"
          >
            <RotateCcw aria-hidden="true" />
          </button>
        ) : null}
        {openTabs.length === 0 ? (
          <span className="empty-tab">No note open</span>
        ) : (
          openTabs.map((tab, tabIndex) => (
            <div
              className={`tab-item${tab.path === activePath ? ' active' : ''}${tab.path === activePath && isNoteDirty ? ' tab-dirty' : ''}${tab.pinned ? ' tab-pinned' : ''}`}
              key={tab.path}
            >
              <button
                type="button"
                className="tab tab-main"
                role="tab"
                aria-selected={tab.path === activePath}
                tabIndex={tab.path === activePath ? 0 : -1}
                onClick={() => onOpenTab(tab.path)}
                onKeyDown={(event) => {
                  let targetIndex = tabIndex
                  if (event.key === 'ArrowLeft') targetIndex = (tabIndex - 1 + openTabs.length) % openTabs.length
                  else if (event.key === 'ArrowRight') targetIndex = (tabIndex + 1) % openTabs.length
                  else if (event.key === 'Home') targetIndex = 0
                  else if (event.key === 'End') targetIndex = openTabs.length - 1
                  else return
                  event.preventDefault()
                  const target = openTabs[targetIndex]
                  onOpenTab(target.path)
                  requestAnimationFrame(() => {
                    const tabButtons = event.currentTarget
                      .closest('[role="tablist"]')
                      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                    tabButtons?.[targetIndex]?.focus()
                  })
                }}
              >
                <FileText aria-hidden="true" />
                <span className="tab-title">{tab.title}</span>
                {inboxPaths?.has(tab.path) ? (
                  <span className="tab-lifecycle inbox" title="In inbox">
                    inbox
                  </span>
                ) : null}
                {tab.path === activePath && isNoteDirty ? (
                  <span className="tab-dirty-dot" aria-label="Unsaved changes" title="Unsaved changes" />
                ) : null}
              </button>
              {onTogglePinTab ? (
                <button
                  type="button"
                  className={`tab-icon-button tab-pin${tab.pinned ? ' active' : ''}`}
                  aria-label={tab.pinned ? `Unpin ${tab.title}` : `Pin ${tab.title}`}
                  title={tab.pinned ? 'Unpin tab' : 'Pin tab'}
                  onClick={() => onTogglePinTab(tab.path)}
                >
                  <Pin aria-hidden="true" />
                </button>
              ) : null}
              <button
                type="button"
                className="tab-icon-button tab-close"
                aria-label={`Close ${tab.title}`}
                title="Close tab"
                onClick={() => onCloseTab(tab.path)}
              >
                <X aria-hidden="true" />
              </button>
            </div>
          ))
        )}
      </div>
      {showFormatToolbar ? (
      <div className="editor-toolbar-wrapper">
        <div className="format-row editor-toolbar" aria-label="Markdown tools">
          <div className="format-group" aria-label="View mode">
          {(
            [
              ['Source', 'source'],
              ['Split', 'split'],
              ['Preview', 'rendered'],
            ] as const
          ).map(([label, mode]) => (
            <button
              type="button"
              key={mode}
              className={editorSurfaceMode === mode ? 'active' : undefined}
              onClick={() => onEditorSurfaceModeChange?.(mode)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="format-group" aria-label="Structure">
          <button type="button" disabled={!activePath} title="Heading 1" onClick={() => applyEditorTransform('h1')}>
            <Heading1 />
          </button>
          <button type="button" disabled={!activePath} title="Heading 2" onClick={() => applyEditorTransform('h2')}>
            <Heading2 />
          </button>
          <button type="button" disabled={!activePath} title="Heading 3" onClick={() => applyEditorTransform('h3')}>
            <Heading3 />
          </button>
          <button type="button" disabled={!activePath} title="Table of Contents" onClick={onToggleToc}>
            <ListTree />
          </button>
          <button type="button" disabled={!activePath} title="Frontmatter" onClick={onOpenFrontmatter}>
            <FileBox />
          </button>
          <button type="button" disabled={!activePath} title="Move Section Up" onClick={() => applyEditorTransform('move-section-up')}>
            <ArrowUpToLine />
          </button>
          <button type="button" disabled={!activePath} title="Move Section Down" onClick={() => applyEditorTransform('move-section-down')}>
            <ArrowDownToLine />
          </button>
        </div>

        <div className="format-group" aria-label="Style and insert">
          <button type="button" disabled={!activePath} title="Bold" onClick={() => applyEditorTransform('bold')}>
            <Bold />
          </button>
          <button type="button" disabled={!activePath} title="Italic" onClick={() => applyEditorTransform('italic')}>
            <Italic />
          </button>
          <button type="button" disabled={!activePath} title="Link" onClick={() => applyEditorTransform('link')}>
            <Link />
          </button>
          <TypographyMenu disabled={!activePath} onSelect={(action) => applyEditorTypography(action)} />
          <button type="button" disabled={!activePath} title="Insert Table" onClick={() => applyEditorTransform('table')}>
            <Table />
          </button>
          <button type="button" disabled={!activePath} title="Add Row" onClick={() => applyEditorTransform('table-add-row')}>
            <Rows />
          </button>
          <button type="button" disabled={!activePath} title="Add Column" onClick={() => applyEditorTransform('table-add-col')}>
            <Columns />
          </button>
          <InsertMenu disabled={!activePath} onInsert={insertSnippet} />
        </div>

        <div className="format-group" aria-label="Review and capture">
          <button type="button" disabled={!activePath} title="Mark note organized (inbox triage)" onClick={onOrganizeActive}>
            <CheckCircle2 />
          </button>
          <button type="button" title="Writing Targets" onClick={onOpenWritingTargets}>
            <Target />
          </button>
          <button type="button" onClick={onOpenCheatsheet}>
            Cheatsheet
          </button>
          <button type="button" onClick={() => setStickiesVisible((value) => !value)} className={stickiesVisible ? 'active' : undefined}>
            Stickies
          </button>
        </div>

        <div className="format-group" aria-label="Editor mode">
          <button type="button" onClick={() => setVimMode((value) => !value)} className={vimMode ? 'active' : undefined} disabled={editorMode === 'monaco'}>
            Vim
          </button>
        <button type="button" onClick={toggleEditorMode} className={editorMode === 'monaco' ? 'active' : undefined} title="Toggle Monaco editor">
          Monaco
        </button>
        <button type="button" onClick={toggleEditorTheme} className={editorTheme === 'dark' ? 'active' : undefined} title="Toggle editor theme">
          Theme
        </button>
        <button type="button" onClick={() => setSpellcheck((value) => !value)} className={spellcheck ? 'active' : undefined}>
          Spell
        </button>
        <button type="button" onClick={() => setWysiwyg((value) => !value)} className={wysiwyg ? 'active' : undefined}>
          WYSIWYG
        </button>
        <button type="button" onClick={() => setTypewriter((value) => !value)} className={typewriter ? 'active' : undefined}>
          Typewriter
        </button>
        <button type="button" onClick={() => setDistractionFree((value) => !value)} className={distractionFree ? 'active' : undefined}>
          Focus
        </button>
        <button type="button" onClick={() => setLanguageTool((value) => !value)} className={languageTool ? 'active' : undefined}>
          LT
        </button>
        <button type="button" onClick={renameActiveNote} disabled={!activePath}>
          <Archive />
        </button>
        <button
          type="button"
          disabled={!activePath}
          onClick={() => {
            insertSnippet('> [!ai] Summarize the section above.')
          }}
        >
          <Sparkles />
        </button>
        <span />
        <button
          type="button"
          className={splitPreview ? 'active' : ''}
          disabled={!activePath}
          title="Toggle split preview"
          aria-pressed={splitPreview}
          onClick={() => setSplitPreview((value) => !value)}
        >
          <PanelRight />
        </button>
        <button type="button" disabled={!activePath} title="Insert horizontal rule" onClick={() => insertSnippet('\n---\n')}>
          <MoreHorizontal />
        </button>
        </div>

        {showEditorAssist ? (
        <InlineEditorAssist
          activePath={activePath}
          hasFrontmatter={hasFrontmatter}
          brokenLinkCount={brokenLinkCount}
          citationCount={citationCount}
          onInsertWikilink={() => insertSnippet('[[Note Title]]')}
          onInsertCitation={() => insertSnippet('[@citekey]')}
          onOpenFrontmatter={onOpenFrontmatter}
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
          aria-label="Markdown editor"
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
                  title="The editor"
                  detail="The editor surface failed to render. Switching notes or toggling the editor engine will retry."
                />
              }
            >
            {editorMode === 'monaco' ? (
              <Suspense
                fallback={
                  <div className="editor-loading-state" role="status" aria-live="polite">
                    <span className="editor-loading-shimmer" aria-hidden="true" />
                    <span>Loading advanced editor…</span>
                  </div>
                }
              >
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
              </Suspense>
            ) : (
              <MarkdownEditor
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
            </ErrorBoundary>
          ) : (
            <div className="editor-empty" role="status">
              <div className="editor-empty-icon" aria-hidden="true">
                <FileText />
              </div>
              <div className="editor-empty-copy">
                <h2>{hasOpenVault ? 'Start a new note' : 'Open your writing workspace'}</h2>
                <p>
                  {hasOpenVault
                    ? 'Create a note or choose one from the vault to begin writing.'
                    : 'Choose a Markdown vault to write, connect ideas, and publish from one focused workspace.'}
                </p>
              </div>
              <div className="editor-empty-actions">
                {hasOpenVault ? (
                  <button type="button" className="primary-button" onClick={onCreateNote}>
                    <FileText aria-hidden="true" />
                    New note
                  </button>
                ) : null}
                <button
                  type="button"
                  className={hasOpenVault ? 'action-button' : 'primary-button'}
                  onClick={onOpenVault}
                >
                  <FolderOpen aria-hidden="true" />
                  {hasOpenVault ? 'Open another vault' : 'Open vault'}
                </button>
              </div>
              <small>Local-first · Markdown-native · Your files stay yours</small>
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
            />
            <aside className="editor-preview-pane" aria-label="Split Markdown preview" ref={splitPreviewScrollRef}>
              <ErrorBoundary
                name="split-markdown-preview"
                resetKeys={[activePath]}
                fallback={
                  <PanelErrorFallback
                    variant="inline"
                    title="The split preview"
                    detail="Rendering this note failed — a Markdown extension or plugin renderer may have thrown. The editor is unaffected."
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
          {draftWordCount.toLocaleString()} words
          {wordCountDelta !== 0 ? (
            <small className="word-count-delta">
              {' '}
              ({wordCountDelta > 0 ? '+' : ''}
              {wordCountDelta})
            </small>
          ) : null}
        </span>
        <span>{charCount.toLocaleString()} characters</span>
        <span>{readingMinutes > 0 ? `${readingMinutes} min read` : '— min read'}</span>
        <span>{isSaving ? 'Saving...' : lastSavedAt ? `Saved ${lastSavedAt}` : 'Markdown'}</span>
        <CheckCircle2 />
      </footer>
      ) : null}
    </section>
  )
}
